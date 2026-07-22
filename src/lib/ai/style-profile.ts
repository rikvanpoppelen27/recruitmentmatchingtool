import { callClaudeJson } from "./callClaudeJson";
import { makeBouwStijlprofielResultSchema, type StyleProfileContent } from "../validation/mail";
import type { ParsedExampleEmail } from "../mail/import-examples";

export const BOUW_STIJLPROFIEL_SYSTEM_PROMPT = `Je analyseert een reeks voorbeeldmails van één recruiter en beschrijft diens
persoonlijke schrijfstijl, zodat toekomstige introductiemails in dezelfde stijl geschreven kunnen worden.

KERNREGELS:
1. Beschrijf UITSLUITEND wat je daadwerkelijk in de aangeleverde voorbeelden waarneemt. Verzin geen stijlkenmerken
   die niet door de voorbeelden onderbouwd worden.
2. Baseer "typischeFormuleringen" en "vermijden" op concrete, herhaalde patronen over meerdere voorbeelden heen —
   niet op één toevallige zin uit één mail.
3. Wijs de 3 voorbeelden aan die het meest representatief zijn voor deze stijl (de nummers zoals aangegeven in de
   input), via "meestRepresentatieveVoorbeelden".
4. Antwoord UITSLUITEND met geldige JSON. Geen markdown-codeblokken (geen \`\`\`), geen toelichting.

Retourneer exact dit JSON-schema:
{
  "aanhef": string,
  "toon": string,
  "zinslengte": "kort" | "gemiddeld" | "lang",
  "structuur": string,
  "introductiestijlKandidaat": string,
  "afsluiting": string,
  "typischeFormuleringen": string[],
  "vermijden": string[],
  "onderwerpsregelPatroon": string,
  "meestRepresentatieveVoorbeelden": number[]
}`;

export interface StijlprofielResult {
  profile: StyleProfileContent;
  representativeExamples: ParsedExampleEmail[];
}

function buildUserMessage(examples: ParsedExampleEmail[], previousError: string | null): string {
  const numbered = examples
    .map((e, i) => `--- Voorbeeld ${i + 1} ---\nOnderwerp: ${e.subject ?? "(geen onderwerpsregel)"}\n${e.body}`)
    .join("\n\n");
  const base = `Hier zijn ${examples.length} voorbeeldmails van deze recruiter, genummerd 1 t/m ${examples.length}:\n\n${numbered}`;

  if (previousError === null) return base;
  return (
    `${base}\n\nJe vorige antwoord was ongeldig: ${previousError}\n` +
    `Geef het antwoord opnieuw, uitsluitend als geldige JSON volgens het schema uit de systeemprompt.`
  );
}

/**
 * Bouwt eenmalig (per recruiter) een stijlprofiel op uit voorbeeldmails, en
 * laat de AI in dezelfde call de 3 meest representatieve voorbeelden
 * aanwijzen — die worden later als few-shot-referentie meegestuurd bij
 * mailgeneratie, in plaats van de volledige mailhistorie (tokenverbruik).
 */
export async function bouwStijlprofiel(examples: ParsedExampleEmail[]): Promise<StijlprofielResult> {
  if (examples.length === 0) {
    throw new Error("Geen voorbeeldmails aangeleverd — kan geen stijlprofiel opbouwen.");
  }

  const schema = makeBouwStijlprofielResultSchema(examples.length);
  const raw = await callClaudeJson(
    BOUW_STIJLPROFIEL_SYSTEM_PROMPT,
    (previousError) => buildUserMessage(examples, previousError),
    schema,
    2048,
  );

  const { meestRepresentatieveVoorbeelden, ...profile } = raw;
  const representativeExamples = meestRepresentatieveVoorbeelden.map((index) => examples[index - 1]);

  return { profile, representativeExamples };
}
