import { analyseVacature } from "../ai/analyseVacature";
import { berekenMatch, type SemanticMatchInput } from "../ai/match";
import { prisma } from "../db/prisma";
import { combineScores, computeSkillScore, shouldCallSemanticLayer } from "./score";
import { matchSkills } from "./skills";
import { getEffectiveMatchSettings } from "../settings";

async function analyseerOngeanalyseerdeVacatures(): Promise<void> {
  const vacancies = await prisma.vacancy.findMany({ where: { analyzedAt: null } });
  if (vacancies.length === 0) return;

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
      console.error(
        `[match] Analyse van "${vacancy.title}" bij ${vacancy.companyName} mislukt: ${(error as Error).message}`,
      );
    }
  }
}

export interface MatchOutcome {
  candidateId: string;
  candidateName: string;
  vacancyId: string;
  vacancyLabel: string;
  finalScore: number;
  skillScore: number;
  semanticScore: number | null;
  isPromising: boolean;
  aiCallSkipped: boolean;
}

export interface MatchRunSummary {
  outcomes: MatchOutcome[];
  newMatches: number;
  aiCallsMade: number;
  aiCallsSkipped: number;
}

/**
 * Analyseert nog niet-geanalyseerde vacatures en matcht daarna elke actieve
 * kandidaat tegen elke geanalyseerde vacature die nog geen Match-record heeft.
 * Gedeelde implementatie voor scripts/match.ts (CLI) en de "Matchen
 * draaien"-knop op /matches (route handler POST /api/match/run) — zo geven
 * CLI en interface gegarandeerd hetzelfde resultaat. De effectieve
 * matchconfig (gewichten, knock-out-cap, drempel) komt uit lib/settings.ts,
 * dat op zijn beurt terugvalt op config/match.ts als er geen
 * databaseoverride is.
 */
export async function runMatching(): Promise<MatchRunSummary> {
  const settings = await getEffectiveMatchSettings();

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
      const skillScore = computeSkillScore(skillResult, settings);

      let semanticScore: number | null = null;
      let semanticRationale: string | null = null;

      if (shouldCallSemanticLayer(skillResult, settings)) {
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

      const combined = combineScores(
        skillResult,
        skillScore,
        semanticScore,
        semanticRationale,
        settings.matchThreshold,
        settings,
      );

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
        candidateId: candidate.id,
        candidateName: candidate.fullName ?? candidate.id,
        vacancyId: vacancy.id,
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

  return { outcomes, newMatches, aiCallsMade, aiCallsSkipped };
}
