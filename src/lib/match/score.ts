import { matchConfig, type MatchConfig } from "../../config/match";
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

/**
 * Laag 1-score (0-100), gewogen naar must-haves zwaarder dan nice-to-haves.
 * `config` is optioneel en valt terug op config/match.ts — zo kan fase 6's
 * /instellingen-pagina een uit de database opgehaalde config meegeven zonder
 * dat CLI-aanroepen (scripts/match.ts) hoeven te veranderen.
 */
export function computeSkillScore(skillResult: SkillMatchResult, config: MatchConfig = matchConfig): number {
  const raw =
    skillResult.mustHaveCoverage * config.mustHaveWeight * 100 +
    skillResult.niceToHaveCoverage * config.niceToHaveWeight * 100;
  return Math.round(raw);
}

/** Voordrempel: is de must-have-dekking hoog genoeg om de (dure) AI-laag aan te roepen? */
export function shouldCallSemanticLayer(skillResult: SkillMatchResult, config: MatchConfig = matchConfig): boolean {
  return skillResult.mustHaveCoverage >= config.aiCallMustHaveThreshold;
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
  config: MatchConfig = matchConfig,
): CombinedMatchResult {
  let finalScore: number;
  let rationale: string;

  if (semanticScore === null) {
    finalScore = skillScore;
    rationale =
      `Semantische laag overgeslagen: must-have-dekking ` +
      `(${Math.round(skillResult.mustHaveCoverage * 100)}%) lag onder de voordrempel van ` +
      `${Math.round(config.aiCallMustHaveThreshold * 100)}%. Score is uitsluitend gebaseerd op skill-matching.`;
  } else {
    finalScore = Math.round(skillScore * config.skillWeight + semanticScore * config.semanticWeight);
    rationale = semanticRationale ?? "";
  }

  if (!skillResult.hasAllMustHaves) {
    finalScore = Math.min(finalScore, config.knockOutCapScore);
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
