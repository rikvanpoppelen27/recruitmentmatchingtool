import { analyseVacature } from "../ai/analyseVacature";
import { berekenMatch, type SemanticMatchInput } from "../ai/match";
import { prisma } from "../db/prisma";
import { generateFrontsheetForMatch } from "../pdf/generateFrontsheet";
import { generateMailDraftForMatch, getStyleProfileWithExamples } from "../mail/generateMailDraft";
import { combineScores, computeSkillScore, shouldCallSemanticLayer } from "../match/score";
import { matchSkills } from "../match/skills";
import { getEffectiveAutoGenerateMode, getEffectiveMatchSettings } from "../settings";

export interface PrimaryMatchInfo {
  matchId: string;
  candidateId: string;
  candidateName: string | null;
  score: number;
}

export interface ShortlistAutomationResult {
  vacancyId: string;
  matchesEvaluated: number;
  aiCallsMade: number;
  primaryMatch: PrimaryMatchInfo | null;
  /** Aantal kandidaten (incl. de primaire) dat de matchdrempel haalt. */
  candidatesAboveThreshold: number;
  /** Hoogst behaalde score, ook als niemand de drempel haalt (informatief). */
  highestScore: number | null;
  frontsheetGenerated: boolean;
  mailGenerated: boolean;
  errors: string[];
}

/**
 * Stap 1+2 van de shortlist-automatisering: matcht alle actieve kandidaten
 * tegen deze vacature (hergebruikt de fase 3-engine — skills.ts/score.ts/
 * ai/match.ts, inclusief de goedkope voordrempel) en markeert de hoogst
 * scorende kandidaat boven de drempel als `isPrimary`. Dit dupliceert bewust
 * de lus uit lib/match/runMatching.ts niet 1-op-1 als import, omdat die over
 * ALLE vacatures tegelijk itereert — hier gaat het om precies één vacature,
 * synchroon binnen de shortlist-actie.
 */
async function matchVacancyAgainstCandidates(
  vacancyId: string,
): Promise<{ matchesEvaluated: number; aiCallsMade: number; errors: string[] }> {
  const errors: string[] = [];
  let aiCallsMade = 0;

  const vacancy = await prisma.vacancy.findUniqueOrThrow({ where: { id: vacancyId } });

  if (!vacancy.analyzedAt) {
    try {
      const analysis = await analyseVacature(vacancy.description);
      aiCallsMade += 1;
      await prisma.vacancy.update({
        where: { id: vacancyId },
        data: {
          mustHaveSkills: analysis.mustHaveSkills,
          niceToHaveSkills: analysis.niceToHaveSkills,
          seniority: analysis.seniority,
          analyzedAt: new Date(),
        },
      });
      vacancy.mustHaveSkills = analysis.mustHaveSkills;
      vacancy.niceToHaveSkills = analysis.niceToHaveSkills;
      vacancy.seniority = analysis.seniority;
    } catch (error) {
      errors.push(`Vacature-analyse mislukt: ${(error as Error).message}`);
      return { matchesEvaluated: 0, aiCallsMade, errors };
    }
  }

  const settings = await getEffectiveMatchSettings();

  const [candidates, existingMatches] = await Promise.all([
    prisma.candidate.findMany({ where: { isActive: true }, include: { educations: true, workExperience: true } }),
    prisma.match.findMany({ where: { vacancyId }, select: { candidateId: true } }),
  ]);
  const existingCandidateIds = new Set(existingMatches.map((m) => m.candidateId));

  let matchesEvaluated = existingMatches.length;

  for (const candidate of candidates) {
    if (existingCandidateIds.has(candidate.id)) continue;

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
        errors.push(`Semantische beoordeling mislukt voor ${candidate.fullName ?? candidate.id}: ${(error as Error).message}`);
      }
    }

    const combined = combineScores(skillResult, skillScore, semanticScore, semanticRationale, settings.matchThreshold, settings);

    await prisma.match.create({
      data: {
        candidateId: candidate.id,
        vacancyId,
        score: combined.finalScore,
        skillScore: combined.skillScore,
        semanticScore: combined.semanticScore,
        matchedSkills: combined.matchedSkills,
        missingSkills: combined.missingSkills,
        rationale: combined.rationale,
        isPromising: combined.isPromising,
      },
    });
    matchesEvaluated += 1;
  }

  return { matchesEvaluated, aiCallsMade, errors };
}

/**
 * Volledige shortlist-automatisering (fase 6B) voor één vacature: matchen,
 * de hoogst scorende kandidaat boven de drempel als primair markeren, en
 * — alleen bij `autoGenerateMode: "volledig"` (instellingen) — meteen een
 * frontsheet en mailconcept genereren voor die primaire match. Wordt altijd
 * via `enqueueShortlistAutomation` aangeroepen, nooit direct, zodat meerdere
 * snel-achter-elkaar geshortliste vacatures niet gelijktijdig AI-calls vuren.
 */
async function runShortlistAutomation(vacancyId: string): Promise<ShortlistAutomationResult> {
  const { matchesEvaluated, aiCallsMade: matchingAiCalls, errors } = await matchVacancyAgainstCandidates(vacancyId);
  let aiCallsMade = matchingAiCalls;

  const settings = await getEffectiveMatchSettings();
  const allMatches = await prisma.match.findMany({
    where: { vacancyId },
    include: { candidate: { select: { fullName: true } } },
    orderBy: [{ score: "desc" }, { calculatedAt: "asc" }],
  });

  const aboveThreshold = allMatches.filter((m) => m.score >= settings.matchThreshold);
  const highestScore = allMatches.length > 0 ? allMatches[0].score : null;

  let primaryMatch: PrimaryMatchInfo | null = null;

  if (aboveThreshold.length > 0) {
    const top = aboveThreshold[0];
    await prisma.$transaction([
      prisma.match.updateMany({ where: { vacancyId, id: { not: top.id } }, data: { isPrimary: false } }),
      prisma.match.update({ where: { id: top.id }, data: { isPrimary: true } }),
    ]);
    primaryMatch = { matchId: top.id, candidateId: top.candidateId, candidateName: top.candidate.fullName, score: top.score };
  } else if (allMatches.length > 0) {
    await prisma.match.updateMany({ where: { vacancyId }, data: { isPrimary: false } });
  }

  let frontsheetGenerated = false;
  let mailGenerated = false;

  if (primaryMatch) {
    const autoGenerateMode = await getEffectiveAutoGenerateMode();
    if (autoGenerateMode === "volledig") {
      try {
        await generateFrontsheetForMatch(primaryMatch.matchId);
        frontsheetGenerated = true;
        aiCallsMade += 1;
      } catch (error) {
        errors.push(`Frontsheet genereren mislukt: ${(error as Error).message}`);
      }

      try {
        const styleProfile = await getStyleProfileWithExamples();
        if (!styleProfile) {
          errors.push("Geen mailconcept gegenereerd: er is nog geen stijlprofiel opgebouwd (zie Instellingen).");
        } else {
          const defaultTemplate = await prisma.mailTemplate.findFirst({ where: { isDefault: true } });
          await generateMailDraftForMatch(
            primaryMatch.matchId,
            "standaard",
            styleProfile,
            defaultTemplate?.systemInstruction ?? null,
          );
          mailGenerated = true;
          aiCallsMade += 1;
        }
      } catch (error) {
        errors.push(`Mailconcept genereren mislukt: ${(error as Error).message}`);
      }
    }
  }

  return {
    vacancyId,
    matchesEvaluated,
    aiCallsMade,
    primaryMatch,
    candidatesAboveThreshold: aboveThreshold.length,
    highestScore,
    frontsheetGenerated,
    mailGenerated,
    errors,
  };
}

let automationQueue: Promise<unknown> = Promise.resolve();

/**
 * Simpele sequentiële wachtrij (in-process): garandeert dat shortlist-
 * automatisering nooit gelijktijdig voor meerdere vacatures draait, ook niet
 * als er snel achter elkaar meerdere plus-knoppen worden geklikt. Werkt
 * binnen één Node-proces (zoals `npm run dev`/`next start`) — geen
 * cross-instance-garantie in een echt serverless/multi-instance-deployment,
 * wat voor dit eenmanstool-gebruik geen praktisch probleem is.
 */
export function enqueueShortlistAutomation(vacancyId: string): Promise<ShortlistAutomationResult> {
  const run = automationQueue.then(() => runShortlistAutomation(vacancyId));
  automationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
