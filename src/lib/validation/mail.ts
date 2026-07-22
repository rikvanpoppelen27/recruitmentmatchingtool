import { z } from "zod";

/** Gestructureerd stijlprofiel — output van lib/ai/style-profile.ts (bouwStijlprofiel). */
export const styleProfileContentSchema = z.object({
  aanhef: z.string(),
  toon: z.string(),
  zinslengte: z.enum(["kort", "gemiddeld", "lang"]),
  structuur: z.string(),
  introductiestijlKandidaat: z.string(),
  afsluiting: z.string(),
  typischeFormuleringen: z.array(z.string()),
  vermijden: z.array(z.string()),
  onderwerpsregelPatroon: z.string(),
});

export type StyleProfileContent = z.infer<typeof styleProfileContentSchema>;

/**
 * Schema voor de volledige bouwStijlprofiel-respons, inclusief de 3
 * meest-representatieve-voorbeelden-indices die de AI in dezelfde call
 * aanwijst. `exampleCount` wordt per aanroep meegegeven zodat de indices
 * (1-gebaseerd, verwijzend naar de aangeleverde voorbeeldenlijst) meteen op
 * geldigheid gecontroleerd worden — een ongeldige index triggert dezelfde
 * retry-met-foutmelding-loop als een schema-mismatch.
 */
export function makeBouwStijlprofielResultSchema(exampleCount: number) {
  return styleProfileContentSchema.extend({
    meestRepresentatieveVoorbeelden: z
      .array(z.number().int().min(1).max(exampleCount))
      .length(3)
      .refine((arr) => new Set(arr).size === arr.length, {
        message: "meestRepresentatieveVoorbeelden mag geen dubbele indices bevatten",
      }),
  });
}

export type BouwStijlprofielResult = z.infer<ReturnType<typeof makeBouwStijlprofielResultSchema>>;

/** Output van lib/ai/mail.ts (genereerMail). */
export const mailContentSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

export type MailContent = z.infer<typeof mailContentSchema>;
