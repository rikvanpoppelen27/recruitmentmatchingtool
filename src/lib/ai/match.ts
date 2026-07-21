import { callClaudeJson } from "./callClaudeJson";
import { semanticMatchResultSchema, type SemanticMatchResult } from "../validation/ai";
import type { SkillMatchResult } from "../match/skills";

export const BEREKEN_MATCH_SYSTEM_PROMPT = `Je bent een ervaren recruiter die beoordeelt hoe goed een kandidaat past bij een vacature.

Je krijgt het kandidaatprofiel, het vacatureprofiel en de uitkomst van een automatische skill-vergelijking. Beoordeel de fit op alles wat skill-overlap alleen niet vangt:
- senioriteit/ervaringsniveau ten opzichte van wat de vacature vraagt
- domein-/branche-ervaring
- rol-progressie (is de carrièrelijn logisch richting deze rol?)
- transferable skills (bv. Vue-ervaring is relevant voor een React-rol)
- regio-match

KERNREGELS:
1. Antwoord UITSLUITEND met geldige JSON. Geen markdown-codeblokken (geen \`\`\`), geen toelichting.
2. Geef een score van 0-100 en een onderbouwing van maximaal 4 zinnen, in helder Nederlands.
3. Wees eerlijk streng: reserveer een score van 90 of hoger alleen voor kandidaten die je daadwerkelijk met vertrouwen bij deze vacature zou voorstellen. De meeste kandidaten verdienen geen 90+.

Retourneer exact dit JSON-schema:
{
  "score": number,
  "rationale": string
}`;

export interface SemanticMatchCandidate {
  fullName: string | null;
  region: string | null;
  yearsExperience: number | null;
  skills: string[];
  workExperience: Array<{
    jobTitle: string | null;
    employer: string | null;
    period: string | null;
    description: string | null;
  }>;
  educations: Array<{
    institution: string | null;
    degree: string | null;
    fieldOfStudy: string | null;
  }>;
}

export interface SemanticMatchVacancy {
  title: string;
  companyName: string;
  region: string;
  description: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  seniority: string | null;
}

export interface SemanticMatchInput {
  candidate: SemanticMatchCandidate;
  vacancy: SemanticMatchVacancy;
  skillMatch: Pick<
    SkillMatchResult,
    "mustHaveCoverage" | "niceToHaveCoverage" | "matchedSkills" | "missingMustHaves" | "missingNiceToHaves"
  >;
}

function buildUserMessage(input: SemanticMatchInput, previousError: string | null): string {
  const payload = JSON.stringify(input, null, 2);
  if (previousError === null) {
    return `Beoordeel deze kandidaat-vacature-combinatie:\n\n${payload}`;
  }
  return (
    `Beoordeel deze kandidaat-vacature-combinatie:\n\n${payload}\n\n` +
    `Je vorige antwoord was ongeldig: ${previousError}\n` +
    `Geef het antwoord opnieuw, uitsluitend als geldige JSON volgens het schema uit de systeemprompt.`
  );
}

/**
 * Laag 2 van de matching-engine: semantische beoordeling door Claude van
 * alles wat skill-overlap niet vangt. Wordt alleen aangeroepen als laag 1
 * (skills.ts) de voordrempel haalt — zie shouldCallSemanticLayer in
 * lib/match/score.ts.
 */
export async function berekenMatch(input: SemanticMatchInput): Promise<SemanticMatchResult> {
  return callClaudeJson(
    BEREKEN_MATCH_SYSTEM_PROMPT,
    (previousError) => buildUserMessage(input, previousError),
    semanticMatchResultSchema,
    1024,
  );
}
