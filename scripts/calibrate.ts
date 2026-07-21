import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { analyseVacature } from "../src/lib/ai/analyseVacature";
import { berekenMatch, type SemanticMatchInput } from "../src/lib/ai/match";
import { prisma } from "../src/lib/db/prisma";
import { combineScores, computeSkillScore, shouldCallSemanticLayer } from "../src/lib/match/score";
import { matchSkills } from "../src/lib/match/skills";

type Label = "sterk" | "twijfel" | "zwak";

interface GoldenSetEntry {
  candidateEmail: string;
  vacancyCompany: string;
  vacancyTitle: string;
  label: Label;
}

interface CalibrationRow {
  candidateName: string;
  vacancyLabel: string;
  label: Label;
  finalScore: number;
  skillScore: number;
  semanticScore: number | null;
  isPromising: boolean;
}

function getMatchThreshold(): number {
  const raw = process.env.MATCH_THRESHOLD;
  if (!raw) throw new Error("MATCH_THRESHOLD moet gezet zijn in de environment (.env).");
  const threshold = Number(raw);
  if (Number.isNaN(threshold)) throw new Error(`MATCH_THRESHOLD is geen geldig getal: "${raw}"`);
  return threshold;
}

async function ensureVacancyAnalyzed(vacancy: { id: string; description: string; analyzedAt: Date | null }) {
  if (vacancy.analyzedAt) return;
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
}

async function main() {
  const matchThreshold = getMatchThreshold();
  const goldenSetPath = path.join(__dirname, "..", "calibration", "golden-set.json");
  const goldenSet: GoldenSetEntry[] = JSON.parse(await readFile(goldenSetPath, "utf-8"));

  const rows: CalibrationRow[] = [];

  for (const entry of goldenSet) {
    const candidate = await prisma.candidate.findFirst({
      where: { email: entry.candidateEmail },
      include: { educations: true, workExperience: true },
    });
    if (!candidate) {
      console.warn(`[calibrate] Kandidaat niet gevonden voor e-mail "${entry.candidateEmail}" — overgeslagen.`);
      continue;
    }

    const vacancy = await prisma.vacancy.findFirst({
      where: {
        companyName: { equals: entry.vacancyCompany, mode: "insensitive" },
        title: { equals: entry.vacancyTitle, mode: "insensitive" },
      },
    });
    if (!vacancy) {
      console.warn(
        `[calibrate] Vacature niet gevonden voor "${entry.vacancyTitle}" bij "${entry.vacancyCompany}" — overgeslagen.`,
      );
      continue;
    }

    await ensureVacancyAnalyzed(vacancy);
    const analyzedVacancy = await prisma.vacancy.findUniqueOrThrow({ where: { id: vacancy.id } });

    const skillResult = matchSkills(candidate.skills, analyzedVacancy.mustHaveSkills, analyzedVacancy.niceToHaveSkills);
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
          title: analyzedVacancy.title,
          companyName: analyzedVacancy.companyName,
          region: analyzedVacancy.region,
          description: analyzedVacancy.description,
          mustHaveSkills: analyzedVacancy.mustHaveSkills,
          niceToHaveSkills: analyzedVacancy.niceToHaveSkills,
          seniority: analyzedVacancy.seniority,
        },
        skillMatch: {
          mustHaveCoverage: skillResult.mustHaveCoverage,
          niceToHaveCoverage: skillResult.niceToHaveCoverage,
          matchedSkills: skillResult.matchedSkills,
          missingMustHaves: skillResult.missingMustHaves,
          missingNiceToHaves: skillResult.missingNiceToHaves,
        },
      };
      const semantic = await berekenMatch(input);
      semanticScore = semantic.score;
      semanticRationale = semantic.rationale;
    }

    const combined = combineScores(skillResult, skillScore, semanticScore, semanticRationale, matchThreshold);

    rows.push({
      candidateName: candidate.fullName ?? candidate.email ?? candidate.id,
      vacancyLabel: `${analyzedVacancy.title} (${analyzedVacancy.companyName})`,
      label: entry.label,
      finalScore: combined.finalScore,
      skillScore: combined.skillScore,
      semanticScore: combined.semanticScore,
      isPromising: combined.isPromising,
    });
  }

  console.log("\n=== Kalibratie: golden set vs. berekende score ===");
  console.log(
    "label    | eindscore | skill | semantisch | kansrijk | kandidaat × vacature",
  );
  for (const row of rows) {
    const semantic = row.semanticScore === null ? "n.v.t." : row.semanticScore.toString();
    console.log(
      `${row.label.padEnd(8)} | ${row.finalScore.toString().padStart(9)} | ${row.skillScore
        .toString()
        .padStart(5)} | ${semantic.padStart(10)} | ${(row.isPromising ? "ja" : "nee").padStart(8)} | ` +
        `${row.candidateName} × ${row.vacancyLabel}`,
    );
  }

  console.log("\n=== Gemiddelde score per label ===");
  for (const label of ["sterk", "twijfel", "zwak"] as const) {
    const scores = rows.filter((r) => r.label === label).map((r) => r.finalScore);
    if (scores.length === 0) continue;
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    console.log(`${label}: gemiddeld ${avg.toFixed(1)} (n=${scores.length})`);
  }

  const falsePositives = rows.filter((r) => r.label === "zwak" && r.isPromising);
  console.log(`\n=== False positives ("zwak" maar toch kansrijk) ===`);
  if (falsePositives.length === 0) {
    console.log("Geen — geen enkel als 'zwak' gelabeld paar kwam boven de drempel uit.");
  } else {
    for (const fp of falsePositives) {
      console.log(`⚠ ${fp.candidateName} × ${fp.vacancyLabel} — eindscore ${fp.finalScore}`);
    }
  }
}

main()
  .catch((error) => {
    console.error("[calibrate] Onverwachte fout:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
