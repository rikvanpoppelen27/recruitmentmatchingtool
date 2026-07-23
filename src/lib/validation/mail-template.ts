import { z } from "zod";

export const mailTemplateInputSchema = z.object({
  name: z.string().min(1, "Naam is verplicht."),
  description: z.string().optional(),
  systemInstruction: z.string().min(1, "Instructie is verplicht."),
  isDefault: z.boolean().default(false),
});

export type MailTemplateInput = z.infer<typeof mailTemplateInputSchema>;

export const mailTemplateUpdateSchema = z.object({
  name: z.string().min(1, "Naam is verplicht.").optional(),
  description: z.string().optional(),
  systemInstruction: z.string().min(1, "Instructie is verplicht.").optional(),
  isDefault: z.boolean().optional(),
});

export type MailTemplateUpdate = z.infer<typeof mailTemplateUpdateSchema>;
