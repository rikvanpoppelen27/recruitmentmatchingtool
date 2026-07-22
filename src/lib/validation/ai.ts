import { z } from "zod";

/** Output van lib/ai/analyseVacature.ts. */
export const vacatureAnalysisSchema = z.object({
  mustHaveSkills: z.array(z.string()),
  niceToHaveSkills: z.array(z.string()),
  seniority: z.string().nullable(),
});

export type VacatureAnalysis = z.infer<typeof vacatureAnalysisSchema>;

/** Output van lib/ai/match.ts (laag 2, semantische beoordeling). */
export const semanticMatchResultSchema = z.object({
  score: z.number().min(0).max(100),
  rationale: z.string(),
});

export type SemanticMatchResult = z.infer<typeof semanticMatchResultSchema>;

/** Output van lib/ai/frontsheet.ts (genereerFrontsheet). */
export const frontsheetContentSchema = z.object({
  summary: z.string(),
  whyThisMatch: z.string(),
  highlightedExperience: z.array(z.string()),
});

export type FrontsheetContent = z.infer<typeof frontsheetContentSchema>;
