import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

/** Input voor het handmatig-vacature-toevoegen-formulier (fase 6B). */
export const manualVacancyInputSchema = z.object({
  title: z.string().min(1, "Functietitel is verplicht."),
  companyName: z.string().min(1, "Bedrijf is verplicht."),
  description: z.string().min(1, "Vacaturetekst is verplicht."),
  location: z.preprocess(emptyToUndefined, z.string().optional()),
  sourceUrl: z.preprocess(emptyToUndefined, z.string().url("Ongeldige URL.").optional()),
  contactPerson: z.preprocess(emptyToUndefined, z.string().optional()),
  /** Bevestiging om toch op te slaan ondanks een gevonden duplicaat. */
  force: z.boolean().optional(),
});

export type ManualVacancyInput = z.infer<typeof manualVacancyInputSchema>;
