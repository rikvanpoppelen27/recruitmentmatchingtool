import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { generateFrontsheetForMatch, type GenerateFrontsheetResult } from "../src/lib/pdf/generateFrontsheet";
import { closeBrowser } from "../src/lib/pdf/render";

function printResult(result: GenerateFrontsheetResult) {
  console.log(`Match ${result.matchId}: ${result.storagePath} (${result.pageCount} pagina's)`);
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
        const result = await generateFrontsheetForMatch(id);
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

  const result = await generateFrontsheetForMatch(arg);
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
