import { canonicalizeSkill } from "../../config/skill-aliases";

export interface SkillMatchResult {
  /** 0-1: aandeel must-haves dat de kandidaat heeft. */
  mustHaveCoverage: number;
  /** 0-1: aandeel nice-to-haves dat de kandidaat heeft. */
  niceToHaveCoverage: number;
  matchedSkills: string[];
  missingMustHaves: string[];
  missingNiceToHaves: string[];
  /** False zodra minstens één must-have ontbreekt — het knock-out-signaal. */
  hasAllMustHaves: boolean;
}

/**
 * Deterministische, AI-vrije skill-vergelijking (laag 1). Normaliseert alle
 * skills (lowercase + aliassen uit config/skill-aliases.ts) vóór vergelijking.
 */
export function matchSkills(
  candidateSkills: string[],
  mustHaveSkills: string[],
  niceToHaveSkills: string[],
): SkillMatchResult {
  const candidateSet = new Set(candidateSkills.map(canonicalizeSkill));

  const mustHaves = mustHaveSkills.map(canonicalizeSkill);
  const niceToHaves = niceToHaveSkills.map(canonicalizeSkill);

  const matchedMustHaves = mustHaves.filter((skill) => candidateSet.has(skill));
  const missingMustHaves = mustHaves.filter((skill) => !candidateSet.has(skill));
  const matchedNiceToHaves = niceToHaves.filter((skill) => candidateSet.has(skill));
  const missingNiceToHaves = niceToHaves.filter((skill) => !candidateSet.has(skill));

  const mustHaveCoverage = mustHaves.length === 0 ? 1 : matchedMustHaves.length / mustHaves.length;
  const niceToHaveCoverage = niceToHaves.length === 0 ? 1 : matchedNiceToHaves.length / niceToHaves.length;

  return {
    mustHaveCoverage,
    niceToHaveCoverage,
    matchedSkills: [...matchedMustHaves, ...matchedNiceToHaves],
    missingMustHaves,
    missingNiceToHaves,
    hasAllMustHaves: missingMustHaves.length === 0,
  };
}
