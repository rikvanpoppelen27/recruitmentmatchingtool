import "dotenv/config";

import type { MailVariant } from "../src/lib/ai/mail";
import { prisma } from "../src/lib/db/prisma";
import { generateMailDraftForMatch, getStyleProfileWithExamples } from "../src/lib/mail/generateMailDraft";

const VALID_VARIANTS: MailVariant[] = ["standaard", "korter", "formeler", "informeler"];

function parseVariantArg(args: string[]): MailVariant {
  const variantArg = args.find((a) => a.startsWith("--variant="));
  if (!variantArg) return "standaard";
  const value = variantArg.split("=")[1];
  if (!VALID_VARIANTS.includes(value as MailVariant)) {
    throw new Error(`Ongeldige --variant "${value}". Geldige waarden: ${VALID_VARIANTS.join(", ")}.`);
  }
  return value as MailVariant;
}

function printDraft(draft: { matchId: string; variant: MailVariant; subject: string; body: string }) {
  console.log(`\n=== Concept voor match ${draft.matchId} (variant: ${draft.variant}) ===`);
  console.log(`Onderwerp: ${draft.subject}\n`);
  console.log(draft.body);
  console.log(`\nCONCEPT — niet verzonden. Controleer voor gebruik.`);
}

async function main() {
  const args = process.argv.slice(2);
  const arg = args[0];

  if (!arg) {
    console.error(
      "Gebruik: npm run mail -- <matchId> [--variant=korter|formeler|informeler]  of  npm run mail -- --all-kansrijk",
    );
    process.exitCode = 1;
    return;
  }

  const variant = parseVariantArg(args);
  const styleProfile = await getStyleProfileWithExamples();
  if (!styleProfile) {
    throw new Error('Nog geen stijlprofiel gevonden. Draai eerst "npm run style-profile".');
  }

  if (arg === "--all-kansrijk") {
    const matches = await prisma.match.findMany({
      where: { isPromising: true, emailDrafts: { none: {} } },
      select: { id: true },
    });

    if (matches.length === 0) {
      console.log("Geen kansrijke matches zonder bestaand mailconcept gevonden.");
      return;
    }

    console.log(`${matches.length} kansrijke match(es) zonder bestaand concept gevonden.`);
    let succeeded = 0;
    let failed = 0;

    for (const { id } of matches) {
      try {
        const draft = await generateMailDraftForMatch(id, variant, styleProfile);
        printDraft(draft);
        succeeded += 1;
      } catch (error) {
        console.error(`Match ${id} mislukt: ${(error as Error).message}`);
        failed += 1;
      }
    }

    console.log(`\n=== Samenvatting mail === geslaagd=${succeeded}, mislukt=${failed}`);
    return;
  }

  const draft = await generateMailDraftForMatch(arg, variant, styleProfile);
  printDraft(draft);
}

main()
  .catch((error) => {
    console.error("[mail] Onverwachte fout:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
