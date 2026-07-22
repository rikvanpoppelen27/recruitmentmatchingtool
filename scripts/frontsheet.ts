import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@prisma/client";

import { branding } from "../src/config/branding";
import { prisma } from "../src/lib/db/prisma";
import { genereerFrontsheet, type FrontsheetInput } from "../src/lib/ai/frontsheet";
import { mergeFrontsheetWithCv, prepareCvAsPdf } from "../src/lib/pdf/merge";
import { closeBrowser, renderHtmlToPdf } from "../src/lib/pdf/render";
import { loadFrontsheetTemplate, renderFrontsheetHtml } from "../src/lib/pdf/template";
import { ensureBucketExists, uploadFile } from "../src/lib/storage/supabase";

const OUTPUT_DIR = path.join(__dirname, "..", "output");

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

interface ProcessResult {
  matchId: string;
  path: string;
  pageCount: number;
  warnings: string[];
}

async function processMatch(matchId: string): Promise<ProcessResult> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      candidate: { include: { educations: true, workExperience: true } },
      vacancy: true,
    },
  });

  if (!match) {
    throw new Error(`Match "${matchId}" niet gevonden.`);
  }

  const { candidate, vacancy } = match;

  const frontsheetInput: FrontsheetInput = {
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

  const content = await genereerFrontsheet(frontsheetInput);

  const template = await loadFrontsheetTemplate();
  const html = renderFrontsheetHtml(template, {
    logoUrl: branding.logoUrl,
    companyName: branding.companyName,
    primaryColor: branding.primaryColor,
    candidateName: candidate.fullName ?? "Naam onbekend",
    vacancyTitle: vacancy.title,
    vacancyCompany: vacancy.companyName,
    summary: content.summary,
    whyThisMatch: content.whyThisMatch,
    experienceBullets: content.highlightedExperience,
    skills: candidate.skills,
    education: candidate.educations.map((e) =>
      [e.degree, e.fieldOfStudy, e.institution].filter(Boolean).join(", "),
    ),
    languages: candidate.languages.length > 0 ? candidate.languages.join(", ") : "Niet vermeld",
    availability: candidate.availability ?? "Niet vermeld",
    footerText: branding.footerText,
  });

  const frontsheetPdf = await renderHtmlToPdf(html);
  const { pdfBuffer: cvPdf, warnings: cvWarnings } = await prepareCvAsPdf({
    cvFileUrl: candidate.cvFileUrl,
    cvMimeType: candidate.cvMimeType,
    email: candidate.email,
    phone: candidate.phone,
  });

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
  const localPath = path.join(OUTPUT_DIR, fileName);
  await writeFile(localPath, mergedPdf);

  return { matchId: match.id, path: storagePath, pageCount, warnings: cvWarnings };
}

function printResult(result: ProcessResult) {
  console.log(`Match ${result.matchId}: ${result.path} (${result.pageCount} pagina's)`);
  for (const warning of result.warnings) {
    console.log(`  ⚠ ${warning}`);
  }
}

async function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.error("Gebruik: npm run frontsheet -- <matchId>  of  npm run frontsheet -- --all-kansrijk");
    process.exitCode = 1;
    return;
  }

  if (arg === "--all-kansrijk") {
    const matches = await prisma.match.findMany({
      where: { isPromising: true, frontsheet: { is: null } },
      select: { id: true },
    });

    if (matches.length === 0) {
      console.log("Geen kansrijke matches zonder bestaand presentatiedocument gevonden.");
      return;
    }

    console.log(`${matches.length} kansrijke match(es) zonder bestaand document gevonden.`);
    let succeeded = 0;
    let failed = 0;

    for (const { id } of matches) {
      try {
        const result = await processMatch(id);
        printResult(result);
        succeeded += 1;
      } catch (error) {
        console.error(`Match ${id} mislukt: ${(error as Error).message}`);
        failed += 1;
      }
    }

    console.log(`\n=== Samenvatting frontsheet === geslaagd=${succeeded}, mislukt=${failed}`);
    return;
  }

  const result = await processMatch(arg);
  printResult(result);
}

main()
  .catch((error) => {
    console.error("[frontsheet] Onverwachte fout:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeBrowser();
    await prisma.$disconnect();
  });
