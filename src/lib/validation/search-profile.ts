import { z } from "zod";

import { isValidProvinceCode } from "../../config/provinces";
import { BooleanQuerySyntaxError, parseBooleanQuery } from "../search/boolean-query";

const queryField = z
  .string()
  .min(1, "Zoekterm is verplicht.")
  .superRefine((value, ctx) => {
    try {
      parseBooleanQuery(value);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof BooleanQuerySyntaxError ? error.message : "Ongeldige zoekterm.",
      });
    }
  });

const provincesField = z
  .array(z.string())
  .min(1, "Kies minimaal één provincie.")
  .superRefine((codes, ctx) => {
    for (const code of codes) {
      if (!isValidProvinceCode(code)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Onbekende provinciecode "${code}".` });
      }
    }
  });

export const searchProfileInputSchema = z.object({
  name: z.string().min(1, "Naam is verplicht."),
  query: queryField,
  provinces: provincesField,
  maxDaysOld: z.number().int().min(1, "Minimaal 1 dag.").max(90, "Maximaal 90 dagen.").default(7),
  titleOnly: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type SearchProfileInput = z.infer<typeof searchProfileInputSchema>;

export const searchProfileUpdateSchema = z.object({
  name: z.string().min(1, "Naam is verplicht.").optional(),
  query: queryField.optional(),
  provinces: provincesField.optional(),
  maxDaysOld: z.number().int().min(1, "Minimaal 1 dag.").max(90, "Maximaal 90 dagen.").optional(),
  titleOnly: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type SearchProfileUpdate = z.infer<typeof searchProfileUpdateSchema>;
