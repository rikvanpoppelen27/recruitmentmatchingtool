import { Prisma, type SearchProfile } from "@prisma/client";

import { getProvinceByCode } from "../../config/provinces";
import { dedupeAgainstExisting, dedupeWithinRun, normalize } from "../dedupe";
import { prisma } from "../db/prisma";
import { compileBooleanQuery } from "../search/boolean-query";
import { AdzunaAdapter } from "../sources/adzuna";
import type { Vacancy } from "../../types/vacancy";

type FetchedVacancy = Vacancy & { profileId: string };

export interface ProfileImportSummary {
  profileId: string;
  profileName: string;
  fetched: number;
  new: number;
  alreadyKnown: number;
  errors: string[];
}

export interface ImportSummary {
  perProfile: ProfileImportSummary[];
  totalFetched: number;
  totalNew: number;
  totalAlreadyKnown: number;
  totalDuplicatesWithinRun: number;
  /** Fatale fouten die geen enkel profiel raakten (bv. geen actieve profielen, geen Market). */
  errors: string[];
}

const adapter = new AdzunaAdapter();

/** Haalt vacatures op voor één zoekprofiel, over al zijn provincies en (evt. opgesplitste) query-clauses heen. */
async function fetchForProfile(profile: SearchProfile): Promise<{ vacancies: FetchedVacancy[]; errors: string[] }> {
  const errors: string[] = [];
  const vacancies: FetchedVacancy[] = [];

  let clauses;
  try {
    clauses = compileBooleanQuery(profile.query);
  } catch (error) {
    errors.push(`Ongeldige zoekterm: ${(error as Error).message}`);
    return { vacancies, errors };
  }

  for (const provinceCode of profile.provinces) {
    const province = getProvinceByCode(provinceCode);
    if (!province) {
      errors.push(`Onbekende provinciecode "${provinceCode}" — overgeslagen.`);
      continue;
    }

    for (const clause of clauses) {
      try {
        const results = await adapter.fetchVacancies({
          clause,
          titleOnly: profile.titleOnly,
          where: province.adzunaWhere,
          maxDaysOld: profile.maxDaysOld,
        });
        vacancies.push(...results.map((v) => ({ ...v, profileId: profile.id })));
      } catch (error) {
        errors.push(`${province.name}: ${(error as Error).message}`);
      }
    }
  }

  return { vacancies, errors };
}

/**
 * Dedupliceert (binnen de run én tegen bestaande data, met lib/dedupe.ts uit
 * fase 1) en slaat nieuwe vacatures op. Werkt de betrokken zoekprofielen
 * bij (`lastRunAt`/`resultCount`) en geeft per-profiel tellingen terug.
 */
async function persistAndSummarize(
  profiles: SearchProfile[],
  fetchedByProfile: Map<string, FetchedVacancy[]>,
  errorsByProfile: Map<string, string[]>,
): Promise<ProfileImportSummary[]> {
  const market = await prisma.market.findFirst({ orderBy: { createdAt: "asc" } });
  if (!market) {
    throw new Error("Geen Market gevonden. Draai eerst `npm run db:seed` om een default gebruiker + markt aan te maken.");
  }

  const allFetched = profiles.flatMap((p) => fetchedByProfile.get(p.id) ?? []);
  const { unique, duplicatesWithinRun: _duplicatesWithinRun } = dedupeWithinRun(allFetched);

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
        source: "ADZUNA",
        createdBy: "IMPORT",
      })),
      skipDuplicates: true,
    });
  }

  const now = new Date();
  const summaries: ProfileImportSummary[] = [];

  for (const profile of profiles) {
    const fetched = fetchedByProfile.get(profile.id) ?? [];
    const newCount = toInsert.filter((v) => v.profileId === profile.id).length;
    const alreadyKnownCount = toTouch.filter((v) => v.profileId === profile.id).length;

    await prisma.searchProfile.update({
      where: { id: profile.id },
      data: { lastRunAt: now, resultCount: fetched.length },
    });

    summaries.push({
      profileId: profile.id,
      profileName: profile.name,
      fetched: fetched.length,
      new: newCount,
      alreadyKnown: alreadyKnownCount,
      errors: errorsByProfile.get(profile.id) ?? [],
    });
  }

  return summaries;
}

/**
 * Haalt vacatures op voor alle actieve zoekprofielen en dedupliceert.
 * Vervangt de vroegere hardcoded config/import.ts-lus (fase 1) — wát en
 * wáár gezocht wordt komt nu volledig uit `SearchProfile`. Gedeelde
 * implementatie voor scripts/import.ts (CLI) en de "Vacatures
 * importeren"-knop op / (route handler POST /api/import/run).
 */
export async function runImport(): Promise<ImportSummary> {
  const profiles = await prisma.searchProfile.findMany({ where: { isActive: true } });
  if (profiles.length === 0) {
    return {
      perProfile: [],
      totalFetched: 0,
      totalNew: 0,
      totalAlreadyKnown: 0,
      totalDuplicatesWithinRun: 0,
      errors: ["Geen actieve zoekprofielen gevonden. Maak er één aan via /zoekprofielen."],
    };
  }

  const fetchedByProfile = new Map<string, FetchedVacancy[]>();
  const errorsByProfile = new Map<string, string[]>();

  for (const profile of profiles) {
    const { vacancies, errors } = await fetchForProfile(profile);
    fetchedByProfile.set(profile.id, vacancies);
    errorsByProfile.set(profile.id, errors);
  }

  const allFetched = profiles.flatMap((p) => fetchedByProfile.get(p.id) ?? []);
  const { duplicatesWithinRun } = dedupeWithinRun(allFetched);
  const perProfile = await persistAndSummarize(profiles, fetchedByProfile, errorsByProfile);

  return {
    perProfile,
    totalFetched: perProfile.reduce((sum, p) => sum + p.fetched, 0),
    totalNew: perProfile.reduce((sum, p) => sum + p.new, 0),
    totalAlreadyKnown: perProfile.reduce((sum, p) => sum + p.alreadyKnown, 0),
    totalDuplicatesWithinRun: duplicatesWithinRun,
    errors: [],
  };
}

/**
 * Voert precies één zoekprofiel meteen uit ("Nu uitvoeren" op
 * /zoekprofielen), ongeacht of het actief staat.
 */
export async function runSearchProfileNow(profileId: string): Promise<ProfileImportSummary> {
  const profile = await prisma.searchProfile.findUnique({ where: { id: profileId } });
  if (!profile) {
    throw new Error(`Zoekprofiel "${profileId}" niet gevonden.`);
  }

  const { vacancies, errors } = await fetchForProfile(profile);
  const [summary] = await persistAndSummarize(
    [profile],
    new Map([[profile.id, vacancies]]),
    new Map([[profile.id, errors]]),
  );
  return summary;
}
