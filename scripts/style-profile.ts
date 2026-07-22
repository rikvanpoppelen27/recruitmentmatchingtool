import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { rebuildStyleProfile } from "../src/lib/mail/buildStyleProfile";
import type { ParsedExampleEmail } from "../src/lib/mail/import-examples";
import type { StyleProfileContent } from "../src/lib/validation/mail";

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

  const result = await rebuildStyleProfile({ maskContactInfo: mask });

  for (const warning of result.warnings) {
    console.warn(`⚠ ${warning}`);
  }

  printProfile(result.profile, result.representativeExamples);
}

main()
  .catch((error) => {
    console.error("[style-profile] Onverwachte fout:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
