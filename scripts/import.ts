import "dotenv/config";

import { importConfig } from "../src/config/import";
import { prisma } from "../src/lib/db/prisma";
import { runImport } from "../src/lib/import/runImport";

async function main() {
  const summary = await runImport();

  for (const error of summary.errors) {
    console.error(`[import] Fout bij ${error}`);
  }

  console.log("\n=== Samenvatting import ===");
  for (const r of summary.perRegion) {
    console.log(
      `${r.region}: opgehaald=${r.fetched}, duplicaten-in-run=${r.duplicatesWithinRun}, ` +
        `al-bekend=${r.alreadyKnown}, nieuw-opgeslagen=${r.new}`,
    );
  }
  console.log(
    `Totaal: opgehaald=${summary.totalFetched}, duplicaten-in-run=${summary.totalDuplicatesWithinRun}, ` +
      `al-bekend=${summary.totalAlreadyKnown}, nieuw-opgeslagen=${summary.totalNew}`,
  );

  const sumPerRegionDuplicates = summary.perRegion.reduce((sum, r) => sum + r.duplicatesWithinRun, 0);
  if (sumPerRegionDuplicates !== summary.totalDuplicatesWithinRun) {
    console.warn(
      `[import] Let op: som per regio (${sumPerRegionDuplicates}) wijkt af van het globale ` +
        `duplicatenaantal (${summary.totalDuplicatesWithinRun}) — dit kan gebeuren als dezelfde vacature ` +
        `via twee regio's is opgehaald.`,
    );
  }

  // importConfig wordt hier alleen gebruikt om regio's te loggen als er geen enkele fetch is gelukt.
  if (summary.totalFetched === 0 && summary.errors.length === importConfig.searchTerms.length * importConfig.regions.length) {
    console.error("[import] Geen enkele zoekterm/regio-combinatie is gelukt.");
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[import] Onverwachte fout:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
