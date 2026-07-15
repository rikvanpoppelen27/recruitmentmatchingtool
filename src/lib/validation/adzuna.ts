import { z } from "zod";

/**
 * Subset van de Adzuna job-shape die we daadwerkelijk gebruiken. `id` komt
 * soms als number, soms als string terug — genormaliseerd naar string.
 */
export const adzunaJobSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((value) => String(value)),
  title: z.string(),
  description: z.string(),
  created: z.string(),
  redirect_url: z.string(),
  salary_min: z.number().nullable().optional(),
  salary_max: z.number().nullable().optional(),
  company: z.object({
    display_name: z.string(),
  }),
  location: z.object({
    display_name: z.string(),
  }),
});

export const adzunaSearchResponseSchema = z.object({
  results: z.array(adzunaJobSchema),
  count: z.number().optional(),
  mean: z.number().optional(),
});

export type AdzunaJob = z.infer<typeof adzunaJobSchema>;
export type AdzunaSearchResponse = z.infer<typeof adzunaSearchResponseSchema>;
