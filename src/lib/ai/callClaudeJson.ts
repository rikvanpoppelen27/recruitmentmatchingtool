import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";

const MAX_RETRIES = 2;

export function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY moet gezet zijn in de environment (.env).");
  }
  return new Anthropic({ apiKey });
}

export function getModel(): string {
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

/**
 * Gedeelde retry-met-Zod-validatie-loop voor Claude-calls die uitsluitend
 * JSON teruggeven. Bij ongeldige JSON of een schema-mismatch wordt de
 * foutmelding aan Claude teruggegeven voor een nieuwe poging (max
 * `MAX_RETRIES` keer); daarna een nette failure. `buildUserMessage` krijgt de
 * fout van de vorige poging (`null` bij de eerste poging) en bouwt daarmee
 * het volgende user-bericht.
 */
export async function callClaudeJson<T>(
  systemPrompt: string,
  buildUserMessage: (previousError: string | null) => string,
  schema: ZodType<T>,
  maxTokens = 4096,
): Promise<T> {
  const client = getClient();
  const model = getModel();

  let lastError: string | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: buildUserMessage(lastError) }],
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

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      lastError = `JSON voldeed niet aan het verwachte schema: ${parsed.error.message}`;
      continue;
    }

    return parsed.data;
  }

  throw new Error(`Claude-aanroep mislukt na ${MAX_RETRIES + 1} pogingen. Laatste fout: ${lastError}`);
}
