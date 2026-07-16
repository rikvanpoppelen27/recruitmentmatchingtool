import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@prisma/client";

import { extractCvText, getMimeType } from "../src/lib/cv/extract";
import { prisma } from "../src/lib/db/prisma";
import { parseCv, type ParsedCandidate } from "../src/lib/ai/parse-cv";
import { ensureCvsBucketExists, uploadCvFile } from "../src/lib/storage/supabase";

const SUPPORTED_EXTENSIONS = [".pdf", ".docx"];

async function resolveFilePaths(inputPath: string): Promise<string[]> {
  const stats = await stat(inputPath);

  if (stats.isDirectory()) {
    const entries = await readdir(inputPath);
    return entries
      .filter((entry) => SUPPORTED_EXTENSIONS.includes(path.extname(entry).toLowerCase()))
      .sort()
      .map((entry) => path.join(inputPath, entry));
  }

  return [inputPath];
}

function formatContact(value: string | null): string {
  return value ?? "⚠ ontbreekt";
}

function formatPhone(parsed: ParsedCandidate): string {
  if (parsed.phone) return parsed.phone;
  if (parsed.phoneRaw) return `${parsed.phoneRaw} (kon niet genormaliseerd worden)`;
  return "⚠ ontbreekt";
}

async function processFile(filePath: string, userId: string): Promise<"new" | "updated" | "failed"> {
  const fileName = path.basename(filePath);
  const buffer = await readFile(filePath);
  const hash = createHash("sha256").update(buffer).digest("hex");

  let extracted;
  try {
    extracted = await extractCvText(buffer, fileName);
  } catch (error) {
    console.error(`[parse-cv] ${fileName}: ${(error as Error).message}`);
    return "failed";
  }

  let parsed: ParsedCandidate;
  try {
    parsed = await parseCv(extracted.text);
  } catch (error) {
    console.error(`[parse-cv] ${fileName}: ${(error as Error).message}`);
    return "failed";
  }

  const mimeType = getMimeType(extracted.fileType);
  const existing = await prisma.candidate.findUnique({ where: { cvFileHash: hash } });

  const candidateData = {
    fullName: parsed.fullName,
    email: parsed.email,
    phone: parsed.phone,
    phoneRaw: parsed.phoneRaw,
    region: parsed.region,
    yearsExperience: parsed.yearsExperience,
    skills: parsed.skills,
    languages: parsed.languages,
    availability: parsed.availability,
    cvFileName: fileName,
    cvMimeType: mimeType,
    parsedAt: new Date(),
    rawParsedData: parsed.raw as unknown as Prisma.InputJsonValue,
  };

  let candidateId: string;
  let outcome: "new" | "updated";

  if (existing) {
    await prisma.candidate.update({
      where: { id: existing.id },
      data: {
        ...candidateData,
        educations: { deleteMany: {}, create: parsed.educations },
        workExperience: { deleteMany: {}, create: parsed.workExperience },
      },
    });
    candidateId = existing.id;
    outcome = "updated";
  } else {
    const created = await prisma.candidate.create({
      data: {
        ...candidateData,
        userId,
        cvFileUrl: "", // wordt hieronder bijgewerkt na upload
        cvFileHash: hash,
        educations: { create: parsed.educations },
        workExperience: { create: parsed.workExperience },
      },
    });
    candidateId = created.id;
    outcome = "new";
  }

  const storagePath = await uploadCvFile(candidateId, fileName, buffer, mimeType);
  await prisma.candidate.update({ where: { id: candidateId }, data: { cvFileUrl: storagePath } });

  console.log(
    `${parsed.fullName ?? "(naam onbekend)"} — e-mail: ${formatContact(parsed.email)}, ` +
      `telefoon: ${formatPhone(parsed)}, skills: ${parsed.skills.length}, ` +
      `ervaring: ${parsed.yearsExperience ?? "?"} jaar [${outcome === "new" ? "nieuw" : "bijgewerkt"}]`,
  );

  return outcome;
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Gebruik: npm run parse-cv -- <pad-naar-bestand-of-map>");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    throw new Error("Geen User gevonden. Draai eerst `npm run db:seed`.");
  }

  await ensureCvsBucketExists();

  const filePaths = await resolveFilePaths(inputPath);
  if (filePaths.length === 0) {
    console.error(`[parse-cv] Geen .pdf/.docx-bestanden gevonden in "${inputPath}".`);
    process.exitCode = 1;
    return;
  }

  let newCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

  for (const filePath of filePaths) {
    const outcome = await processFile(filePath, user.id);
    if (outcome === "new") newCount += 1;
    else if (outcome === "updated") updatedCount += 1;
    else failedCount += 1;
  }

  console.log(
    `\n=== Samenvatting parse-cv === nieuw=${newCount}, bijgewerkt=${updatedCount}, mislukt=${failedCount}`,
  );
}

main()
  .catch((error) => {
    console.error("[parse-cv] Onverwachte fout:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
