import { matchConfig } from "../../config/match";
import type { SkillMatchResult } from "./skills";

export interface CombinedMatchResult {
  finalScore: number;
  skillScore: number;
  semanticScore: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  rationale: string;
  isPromising: boolean;
}

/** Laag 1-score (0-100), gewogen naar must-haves zwaarder dan nice-to-haves. */
export function computeSkillScore(skillResult: SkillMatchResult): number {
  const raw =
    skillResult.mustHaveCoverage * matchConfig.mustHaveWeight * 100 +
    skillResult.niceToHaveCoverage * matchConfig.niceToHaveWeight * 100;
  return Math.round(raw);
}

/** Voordrempel: is de must-have-dekking hoog genoeg om de (dure) AI-laag aan te roepen? */
export function shouldCallSemanticLayer(skillResult: SkillMatchResult): boolean {
  return skillResult.mustHaveCoverage >= matchConfig.aiCallMustHaveThreshold;
}

/**
 * Combineert laag 1 (skills) en laag 2 (semantisch, evt. overgeslagen) tot
 * één eindscore, past de must-have-knock-out toe, en bepaalt of de match
 * "kansrijk" is t.o.v. de meegegeven drempel.
 */
export function combineScores(
  skillResult: SkillMatchResult,
  skillScore: number,
  semanticScore: number | null,
  semanticRationale: string | null,
  matchThreshold: number,
): CombinedMatchResult {
  let finalScore: number;
  let rationale: string;

  if (semanticScore === null) {
    finalScore = skillScore;
    rationale =
      `Semantische laag overgeslagen: must-have-dekking ` +
      `(${Math.round(skillResult.mustHaveCoverage * 100)}%) lag onder de voordrempel van ` +
      `${Math.round(matchConfig.aiCallMustHaveThreshold * 100)}%. Score is uitsluitend gebaseerd op skill-matching.`;
  } else {
    finalScore = Math.round(skillScore * matchConfig.skillWeight + semanticScore * matchConfig.semanticWeight);
    rationale = semanticRationale ?? "";
  }

  if (!skillResult.hasAllMustHaves) {
    finalScore = Math.min(finalScore, matchConfig.knockOutCapScore);
  }

  return {
    finalScore,
    skillScore,
    semanticScore,
    matchedSkills: skillResult.matchedSkills,
    missingSkills: [...skillResult.missingMustHaves, ...skillResult.missingNiceToHaves],
    rationale,
    isPromising: finalScore >= matchThreshold,
  };
}
