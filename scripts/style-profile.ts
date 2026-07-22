import "dotenv/config";

import path from "node:path";

import { Prisma } from "@prisma/client";

import { bouwStijlprofiel } from "../src/lib/ai/style-profile";
import { prisma } from "../src/lib/db/prisma";
import { importExampleEmails, type ParsedExampleEmail } from "../src/lib/mail/import-examples";
import type { StyleProfileContent } from "../src/lib/validation/mail";

const MAIL_EXAMPLES_DIR = path.join(__dirname, "..", "mail-examples");
const DEFAULT_USER_EMAIL = "recruiter@example.com";

function printProfile(profile: StyleProfileContent, representativeExamples: ParsedExampleEmail[]) {
  console.log("\n=== Stijlprofiel ===");
  console.log(`Aanhef: ${profile.aanhef}`);
  console.log(`Toon: ${profile.toon}`);
  console.log(`Zinslengte: ${profile.zinslengte}`);
  console.log(`Structuur: ${profile.structuur}`);
  console.log(`Introductiestijl kandidaat: ${profile.introductiestijlKandidaat}`);
  console.log(`Afsluiting: ${profile.afsluiting}`);
  console.log(`Typische formuleringen: ${profile.typischeFormuleringen.join(", ")}`);
  console.log(`Vermijdt: ${profile.vermijden.join(", ")}`);
  console.log(`Onderwerpsregel-patroon: ${profile.onderwerpsregelPatroon}`);
  console.log(`\nMeest representatieve voorbeelden: ${representativeExamples.map((e) => e.fileName).join(", ")}`);
}

async function main() {
  const mask = process.argv.includes("--mask");

  const { examples, warnings } = await importExampleEmails(MAIL_EXAMPLES_DIR, { maskContactInfo: mask });

  for (const warning of warnings) {
    console.warn(`⚠ ${warning}`);
  }

  if (examples.length === 0) {
    console.error(`Geen voorbeeldmails gevonden in "${MAIL_EXAMPLES_DIR}", kan geen stijlprofiel opbouwen.`);
    process.exitCode = 1;
    return;
  }

  const { profile, representativeExamples } = await bouwStijlprofiel(examples);

  const user = await prisma.user.findUniqueOrThrow({ where: { email: DEFAULT_USER_EMAIL } });

  const exampleEmailData = representativeExamples.map((e) => ({
    subject: e.subject ?? "(geen onderwerpsregel)",
    body: e.body,
  }));

  await prisma.styleProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      content: profile as unknown as Prisma.InputJsonValue,
      exampleEmails: { create: exampleEmailData },
    },
    update: {
      content: profile as unknown as Prisma.InputJsonValue,
      exampleEmails: { deleteMany: {}, create: exampleEmailData },
    },
  });

  printProfile(profile, representativeExamples);
}

main()
  .catch((error) => {
    console.error("[style-profile] Onverwachte fout:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
