import { Prisma } from "@prisma/client";

import { verfijnFrontsheet } from "../ai/frontsheet";
import { prisma } from "../db/prisma";
import type { FrontsheetContent } from "../validation/ai";
import { buildFrontsheetInput, fetchMatchWithRelations, renderAndPersistFrontsheet, type GenerateFrontsheetResult } from "./generateFrontsheet";

export interface RefineFrontsheetResult extends GenerateFrontsheetResult {
  revisionId: string;
  toelichting: string | null;
}

/**
 * Chatverfijning (fase 6B): past de bestaande frontsheet aan op basis van een
 * instructie in gewone taal, rendert/samenvoegt/uploadt opnieuw, en slaat de
 * ronde op als FrontsheetRevision (geschiedenis, terug te zetten via
 * restoreFrontsheetRevision).
 */
export async function refineFrontsheetForMatch(matchId: string, instruction: string): Promise<RefineFrontsheetResult> {
  const match = await fetchMatchWithRelations(matchId);
  if (!match) {
    throw new Error(`Match "${matchId}" niet gevonden.`);
  }

  const existing = await prisma.frontsheet.findUnique({ where: { matchId } });
  if (!existing) {
    throw new Error("Genereer eerst een presentatiedocument voordat je 'm kunt verfijnen.");
  }

  const frontsheetInput = buildFrontsheetInput(match);
  const previousContent = existing.content as unknown as FrontsheetContent;
  const refinement = await verfijnFrontsheet(frontsheetInput, previousContent, instruction);

  const result = await renderAndPersistFrontsheet(match, refinement.content);

  const revision = await prisma.frontsheetRevision.create({
    data: {
      matchId,
      instruction,
      resultJson: refinement.content as unknown as Prisma.InputJsonValue,
    },
  });

  return { ...result, revisionId: revision.id, toelichting: refinement.toelichting };
}

/** Zet de frontsheet terug naar een eerdere revisie (rendert/samenvoegt/uploadt opnieuw, geen nieuwe AI-call). */
export async function restoreFrontsheetRevision(matchId: string, revisionId: string): Promise<GenerateFrontsheetResult> {
  const match = await fetchMatchWithRelations(matchId);
  if (!match) {
    throw new Error(`Match "${matchId}" niet gevonden.`);
  }

  const revision = await prisma.frontsheetRevision.findUnique({ where: { id: revisionId } });
  if (!revision || revision.matchId !== matchId) {
    throw new Error("Revisie niet gevonden voor deze match.");
  }

  const content = revision.resultJson as unknown as FrontsheetContent;
  return renderAndPersistFrontsheet(match, content);
}
