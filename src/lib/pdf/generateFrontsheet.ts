import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@prisma/client";

import { genereerFrontsheet, type FrontsheetInput } from "../ai/frontsheet";
import { prisma } from "../db/prisma";
import type { FrontsheetContent } from "../validation/ai";
import { getEffectiveBrandingSettings } from "../settings";
import { ensureBucketExists, uploadFile } from "../storage/supabase";
import { mergeFrontsheetWithCv, prepareCvAsPdf } from "./merge";
import { renderHtmlToPdf } from "./render";
import { loadFrontsheetTemplate, renderFrontsheetHtml } from "./template";

// process.cwd() i.p.v. __dirname — zie de toelichting in lib/pdf/template.ts.
const OUTPUT_DIR = path.join(process.cwd(), "output");

function getPresentationsBucketName(): string {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_PRESENTATIONS;
  if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET_PRESENTATIONS moet gezet zijn in de environment (.env).");
  return bucket;
}

const COMBINING_DIACRITICS_START = 0x0300;
const COMBINING_DIACRITICS_END = 0x036f;

function stripDiacritics(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code < COMBINING_DIACRITICS_START || code > COMBINING_DIACRITICS_END;
    })
    .join("");
}

function slugify(value: string): string {
  return stripDiacritics(value.normalize("NFD"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface GenerateFrontsheetResult {
  matchId: string;
  storagePath: string;
  pageCount: number;
  warnings: string[];
}

type MatchWithRelations = NonNullable<Awaited<ReturnType<typeof fetchMatchWithRelations>>>;

/** Haalt een match op met alle relaties die de frontsheet-pipeline nodig heeft (candidate/vacancy). */
export async function fetchMatchWithRelations(matchId: string) {
  return prisma.match.findUnique({
    where: { id: matchId },
    include: {
      candidate: { include: { educations: true, workExperience: true } },
      vacancy: true,
    },
  });
}

/** Bouwt de input voor genereerFrontsheet/verfijnFrontsheet uit een opgehaalde match. */
export function buildFrontsheetInput(match: MatchWithRelations): FrontsheetInput {
  const { candidate, vacancy } = match;
  return {
    candidate: {
      fullName: candidate.fullName,
      yearsExperience: candidate.yearsExperience,
      skills: candidate.skills,
      workExperience: candidate.workExperience.map((w) => ({
        jobTitle: w.jobTitle,
        employer: w.employer,
        period: w.period,
        description: w.description,
      })),
      educations: candidate.educations.map((e) => ({
        institution: e.institution,
        degree: e.degree,
        fieldOfStudy: e.fieldOfStudy,
      })),
    },
    vacancy: {
      title: vacancy.title,
      companyName: vacancy.companyName,
      description: vacancy.description,
      mustHaveSkills: vacancy.mustHaveSkills,
      niceToHaveSkills: vacancy.niceToHaveSkills,
    },
    match: {
      score: match.score,
      matchedSkills: match.matchedSkills,
      missingSkills: match.missingSkills,
      rationale: match.rationale,
    },
  };
}

/**
 * Rendert frontsheet-inhoud naar HTML → PDF, voegt 'm samen met het CV
 * (frontsheet eerst), uploadt naar de presentations-bucket en werkt het
 * Frontsheet-record bij. Gedeeld door de initiële generatie
 * (generateFrontsheetForMatch), chatverfijning (refineFrontsheetForMatch) en
 * het terugzetten van een eerdere versie (restoreFrontsheetRevision) — dit
 * is precies het stuk dat in alle drie identiek is, alleen de herkomst van
 * `content` verschilt (nieuw van Claude, verfijnd van Claude, of uit een
 * eerdere FrontsheetRevision).
 */
export async function renderAndPersistFrontsheet(
  match: MatchWithRelations,
  content: FrontsheetContent,
): Promise<GenerateFrontsheetResult> {
  const { candidate, vacancy } = match;
  const brandingSettings = await getEffectiveBrandingSettings();

  const template = await loadFrontsheetTemplate();
  const html = renderFrontsheetHtml(template, {
    logoUrl: brandingSettings.logoUrl,
    companyName: brandingSettings.companyName,
    primaryColor: brandingSettings.primaryColor,
    candidateName: candidate.fullName ?? "Naam onbekend",
    vacancyTitle: vacancy.title,
    vacancyCompany: vacancy.companyName,
    summary: content.summary,
    whyThisMatch: content.whyThisMatch,
    experienceBullets: content.highlightedExperience,
    skills: candidate.skills,
    education: candidate.educations.map((e) => [e.degree, e.fieldOfStudy, e.institution].filter(Boolean).join(", ")),
    languages: candidate.languages.length > 0 ? candidate.languages.join(", ") : "Niet vermeld",
    availability: candidate.availability ?? "Niet vermeld",
    footerText: brandingSettings.footerText,
  });

  const frontsheetPdf = await renderHtmlToPdf(html);
  const { pdfBuffer: cvPdf, warnings: cvWarnings } = await prepareCvAsPdf(
    {
      cvFileUrl: candidate.cvFileUrl,
      cvMimeType: candidate.cvMimeType,
      email: candidate.email,
      phone: candidate.phone,
    },
    brandingSettings.anonymizeCV,
  );

  const { buffer: mergedPdf, pageCount } = await mergeFrontsheetWithCv(frontsheetPdf, cvPdf);

  const candidateSlug = slugify(candidate.fullName ?? candidate.id);
  const companySlug = slugify(vacancy.companyName);
  const fileName = `${candidateSlug}-${companySlug}.pdf`;
  const storagePath = `${match.id}/${fileName}`;

  const bucket = getPresentationsBucketName();
  await ensureBucketExists(bucket);
  await uploadFile(bucket, storagePath, mergedPdf, "application/pdf");

  await prisma.frontsheet.upsert({
    where: { matchId: match.id },
    create: {
      matchId: match.id,
      content: content as unknown as Prisma.InputJsonValue,
      presentationPdfUrl: storagePath,
      generatedAt: new Date(),
    },
    update: {
      content: content as unknown as Prisma.InputJsonValue,
      presentationPdfUrl: storagePath,
      generatedAt: new Date(),
    },
  });

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(path.join(OUTPUT_DIR, fileName), mergedPdf);

  return { matchId: match.id, storagePath, pageCount, warnings: cvWarnings };
}

/**
 * Genereert de frontsheet-inhoud, rendert deze naar PDF, voegt 'm samen met
 * het CV (frontsheet eerst) en uploadt het resultaat naar de
 * presentations-bucket. Gedeelde implementatie voor scripts/frontsheet.ts
 * (CLI) en de "Genereer presentatiedocument"-knop op /matches/[id] (route
 * handler POST /api/matches/[id]/frontsheet). Bureaunaam/voettekst/
 * anonimisering komen uit lib/settings.ts (databaseoverride, anders
 * config/branding.ts).
 */
export async function generateFrontsheetForMatch(matchId: string): Promise<GenerateFrontsheetResult> {
  const match = await fetchMatchWithRelations(matchId);
  if (!match) {
    throw new Error(`Match "${matchId}" niet gevonden.`);
  }

  const frontsheetInput = buildFrontsheetInput(match);
  const content = await genereerFrontsheet(frontsheetInput);
  return renderAndPersistFrontsheet(match, content);
}
