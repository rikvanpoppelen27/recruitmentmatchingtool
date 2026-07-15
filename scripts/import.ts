import "dotenv/config";

import { Prisma } from "@prisma/client";

import { importConfig } from "../src/config/import";
import { dedupeAgainstExisting, dedupeWithinRun, normalize } from "../src/lib/dedupe";
import { prisma } from "../src/lib/db/prisma";
import { AdzunaAdapter } from "../src/lib/sources/adzuna";
import type { Vacancy } from "../src/types/vacancy";

async function main() {
  const market = await prisma.market.findFirst({ orderBy: { createdAt: "asc" } });
  if (!market) {
    throw new Error(
      "Geen Market gevonden. Draai eerst `npm run db:seed` om een default gebruiker + markt aan te maken.",
    );
  }

  const adapter = new AdzunaAdapter();

  const allFetched: Vacancy[] = [];
  const fetchedCountByRegion = new Map<string, number>();
  for (const region of importConfig.regions) {
    fetchedCountByRegion.set(region, 0);
  }

  for (const searchTerm of importConfig.searchTerms) {
    for (const region of importConfig.regions) {
      try {
        const vacancies = await adapter.fetchVacancies({ what: searchTerm, where: region });
        allFetched.push(...vacancies);
        fetchedCountByRegion.set(region, (fetchedCountByRegion.get(region) ?? 0) + vacancies.length);
        console.log(`[import] "${searchTerm}" in ${region}: ${vacancies.length} resultaten opgehaald.`);
      } catch (error) {
        console.error(`[import] Fout bij "${searchTerm}" in ${region}: ${(error as Error).message}`);
        // Nette foutafhandeling: deze combinatie overslaan, doorgaan met de volgende.
      }
    }
  }

  // Ontdubbeling binnen deze run (globaal — een dedupeHash is databasebreed
  // uniek, dus twee regio's mogen nooit dezelfde hash proberen op te slaan).
  const { unique, duplicatesWithinRun } = dedupeWithinRun(allFetched);

  const existing = await prisma.vacancy.findMany({
    where: { dedupeHash: { in: unique.map((v) => v.dedupeHash) } },
    select: { dedupeHash: true },
  });
  const existingHashes = new Set(existing.map((v) => v.dedupeHash));

  const { toInsert, toTouch } = dedupeAgainstExisting(unique, existingHashes);

  if (toTouch.length > 0) {
    await prisma.vacancy.updateMany({
      where: { dedupeHash: { in: toTouch.map((v) => v.dedupeHash) } },
      data: { lastSeenAt: new Date() },
    });
  }

  if (toInsert.length > 0) {
    await prisma.vacancy.createMany({
      data: toInsert.map((vacancy) => ({
        marketId: market.id,
        source: vacancy.source,
        externalId: vacancy.externalId,
        region: vacancy.region,
        companyName: vacancy.companyName,
        companyNameNormalized: normalize(vacancy.companyName),
        title: vacancy.title,
        titleNormalized: normalize(vacancy.title),
        location: vacancy.location,
        description: vacancy.description,
        url: vacancy.url,
        salaryMin: vacancy.salaryMin,
        salaryMax: vacancy.salaryMax,
        postedAt: vacancy.postedAt,
        dedupeHash: vacancy.dedupeHash,
        rawData: vacancy.rawData as Prisma.InputJsonValue,
        lastSeenAt: new Date(),
      })),
      skipDuplicates: true,
    });
  }

  console.log("\n=== Samenvatting import ===");

  let totalFetched = 0;
  let totalDuplicatesWithinRun = 0;
  let totalAlreadyKnown = 0;
  let totalNew = 0;

  for (const region of importConfig.regions) {
    const fetched = fetchedCountByRegion.get(region) ?? 0;
    const uniqueForRegion = unique.filter((v) => v.region === region).length;
    const duplicatesForRegion = fetched - uniqueForRegion;
    const newForRegion = toInsert.filter((v) => v.region === region).length;
    const alreadyKnownForRegion = toTouch.filter((v) => v.region === region).length;

    console.log(
      `${region}: opgehaald=${fetched}, duplicaten-in-run=${duplicatesForRegion}, ` +
        `al-bekend=${alreadyKnownForRegion}, nieuw-opgeslagen=${newForRegion}`,
    );

    totalFetched += fetched;
    totalDuplicatesWithinRun += duplicatesForRegion;
    totalAlreadyKnown += alreadyKnownForRegion;
    totalNew += newForRegion;
  }

  console.log(
    `Totaal: opgehaald=${totalFetched}, duplicaten-in-run=${totalDuplicatesWithinRun}, ` +
      `al-bekend=${totalAlreadyKnown}, nieuw-opgeslagen=${totalNew}`,
  );

  // Sanity check: duplicatesWithinRun (globaal, uit dedupeWithinRun) moet
  // gelijk zijn aan de som van de per-regio afgeleide duplicaten hierboven.
  if (totalDuplicatesWithinRun !== duplicatesWithinRun) {
    console.warn(
      `[import] Let op: som per regio (${totalDuplicatesWithinRun}) wijkt af van het globale ` +
        `duplicatenaantal (${duplicatesWithinRun}) — dit kan gebeuren als dezelfde vacature ` +
        `via twee regio's is opgehaald.`,
    );
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
