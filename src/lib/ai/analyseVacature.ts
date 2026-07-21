import { callClaudeJson } from "./callClaudeJson";
import { vacatureAnalysisSchema, type VacatureAnalysis } from "../validation/ai";

export const ANALYSEER_VACATURE_SYSTEM_PROMPT = `Je analyseert vacatureteksten voor een recruitment-tool.

Haal uit de vacaturetekst:
- must-have skills: vaardigheden/technologieën die expliciet verplicht of vereist zijn
- nice-to-have skills: vaardigheden die als pré, wenselijk of "mooi meegenomen" genoemd worden
- senioriteit: bijvoorbeeld "junior", "medior", "senior", "lead" — alleen als dit is af te leiden uit de tekst (functietitel of expliciete vermelding)

KERNREGELS:
1. Antwoord UITSLUITEND met geldige JSON. Geen markdown-codeblokken (geen \`\`\`), geen toelichting.
2. Skills geef je terug als array van losse, genormaliseerde termen in lowercase.
3. Neem ALLEEN gegevens over die af te leiden zijn uit de tekst. Staat iets er niet, geef dan null (of een lege array) terug. Verzin of gok niets.

Retourneer exact dit JSON-schema:
{
  "mustHaveSkills": string[],
  "niceToHaveSkills": string[],
  "seniority": string | null
}`;

function buildUserMessage(vacatureTekst: string, previousError: string | null): string {
  if (previousError === null) {
    return `Vacaturetekst:\n\n${vacatureTekst}`;
  }
  return (
    `Vacaturetekst:\n\n${vacatureTekst}\n\n` +
    `Je vorige antwoord was ongeldig: ${previousError}\n` +
    `Geef het antwoord opnieuw, uitsluitend als geldige JSON volgens het schema uit de systeemprompt.`
  );
}

/**
 * Analyseert een vacaturetekst naar must-have skills, nice-to-have skills en
 * senioriteit. Gebruikt door scripts/match.ts vóórdat er gematcht kan worden.
 */
export async function analyseVacature(vacatureTekst: string): Promise<VacatureAnalysis> {
  return callClaudeJson(
    ANALYSEER_VACATURE_SYSTEM_PROMPT,
    (previousError) => buildUserMessage(vacatureTekst, previousError),
    vacatureAnalysisSchema,
    2048,
  );
}
