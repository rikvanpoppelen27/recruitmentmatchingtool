import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { runImport } from "../src/lib/import/runImport";

async function main() {
  const summary = await runImport();

  for (const error of summary.errors) {
    console.error(`[import] ${error}`);
  }

  console.log("\n=== Samenvatting import (per zoekprofiel) ===");
  for (const p of summary.perProfile) {
    console.log(
      `${p.profileName}: opgehaald=${p.fetched}, al-bekend=${p.alreadyKnown}, nieuw-opgeslagen=${p.new}`,
    );
    for (const error of p.errors) {
      console.error(`  [import] ${error}`);
    }
  }

  console.log(
    `Totaal: opgehaald=${summary.totalFetched}, duplicaten-in-run=${summary.totalDuplicatesWithinRun}, ` +
      `al-bekend=${summary.totalAlreadyKnown}, nieuw-opgeslagen=${summary.totalNew}`,
  );
}

main()
  .catch((error) => {
    console.error("[import] Onverwachte fout:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
