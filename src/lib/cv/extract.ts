import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export type SupportedCvFileType = "pdf" | "docx";

export interface ExtractedCv {
  text: string;
  fileType: SupportedCvFileType;
}

const PDF_MAGIC = Buffer.from("25504446", "hex"); // "%PDF"
const ZIP_MAGIC = Buffer.from("504b0304", "hex"); // "PK\x03\x04" — ook DOCX (OOXML is een zip)

// Onder deze hoeveelheid niet-witruimte-tekens beschouwen we een PDF als
// (vrijwel) leeg — typisch een gescand document zonder tekstlaag.
const MIN_TEXT_CHARS = 20;

export function getMimeType(fileType: SupportedCvFileType): string {
  return fileType === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function detectFileType(fileName: string, buffer: Buffer): SupportedCvFileType {
  if (buffer.length === 0) {
    throw new Error(`Bestand "${fileName}" is leeg.`);
  }

  const ext = fileName.toLowerCase().split(".").pop();
  const startsWithPdfMagic = buffer.subarray(0, 4).equals(PDF_MAGIC);
  const startsWithZipMagic = buffer.subarray(0, 4).equals(ZIP_MAGIC);

  if (ext === "pdf") {
    if (!startsWithPdfMagic) {
      throw new Error(
        `Bestand "${fileName}" heeft de extensie .pdf, maar de inhoud is geen geldig ` +
          `PDF-bestand (mogelijk corrupt of onjuist hernoemd).`,
      );
    }
    return "pdf";
  }

  if (ext === "docx") {
    if (!startsWithZipMagic) {
      throw new Error(
        `Bestand "${fileName}" heeft de extensie .docx, maar de inhoud is geen geldig ` +
          `DOCX-bestand (mogelijk corrupt of onjuist hernoemd).`,
      );
    }
    return "docx";
  }

  if (startsWithPdfMagic || startsWithZipMagic) {
    throw new Error(
      `Bestand "${fileName}" heeft geen .pdf- of .docx-extensie, maar de inhoud lijkt ` +
        `wel op zo'n bestand. Hernoem het bestand naar de juiste extensie.`,
    );
  }

  throw new Error(
    `Bestand "${fileName}" heeft een niet-ondersteund bestandstype. Alleen .pdf en .docx ` +
      `worden ondersteund.`,
  );
}

function nonWhitespaceLength(text: string): number {
  return text.replace(/\s+/g, "").length;
}

async function extractFromPdf(fileName: string, buffer: Buffer): Promise<string> {
  let data;
  try {
    data = await pdfParse(buffer);
  } catch (error) {
    throw new Error(
      `Bestand "${fileName}" kon niet als PDF worden gelezen (mogelijk corrupt): ${(error as Error).message}`,
    );
  }

  const text = data.text.trim();
  if (nonWhitespaceLength(text) < MIN_TEXT_CHARS) {
    throw new Error(
      `Bestand "${fileName}" levert vrijwel geen tekst op — waarschijnlijk een gescand ` +
        `document (afbeelding zonder tekstlaag). OCR wordt nog niet ondersteund.`,
    );
  }

  return text;
}

async function extractFromDocx(fileName: string, buffer: Buffer): Promise<string> {
  let result;
  try {
    result = await mammoth.extractRawText({ buffer });
  } catch (error) {
    throw new Error(
      `Bestand "${fileName}" kon niet als DOCX worden gelezen (mogelijk corrupt): ${(error as Error).message}`,
    );
  }

  const text = result.value.trim();
  if (nonWhitespaceLength(text) === 0) {
    throw new Error(`Bestand "${fileName}" bevat geen leesbare tekst.`);
  }

  return text;
}

/**
 * Extraheert platte tekst uit een CV. Bepaalt het bestandstype op zowel de
 * extensie als de magic bytes (nooit alleen de extensie vertrouwen) en geeft
 * een duidelijke foutmelding bij een leeg, corrupt, niet-ondersteund of
 * (vermoedelijk) gescand bestand.
 */
export async function extractCvText(buffer: Buffer, fileName: string): Promise<ExtractedCv> {
  const fileType = detectFileType(fileName, buffer);
  const text = fileType === "pdf" ? await extractFromPdf(fileName, buffer) : await extractFromDocx(fileName, buffer);
  return { text, fileType };
}
