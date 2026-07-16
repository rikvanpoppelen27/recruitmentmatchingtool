import Anthropic from "@anthropic-ai/sdk";

import { normalizePhone } from "../cv/normalizePhone";
import { parsedCvSchema, type ParsedCv } from "../validation/cv";

const MAX_RETRIES = 2;

export const PARSE_CV_SYSTEM_PROMPT = `Je bent een CV-parser voor een recruitment-tool. Je krijgt de platte tekst van één CV en zet deze om naar gestructureerde JSON.

KERNREGELS:
1. Antwoord UITSLUITEND met geldige JSON. Geen markdown-codeblokken (geen \`\`\`), geen toelichting, geen tekst vóór of na de JSON.
2. Neem ALLEEN gegevens over die LETTERLIJK in de CV-tekst staan. Staat iets niet expliciet vermeld, geef dan null (of een lege array) terug. Dit geldt OOK voor e-mailadres en telefoonnummer: staan die niet letterlijk in de tekst, geef dan null terug. Verzin, gok of vul NOOIT gegevens aan — ook niet als het logisch zou lijken.
3. "skills" geef je terug als array van losse, genormaliseerde termen in lowercase (bv. "React" -> "react", "Node.JS" -> "node.js").
4. "availability" (beschikbaarheid) vul je alleen in als dit expliciet in het CV staat (bv. "per direct beschikbaar", "opzegtermijn 1 maand"); anders null.

Retourneer exact dit JSON-schema, met precies deze velden:
{
  "fullName": string | null,
  "email": string | null,
  "phone": string | null,
  "region": string | null,
  "skills": string[],
  "yearsExperience": number | null,
  "workExperience": [{ "jobTitle": string | null, "employer": string | null, "period": string | null, "description": string | null }],
  "educations": [{ "institution": string | null, "degree": string | null, "fieldOfStudy": string | null, "startYear": number | null, "endYear": number | null }],
  "languages": string[],
  "availability": string | null
}`;

export interface ParsedCandidate {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  phoneRaw: string | null;
  region: string | null;
  skills: string[];
  yearsExperience: number | null;
  workExperience: ParsedCv["workExperience"];
  educations: ParsedCv["educations"];
  languages: string[];
  availability: string | null;
  /** De rauwe, gevalideerde Claude-respons vóór nabewerking — voor audit. */
  raw: ParsedCv;
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY moet gezet zijn in de environment (.env).");
  }
  return new Anthropic({ apiKey });
}

function getModel(): string {
  const model = process.env.ANTHROPIC_MODEL;
  if (!model) {
    throw new Error("ANTHROPIC_MODEL moet gezet zijn in de environment (.env).");
  }
  return model;
}

function stripMarkdownFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

function normalizeEmail(email: string | null): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(trimmed) ? trimmed : null;
}

/**
 * Parset CV-tekst naar gestructureerde kandidaatdata via de Anthropic API.
 * Bij ongeldige JSON of een schema-mismatch wordt de foutmelding aan Claude
 * teruggegeven voor een nieuwe poging (max `MAX_RETRIES` keer); daarna een
 * nette failure. E-mailvalidatie en telefoonnormalisatie gebeuren hierna in
 * code, niet door het model.
 */
export async function parseCv(cvText: string): Promise<ParsedCandidate> {
  const client = getClient();
  const model = getModel();

  let lastError: string | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const userMessage =
      lastError === null
        ? `CV-tekst:\n\n${cvText}`
        : `CV-tekst:\n\n${cvText}\n\nJe vorige antwoord was ongeldig: ${lastError}\nGeef het antwoord opnieuw, uitsluitend als geldige JSON volgens het schema uit de systeemprompt.`;

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: PARSE_CV_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      lastError = "Geen tekstblok in de respons van Claude.";
      continue;
    }

    let json: unknown;
    try {
      json = JSON.parse(stripMarkdownFences(textBlock.text));
    } catch (error) {
      lastError = `Kon de respons niet als JSON parsen: ${(error as Error).message}`;
      continue;
    }

    const parsed = parsedCvSchema.safeParse(json);
    if (!parsed.success) {
      lastError = `JSON voldeed niet aan het verwachte schema: ${parsed.error.message}`;
      continue;
    }

    return postProcess(parsed.data);
  }

  throw new Error(`parseCv is mislukt na ${MAX_RETRIES + 1} pogingen. Laatste fout: ${lastError}`);
}

function postProcess(data: ParsedCv): ParsedCandidate {
  const { phone, phoneRaw } = normalizePhone(data.phone);

  return {
    fullName: data.fullName,
    email: normalizeEmail(data.email),
    phone,
    phoneRaw,
    region: data.region,
    skills: data.skills.map((skill) => skill.toLowerCase().trim()).filter((skill) => skill.length > 0),
    yearsExperience: data.yearsExperience,
    workExperience: data.workExperience,
    educations: data.educations,
    languages: data.languages,
    availability: data.availability,
    raw: data,
  };
}
