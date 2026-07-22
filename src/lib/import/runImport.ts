import { Prisma } from "@prisma/client";

import { importConfig } from "../../config/import";
import { dedupeAgainstExisting, dedupeWithinRun, normalize } from "../dedupe";
import { prisma } from "../db/prisma";
import { AdzunaAdapter } from "../sources/adzuna";
import type { Vacancy } from "../../types/vacancy";

export interface RegionImportSummary {
  region: string;
  fetched: number;
  duplicatesWithinRun: number;
  alreadyKnown: number;
  new: number;
}

export interface ImportSummary {
  perRegion: RegionImportSummary[];
  totalFetched: number;
  totalDuplicatesWithinRun: number;
  totalAlreadyKnown: number;
  totalNew: number;
  errors: string[];
}

/**
 * Haalt vacatures op voor alle zoekterm/regio-combinaties uit config/import.ts,
 * dedupliceert (binnen de run én tegen bestaande data) en slaat nieuwe
 * vacatures op. Gedeelde implementatie voor scripts/import.ts (CLI) en de
 * "Vacatures importeren"-knop op / (route handler POST /api/import/run) —
 * zo geven CLI en interface gegarandeerd hetzelfde resultaat.
 */
export async function runImport(): Promise<ImportSummary> {
  const market = await prisma.market.findFirst({ orderBy: { createdAt: "asc" } });
  if (!market) {
    throw new Error("Geen Market gevonden. Draai eerst `npm run db:seed` om een default gebruiker + markt aan te maken.");
  }

  const adapter = new AdzunaAdapter();

  const allFetched: Vacancy[] = [];
  const fetchedCountByRegion = new Map<string, number>();
  for (const region of importConfig.regions) {
    fetchedCountByRegion.set(region, 0);
  }

  const errors: string[] = [];

  for (const searchTerm of importConfig.searchTerms) {
    for (const region of importConfig.regions) {
      try {
        const vacancies = await adapter.fetchVacancies({ what: searchTerm, where: region });
        allFetched.push(...vacancies);
        fetchedCountByRegion.set(region, (fetchedCountByRegion.get(region) ?? 0) + vacancies.length);
      } catch (error) {
        errors.push(`"${searchTerm}" in ${region}: ${(error as Error).message}`);
      }
    }
  }

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
        importSource: vacancy.source,
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

  const perRegion: RegionImportSummary[] = importConfig.regions.map((region) => {
    const fetched = fetchedCountByRegion.get(region) ?? 0;
    const uniqueForRegion = unique.filter((v) => v.region === region).length;
    return {
      region,
      fetched,
      duplicatesWithinRun: fetched - uniqueForRegion,
      alreadyKnown: toTouch.filter((v) => v.region === region).length,
      new: toInsert.filter((v) => v.region === region).length,
    };
  });

  return {
    perRegion,
    totalFetched: perRegion.reduce((sum, r) => sum + r.fetched, 0),
    totalDuplicatesWithinRun: duplicatesWithinRun,
    totalAlreadyKnown: perRegion.reduce((sum, r) => sum + r.alreadyKnown, 0),
    totalNew: perRegion.reduce((sum, r) => sum + r.new, 0),
    errors,
  };
}
