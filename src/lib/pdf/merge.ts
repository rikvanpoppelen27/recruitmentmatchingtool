import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

import { branding } from "../../config/branding";
import { downloadFile } from "../storage/supabase";

const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// ---------------------------------------------------------------------------
// DOCX -> PDF via LibreOffice headless
// ---------------------------------------------------------------------------

function checkLibreOfficeAvailable(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("soffice", ["--version"]);
    proc.on("error", () => {
      reject(
        new Error(
          "LibreOffice ('soffice') is niet gevonden — nodig om DOCX-CV's naar PDF te converteren. " +
            "Installeer het via https://www.libreoffice.org/download/ " +
            "(Windows: 'winget install TheDocumentFoundation.LibreOffice', macOS: 'brew install --cask libreoffice') " +
            "en zorg dat 'soffice' in je PATH staat.",
        ),
      );
    });
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`'soffice --version' gaf een onverwachte exit-code (${code}).`));
    });
  });
}

async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  await checkLibreOfficeAvailable();

  const dir = await mkdtemp(path.join(tmpdir(), "recruitmenttool-docx-"));
  const inputPath = path.join(dir, "input.docx");
  const outputPath = path.join(dir, "input.pdf");

  try {
    await writeFile(inputPath, docxBuffer);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("soffice", ["--headless", "--convert-to", "pdf", "--outdir", dir, inputPath]);
      let stderr = "";
      proc.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      proc.on("error", reject);
      proc.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`LibreOffice-conversie naar PDF mislukt (exit-code ${code}): ${stderr}`));
      });
    });

    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Anonimisering
// ---------------------------------------------------------------------------

interface RedactionTargets {
  email: string | null;
  phone: string | null;
}

interface RedactionOutcome {
  buffer: Buffer;
  warnings: string[];
}

/**
 * Best-effort tekst-redactie in een DOCX: vervangt exacte voorkomens van
 * e-mailadres/telefoonnummer in word/document.xml door "[VERWIJDERD]" vóór
 * conversie naar PDF. Dit is échte verwijdering (geen visuele overlay) omdat
 * DOCX platte XML/tekst is. Betrouwbaarheid is niet 100%: Word splitst tekst
 * soms over meerdere `<w:t>`-runs (spellingscontrole, revisies) waardoor een
 * aaneengesloten string niet gevonden wordt — in dat geval een expliciete
 * waarschuwing i.p.v. stilzwijgend niets doen.
 */
async function redactDocx(docxBuffer: Buffer, targets: RedactionTargets): Promise<RedactionOutcome> {
  const warnings: string[] = [];
  const zip = await JSZip.loadAsync(docxBuffer);
  const documentXmlFile = zip.file("word/document.xml");

  if (!documentXmlFile) {
    warnings.push("Anonimisering niet mogelijk: word/document.xml niet gevonden in het DOCX-bestand.");
    return { buffer: docxBuffer, warnings };
  }

  let xml = await documentXmlFile.async("string");

  const fields: Array<[string, string | null]> = [
    ["e-mailadres", targets.email],
    ["telefoonnummer", targets.phone],
  ];

  for (const [label, value] of fields) {
    if (!value) continue;
    if (xml.includes(value)) {
      xml = xml.split(value).join("[VERWIJDERD]");
    } else {
      warnings.push(
        `Anonimisering: ${label} "${value}" is niet aaneengesloten teruggevonden in het CV-document ` +
          `(mogelijk opgesplitst over meerdere tekstfragmenten door Word) — controleer het CV handmatig.`,
      );
    }
  }

  zip.file("word/document.xml", xml);
  const buffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
  return { buffer, warnings };
}

// ---------------------------------------------------------------------------
// CV ophalen + omzetten naar PDF (incl. optionele anonimisering)
// ---------------------------------------------------------------------------

export interface CandidateCvInfo {
  cvFileUrl: string;
  cvMimeType: string;
  email: string | null;
  phone: string | null;
}

export interface PreparedCv {
  pdfBuffer: Buffer;
  warnings: string[];
}

function getCvsBucketName(): string {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_CVS;
  if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET_CVS moet gezet zijn in de environment (.env).");
  return bucket;
}

/**
 * Haalt het originele CV op uit Supabase Storage en levert het als PDF-buffer
 * (DOCX wordt via LibreOffice geconverteerd). Past optioneel anonimisering
 * toe — betrouwbaar voor DOCX, voor PDF-bronnen wordt in plaats daarvan een
 * expliciete waarschuwing teruggegeven (zie modulecommentaar bij
 * `redactDocx`). `anonymizeCV` valt terug op `config/branding.ts` zodat
 * bestaande CLI-aanroepen ongewijzigd blijven werken; fase 6's
 * /instellingen-pagina geeft hier de uit de database opgehaalde waarde door.
 */
export async function prepareCvAsPdf(
  candidate: CandidateCvInfo,
  anonymizeCV: boolean = branding.anonymizeCV,
): Promise<PreparedCv> {
  const bucket = getCvsBucketName();
  const originalBuffer = await downloadFile(bucket, candidate.cvFileUrl);
  const isDocx = candidate.cvMimeType === DOCX_MIME_TYPE;

  if (isDocx) {
    let bufferToConvert = originalBuffer;
    let warnings: string[] = [];

    if (anonymizeCV) {
      const redaction = await redactDocx(originalBuffer, { email: candidate.email, phone: candidate.phone });
      bufferToConvert = redaction.buffer;
      warnings = redaction.warnings;
    }

    const pdfBuffer = await convertDocxToPdf(bufferToConvert);
    return { pdfBuffer, warnings };
  }

  // PDF-bron: betrouwbare tekst-redactie (contentstream-niveau, geen visuele
  // overlay) is niet geïmplementeerd. Een cosmetische overlay zou de
  // contactgegevens nog steeds extraheerbaar laten — dat is gevaarlijker dan
  // waarschuwen, dus expliciet melden i.p.v. stilzwijgend niets doen.
  const warnings: string[] = [];
  if (anonymizeCV) {
    warnings.push(
      "Anonimisering staat aan, maar betrouwbare tekst-redactie in CV's die al als PDF zijn " +
        "aangeleverd is niet geïmplementeerd (alleen voor DOCX-bronnen). Contactgegevens staan nog " +
        "zichtbaar in het bijgevoegde CV.",
    );
  }
  return { pdfBuffer: originalBuffer, warnings };
}

// ---------------------------------------------------------------------------
// Samenvoegen: frontsheet eerst, dan het CV
// ---------------------------------------------------------------------------

export interface MergedPresentation {
  buffer: Buffer;
  pageCount: number;
}

/** Voegt de frontsheet-PDF en de CV-PDF samen — frontsheet-pagina's eerst. */
export async function mergeFrontsheetWithCv(frontsheetPdf: Buffer, cvPdf: Buffer): Promise<MergedPresentation> {
  const merged = await PDFDocument.create();

  const frontsheetDoc = await PDFDocument.load(frontsheetPdf);
  const frontsheetPages = await merged.copyPages(frontsheetDoc, frontsheetDoc.getPageIndices());
  for (const page of frontsheetPages) merged.addPage(page);

  const cvDoc = await PDFDocument.load(cvPdf);
  const cvPages = await merged.copyPages(cvDoc, cvDoc.getPageIndices());
  for (const page of cvPages) merged.addPage(page);

  const bytes = await merged.save();
  return { buffer: Buffer.from(bytes), pageCount: merged.getPageCount() };
}
