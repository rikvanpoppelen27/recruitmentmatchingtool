import "dotenv/config";

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../src/lib/db/prisma";
import { processCvUpload } from "../src/lib/cv/processCvUpload";
import { ensureCvsBucketExists } from "../src/lib/storage/supabase";

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

function formatPhone(phone: string | null, phoneRaw: string | null): string {
  if (phone) return phone;
  if (phoneRaw) return `${phoneRaw} (kon niet genormaliseerd worden)`;
  return "⚠ ontbreekt";
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
    const fileName = path.basename(filePath);
    try {
      const buffer = await readFile(filePath);
      const result = await processCvUpload(buffer, fileName, user.id);

      if (result.outcome === "new") newCount += 1;
      else updatedCount += 1;

      console.log(
        `${result.fullName ?? "(naam onbekend)"} — e-mail: ${formatContact(result.email)}, ` +
          `telefoon: ${formatPhone(result.phone, result.phoneRaw)}, skills: ${result.skillCount}, ` +
          `ervaring: ${result.yearsExperience ?? "?"} jaar [${result.outcome === "new" ? "nieuw" : "bijgewerkt"}]`,
      );
    } catch (error) {
      console.error(`[parse-cv] ${fileName}: ${(error as Error).message}`);
      failedCount += 1;
    }
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
