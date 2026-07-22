import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface ParsedExampleEmail {
  fileName: string;
  /** Null als de eerste regel niet met "Onderwerp:" begint — geen onderwerp verzonnen. */
  subject: string | null;
  body: string;
}

export interface ContactInfoFinding {
  fileName: string;
  type: "email" | "telefoonnummer";
  value: string;
}

export interface ImportExamplesResult {
  examples: ParsedExampleEmail[];
  warnings: string[];
  contactInfoFindings: ContactInfoFinding[];
}

const MIN_RECOMMENDED_EXAMPLES = 5;
const SUBJECT_LINE_PATTERN = /^Onderwerp:\s*(.+)$/i;

// Best-effort herkenning van NL-formaten (mobiel 06/+31 6, vast 0XX-XXXXXXX).
// Geen uitputtende PII-scanner — vandaar de expliciete waarschuwing i.p.v.
// stilzwijgend aannemen dat alles gevonden is.
const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX =
  /(?:\+31[\s-]?|0)(?:6[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}|[1-9]\d?[\s-]?\d{3}[\s-]?\d{4})/g;

export function parseExampleEmail(fileName: string, raw: string): ParsedExampleEmail {
  const normalized = raw.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const match = SUBJECT_LINE_PATTERN.exec(lines[0]?.trim() ?? "");

  if (match) {
    return { fileName, subject: match[1].trim(), body: lines.slice(1).join("\n").trim() };
  }
  return { fileName, subject: null, body: normalized.trim() };
}

export function findContactInfo(fileName: string, text: string): ContactInfoFinding[] {
  const findings: ContactInfoFinding[] = [];
  for (const m of text.matchAll(EMAIL_REGEX)) {
    findings.push({ fileName, type: "email", value: m[0] });
  }
  for (const m of text.matchAll(PHONE_REGEX)) {
    findings.push({ fileName, type: "telefoonnummer", value: m[0] });
  }
  return findings;
}

export function maskContactInfo(text: string): string {
  return text.replace(EMAIL_REGEX, "[GEMASKEERD]").replace(PHONE_REGEX, "[GEMASKEERD]");
}

/**
 * Leest voorbeeldmails (.txt/.md, één mail per bestand) uit `dir`. Waarschuwt
 * bij minder dan 5 voorbeelden (onbetrouwbaar stijlprofiel) en bij gevonden
 * e-mailadressen/telefoonnummers van derden. `maskContactInfo: true` maskeert
 * die vondsten vóórdat de tekst verder verwerkt of opgeslagen wordt.
 */
export async function importExampleEmails(
  dir: string,
  options: { maskContactInfo?: boolean } = {},
): Promise<ImportExamplesResult> {
  let fileNames: string[];
  try {
    fileNames = (await readdir(dir)).filter((f) => f.endsWith(".txt") || f.endsWith(".md"));
  } catch {
    throw new Error(
      `Map met voorbeeldmails "${dir}" bestaat niet. Maak 'm aan en zet er minimaal ${MIN_RECOMMENDED_EXAMPLES} voorbeeldmails (.txt of .md) in.`,
    );
  }

  const warnings: string[] = [];
  const contactInfoFindings: ContactInfoFinding[] = [];
  const examples: ParsedExampleEmail[] = [];

  for (const fileName of fileNames.sort()) {
    const raw = await readFile(path.join(dir, fileName), "utf-8");
    contactInfoFindings.push(...findContactInfo(fileName, raw));

    const content = options.maskContactInfo ? maskContactInfo(raw) : raw;
    examples.push(parseExampleEmail(fileName, content));
  }

  if (examples.length < MIN_RECOMMENDED_EXAMPLES) {
    warnings.push(
      `Slechts ${examples.length} voorbeeldmail(s) gevonden in "${dir}" (aanbevolen: minimaal ${MIN_RECOMMENDED_EXAMPLES}) — het stijlprofiel wordt hierdoor onbetrouwbaar.`,
    );
  }

  if (contactInfoFindings.length > 0 && !options.maskContactInfo) {
    const affectedFiles = new Set(contactInfoFindings.map((f) => f.fileName)).size;
    warnings.push(
      `${contactInfoFindings.length} mogelijk persoonsgegeven(s) (e-mail/telefoonnummer) gevonden in ${affectedFiles} voorbeeldmail(s) — draai met --mask om deze te maskeren vóór opslag in het stijlprofiel.`,
    );
  }

  return { examples, warnings, contactInfoFindings };
}
