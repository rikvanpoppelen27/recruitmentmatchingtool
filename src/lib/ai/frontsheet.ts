import { callClaudeJson } from "./callClaudeJson";
import { frontsheetContentSchema, type FrontsheetContent } from "../validation/ai";

export const MAX_SUMMARY_WORDS = 120;
export const MAX_WHY_MATCH_WORDS = 80;
export const MAX_EXPERIENCE_BULLET_WORDS = 30;

export const GENEREER_FRONTSHEET_SYSTEM_PROMPT = `Je schrijft de inhoud voor een frontsheet: een korte introductiepagina die een recruiter meestuurt met een CV naar een opdrachtgever, om een kandidaat voor te stellen voor een specifieke vacature.

KERNREGELS:
1. Schrijf in helder, zakelijk Nederlands, in de derde persoon over de kandidaat (bv. "De kandidaat heeft...", nooit "ik").
2. Baseer je UITSLUITEND op de aangeleverde kandidaatdata. Voeg NOOIT ervaring, werkgevers, skills, jaartallen of andere feiten toe die niet letterlijk in de aangeleverde data staan.
3. Bereken, schat of tel NOOIT op tot een samengevat cijfer dat niet letterlijk is aangeleverd — bijvoorbeeld een totaal aantal jaren werkervaring afleiden uit periodes in de werkervaring. Is het aantal jaren ervaring niet als los getal aangeleverd, noem dan geen totaal aantal jaren; benoem losse functieperiodes zoals ze gegeven zijn.
4. Stem de uitgelichte ervaring af op déze specifieke vacature: benoem wat relevant is voor deze rol, vat de rest samen of laat het weg. Geen volledige CV-opsomming.
5. Geen superlatieven of verkooppraat (bv. "uitstekend", "topkandidaat", "een aanwinst"). Feitelijk en concreet.
6. Antwoord UITSLUITEND met geldige JSON. Geen markdown-codeblokken (geen \`\`\`), geen toelichting.

Retourneer exact dit JSON-schema:
{
  "summary": string,
  "whyThisMatch": string,
  "highlightedExperience": string[]
}`;

export interface FrontsheetInputCandidate {
  fullName: string | null;
  yearsExperience: number | null;
  skills: string[];
  workExperience: Array<{
    jobTitle: string | null;
    employer: string | null;
    period: string | null;
    description: string | null;
  }>;
  educations: Array<{ institution: string | null; degree: string | null; fieldOfStudy: string | null }>;
}

export interface FrontsheetInputVacancy {
  title: string;
  companyName: string;
  description: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
}

export interface FrontsheetInputMatch {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  rationale: string;
}

export interface FrontsheetInput {
  candidate: FrontsheetInputCandidate;
  vacancy: FrontsheetInputVacancy;
  match: FrontsheetInputMatch;
}

export function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function buildUserMessage(input: FrontsheetInput, previousError: string | null): string {
  const payload = JSON.stringify(input, null, 2);
  if (previousError === null) {
    return `Schrijf de frontsheet-inhoud voor deze kandidaat-vacature-combinatie:\n\n${payload}`;
  }
  return (
    `Schrijf de frontsheet-inhoud voor deze kandidaat-vacature-combinatie:\n\n${payload}\n\n` +
    `Je vorige antwoord was ongeldig: ${previousError}\n` +
    `Geef het antwoord opnieuw, uitsluitend als geldige JSON volgens het schema uit de systeemprompt.`
  );
}

/**
 * Genereert de invulvelden voor het frontsheet-template (templates/frontsheet.html)
 * op basis van het match-resultaat uit fase 3 + kandidaat- en vacatureprofiel.
 * Lengtebegrenzing wordt hierna in code afgedwongen zodat het template nooit
 * overloopt, ongeacht wat Claude teruggeeft.
 */
export async function genereerFrontsheet(input: FrontsheetInput): Promise<FrontsheetContent> {
  const raw = await callClaudeJson(
    GENEREER_FRONTSHEET_SYSTEM_PROMPT,
    (previousError) => buildUserMessage(input, previousError),
    frontsheetContentSchema,
    2048,
  );

  return {
    summary: truncateWords(raw.summary, MAX_SUMMARY_WORDS),
    whyThisMatch: truncateWords(raw.whyThisMatch, MAX_WHY_MATCH_WORDS),
    highlightedExperience: raw.highlightedExperience.map((bullet) => truncateWords(bullet, MAX_EXPERIENCE_BULLET_WORDS)),
  };
}
