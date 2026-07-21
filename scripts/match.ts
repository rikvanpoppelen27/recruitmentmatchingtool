import "dotenv/config";

import { analyseVacature } from "../src/lib/ai/analyseVacature";
import { berekenMatch, type SemanticMatchInput } from "../src/lib/ai/match";
import { prisma } from "../src/lib/db/prisma";
import { combineScores, computeSkillScore, shouldCallSemanticLayer } from "../src/lib/match/score";
import { matchSkills } from "../src/lib/match/skills";

function getMatchThreshold(): number {
  const raw = process.env.MATCH_THRESHOLD;
  if (!raw) {
    throw new Error("MATCH_THRESHOLD moet gezet zijn in de environment (.env).");
  }
  const threshold = Number(raw);
  if (Number.isNaN(threshold)) {
    throw new Error(`MATCH_THRESHOLD is geen geldig getal: "${raw}"`);
  }
  return threshold;
}

async function analyseerOngeanalyseerdeVacatures(): Promise<void> {
  const vacancies = await prisma.vacancy.findMany({ where: { analyzedAt: null } });
  if (vacancies.length === 0) return;

  console.log(`[match] ${vacancies.length} nog niet geanalyseerde vacature(s) analyseren...`);
  for (const vacancy of vacancies) {
    try {
      const analysis = await analyseVacature(vacancy.description);
      await prisma.vacancy.update({
        where: { id: vacancy.id },
        data: {
          mustHaveSkills: analysis.mustHaveSkills,
          niceToHaveSkills: analysis.niceToHaveSkills,
          seniority: analysis.seniority,
          analyzedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(`[match] Analyse van "${vacancy.title}" bij ${vacancy.companyName} mislukt: ${(error as Error).message}`);
    }
  }
}

interface MatchOutcome {
  candidateName: string;
  vacancyLabel: string;
  finalScore: number;
  skillScore: number;
  semanticScore: number | null;
  isPromising: boolean;
  aiCallSkipped: boolean;
}

async function main() {
  const matchThreshold = getMatchThreshold();

  await analyseerOngeanalyseerdeVacatures();

  const candidates = await prisma.candidate.findMany({
    where: { isActive: true },
    include: { educations: true, workExperience: true },
  });
  const vacancies = await prisma.vacancy.findMany({
    where: { isActive: true, analyzedAt: { not: null } },
  });

  const existingPairs = new Set(
    (await prisma.match.findMany({ select: { candidateId: true, vacancyId: true } })).map(
      (m) => `${m.candidateId}:${m.vacancyId}`,
    ),
  );

  const outcomes: MatchOutcome[] = [];
  let aiCallsMade = 0;
  let aiCallsSkipped = 0;
  let newMatches = 0;

  for (const candidate of candidates) {
    for (const vacancy of vacancies) {
      const pairKey = `${candidate.id}:${vacancy.id}`;
      if (existingPairs.has(pairKey)) continue;

      const skillResult = matchSkills(candidate.skills, vacancy.mustHaveSkills, vacancy.niceToHaveSkills);
      const skillScore = computeSkillScore(skillResult);

      let semanticScore: number | null = null;
      let semanticRationale: string | null = null;

      if (shouldCallSemanticLayer(skillResult)) {
        const input: SemanticMatchInput = {
          candidate: {
            fullName: candidate.fullName,
            region: candidate.region,
            yearsExperience: candidate.yearsExperience,
            skills: candidate.skills,
            workExperience: candidate.workExperience.map((w) => ({
              jobTitle: w.jobTitle,
              employer: w.employer,
              period: w.period,
              description: w.description,
            })),
            educations: candidate.educations.map((e) => ({
              institution: e.institution,
              degree: e.degree,
              fieldOfStudy: e.fieldOfStudy,
            })),
          },
          vacancy: {
            title: vacancy.title,
            companyName: vacancy.companyName,
            region: vacancy.region,
            description: vacancy.description,
            mustHaveSkills: vacancy.mustHaveSkills,
            niceToHaveSkills: vacancy.niceToHaveSkills,
            seniority: vacancy.seniority,
          },
          skillMatch: {
            mustHaveCoverage: skillResult.mustHaveCoverage,
            niceToHaveCoverage: skillResult.niceToHaveCoverage,
            matchedSkills: skillResult.matchedSkills,
            missingMustHaves: skillResult.missingMustHaves,
            missingNiceToHaves: skillResult.missingNiceToHaves,
          },
        };

        try {
          const semantic = await berekenMatch(input);
          semanticScore = semantic.score;
          semanticRationale = semantic.rationale;
          aiCallsMade += 1;
        } catch (error) {
          console.error(
            `[match] Semantische beoordeling mislukt voor ${candidate.fullName ?? candidate.id} × ` +
              `${vacancy.title} (${vacancy.companyName}): ${(error as Error).message}`,
          );
        }
      } else {
        aiCallsSkipped += 1;
      }

      const combined = combineScores(skillResult, skillScore, semanticScore, semanticRationale, matchThreshold);

      await prisma.match.create({
        data: {
          candidateId: candidate.id,
          vacancyId: vacancy.id,
          score: combined.finalScore,
          skillScore: combined.skillScore,
          semanticScore: combined.semanticScore,
          matchedSkills: combined.matchedSkills,
          missingSkills: combined.missingSkills,
          rationale: combined.rationale,
          isPromising: combined.isPromising,
        },
      });
      newMatches += 1;

      outcomes.push({
        candidateName: candidate.fullName ?? candidate.id,
        vacancyLabel: `${vacancy.title} (${vacancy.companyName})`,
        finalScore: combined.finalScore,
        skillScore: combined.skillScore,
        semanticScore: combined.semanticScore,
        isPromising: combined.isPromising,
        aiCallSkipped: semanticScore === null,
      });
    }
  }

  outcomes.sort((a, b) => b.finalScore - a.finalScore);

  console.log("\n=== Matches (gesorteerd op eindscore, kansrijk bovenaan) ===");
  for (const o of outcomes) {
    const marker = o.isPromising ? "★ KANSRIJK" : "";
    const semantic = o.semanticScore === null ? "n.v.t. (overgeslagen)" : o.semanticScore;
    console.log(
      `${o.finalScore.toString().padStart(3)} | skill=${o.skillScore} semantisch=${semantic} | ` +
        `${o.candidateName} × ${o.vacancyLabel} ${marker}`,
    );
  }

  console.log(
    `\n=== Samenvatting match === nieuwe matches=${newMatches}, AI-calls uitgevoerd=${aiCallsMade}, ` +
      `AI-calls overgeslagen (voordrempel niet gehaald)=${aiCallsSkipped}`,
  );
}

main()
  .catch((error) => {
    console.error("[match] Onverwachte fout:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
