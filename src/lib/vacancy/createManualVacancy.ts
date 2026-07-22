import { randomUUID } from "node:crypto";

import { analyseVacature } from "../ai/analyseVacature";
import { prisma } from "../db/prisma";
import { computeDedupeHash, normalize } from "../dedupe";
import { detectSource } from "../sources/detect-source";
import type { ManualVacancyInput } from "../validation/vacancy";

export interface DuplicateVacancySummary {
  id: string;
  title: string;
  companyName: string;
  location: string;
  importedAt: Date;
}

export type CreateManualVacancyResult =
  | { status: "created"; vacancyId: string; source: string; sourceLabel: string }
  | { status: "duplicate"; existing: DuplicateVacancySummary };

/**
 * Voegt een handmatig ingevoerde vacature toe. Dedupliceert tegen bestaande
 * vacatures met dezelfde ontdubbelingslogica als fase 1's importrun
 * (genormaliseerde bedrijfsnaam + titel + plaats) — bij een treffer wordt
 * niets opgeslagen tenzij `force` is meegegeven. Herkent de bron uit de URL
 * en analyseert de vacaturetekst direct (fase 3, `analyseVacature`) zodat
 * skills/must-haves meteen beschikbaar zijn voor matching.
 */
export async function createManualVacancy(
  input: ManualVacancyInput,
  options: { force?: boolean } = {},
): Promise<CreateManualVacancyResult> {
  const location = input.location?.trim() || "Onbekend";
  const dedupeHash = computeDedupeHash(input.companyName, input.title, location);

  if (!options.force) {
    const existing = await prisma.vacancy.findUnique({
      where: { dedupeHash },
      select: { id: true, title: true, companyName: true, location: true, importedAt: true },
    });
    if (existing) {
      return { status: "duplicate", existing };
    }
  }

  const market = await prisma.market.findFirst({ orderBy: { createdAt: "asc" } });
  if (!market) {
    throw new Error("Geen Market gevonden. Draai eerst `npm run db:seed`.");
  }

  const detected = detectSource(input.sourceUrl ?? null);

  const vacancy = await prisma.vacancy.create({
    data: {
      marketId: market.id,
      importSource: "MANUAL",
      externalId: `manual-${randomUUID()}`,
      region: location,
      companyName: input.companyName,
      companyNameNormalized: normalize(input.companyName),
      title: input.title,
      titleNormalized: normalize(input.title),
      location,
      description: input.description,
      url: input.sourceUrl ?? "",
      dedupeHash,
      source: detected.source,
      sourceUrl: input.sourceUrl ?? null,
      contactPerson: input.contactPerson ?? null,
      createdBy: "MANUAL",
    },
  });

  try {
    const analysis = await analyseVacature(input.description);
    await prisma.vacancy.update({
      where: { id: vacancy.id },
      data: {
        mustHaveSkills: analysis.mustHaveSkills,
        niceToHaveSkills: analysis.niceToHaveSkills,
        seniority: analysis.seniority,
        analyzedAt: new Date(),
      },
    });
  } catch (error) {
    // Vacature blijft bestaan, ook als de analyse faalt — de bestaande
    // "analyzedAt IS NULL"-stap in runMatching pakt 'm later alsnog op.
    console.error(`[createManualVacancy] Analyse mislukt voor "${input.title}": ${(error as Error).message}`);
  }

  return { status: "created", vacancyId: vacancy.id, source: detected.source, sourceLabel: detected.label };
}
