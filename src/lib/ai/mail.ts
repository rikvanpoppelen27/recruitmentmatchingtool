import { callClaudeJson } from "./callClaudeJson";
import type { FrontsheetInputCandidate, FrontsheetInputMatch, FrontsheetInputVacancy } from "./frontsheet";
import { mailContentSchema, type MailContent, type StyleProfileContent } from "../validation/mail";

export type MailVariant = "standaard" | "korter" | "formeler" | "informeler";

export const GENEREER_MAIL_SYSTEM_PROMPT = `Je schrijft een concept-introductiemail waarin een recruiter een kandidaat
voorstelt aan een opdrachtgever voor een specifieke vacature. Dit is ALTIJD een concept dat de recruiter zelf
beoordeelt en eventueel aanpast — er wordt niets automatisch verzonden.

KERNREGELS:
1. Neem de schrijfstijl uit het meegegeven stijlprofiel volledig over: aanhef, toon, zinslengte, opbouw en
   afsluiting. De meegestuurde voorbeeldmails zijn uitsluitend stijlreferentie — haal er nooit feiten, namen of
   cijfers over de kandidaat of vacature uit.
2. Baseer alle inhoud UITSLUITEND op het aangeleverde kandidaat- en vacatureprofiel. Verzin nooit ervaring,
   werkgevers, opleidingen, beschikbaarheid of tarieven die niet letterlijk zijn aangeleverd.
3. Noem geen contactgegevens (e-mailadres, telefoonnummer) van de kandidaat in de mail.
4. Verwijs naar de bijgevoegde frontsheet/het CV als dat past bij de schrijfstijl van deze recruiter.
5. Houd het kort: standaard maximaal 200 woorden, tenzij de voorbeeldmails duidelijk langer zijn — volg in dat
   geval de lengte die uit de voorbeelden blijkt.
6. Antwoord UITSLUITEND met geldige JSON. Geen markdown-codeblokken (geen \`\`\`), geen toelichting.

Retourneer exact dit JSON-schema:
{
  "subject": string,
  "body": string
}`;

const VARIANT_INSTRUCTIONS: Record<MailVariant, string | null> = {
  standaard: null,
  korter:
    "Schrijf een merkbaar kortere versie dan je standaard zou doen (streef naar circa 100-120 woorden), met behoud van de kernboodschap en de schrijfstijl.",
  formeler:
    "Schrijf formeler dan het stijlprofiel aangeeft (bijvoorbeeld 'u' in plaats van 'jij/je'), met behoud van de overige kenmerkende stijlelementen.",
  informeler:
    "Schrijf losser/informeler dan het stijlprofiel aangeeft, met behoud van de overige kenmerkende stijlelementen.",
};

export interface MailInput {
  candidate: FrontsheetInputCandidate;
  vacancy: FrontsheetInputVacancy;
  match: FrontsheetInputMatch;
  styleProfile: StyleProfileContent;
  exampleEmails: Array<{ subject: string; body: string }>;
}

function buildUserMessage(
  input: MailInput,
  variant: MailVariant,
  templateInstruction: string | null,
  previousError: string | null,
): string {
  const payload = JSON.stringify(
    { candidate: input.candidate, vacancy: input.vacancy, match: input.match, styleProfile: input.styleProfile },
    null,
    2,
  );
  const examplesText = input.exampleEmails
    .map((e, i) => `--- Stijlvoorbeeld ${i + 1} ---\nOnderwerp: ${e.subject}\n${e.body}`)
    .join("\n\n");
  const variantInstruction = VARIANT_INSTRUCTIONS[variant];

  const base =
    `Schrijf de conceptmail voor deze kandidaat-vacature-combinatie, in de stijl van het meegeleverde profiel en de voorbeelden:\n\n${payload}\n\n` +
    `Stijlvoorbeelden (uitsluitend als stijlreferentie, geen inhoudelijke bron):\n\n${examplesText}` +
    (templateInstruction ? `\n\nInstructie vanuit het gekozen mailtemplate: ${templateInstruction}` : "") +
    (variantInstruction ? `\n\nExtra instructie voor deze variant: ${variantInstruction}` : "");

  if (previousError === null) return base;
  return (
    `${base}\n\nJe vorige antwoord was ongeldig: ${previousError}\n` +
    `Geef het antwoord opnieuw, uitsluitend als geldige JSON volgens het schema uit de systeemprompt.`
  );
}

/**
 * Genereert een conceptmail voor één match. `variant` laat alternatieven
 * genereren (korter/formeler/informeler) zonder de systeemprompt te
 * herschrijven; elke aanroep levert een nieuw, los concept op — nooit een
 * overschrijving van een eerder concept (zie scripts/mail.ts). `templateInstruction`
 * (fase 6B) is de instructietekst van een gekozen `MailTemplate` en wordt als
 * extra context mee aangeleverd, naast (niet in plaats van) het stijlprofiel.
 */
export async function genereerMail(
  input: MailInput,
  variant: MailVariant = "standaard",
  templateInstruction: string | null = null,
): Promise<MailContent> {
  return callClaudeJson(
    GENEREER_MAIL_SYSTEM_PROMPT,
    (previousError) => buildUserMessage(input, variant, templateInstruction, previousError),
    mailContentSchema,
    2048,
  );
}
