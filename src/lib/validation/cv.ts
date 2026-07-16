import { z } from "zod";

export const cvWorkExperienceSchema = z.object({
  jobTitle: z.string().nullable(),
  employer: z.string().nullable(),
  period: z.string().nullable(),
  description: z.string().nullable(),
});

export const cvEducationSchema = z.object({
  institution: z.string().nullable(),
  degree: z.string().nullable(),
  fieldOfStudy: z.string().nullable(),
  startYear: z.number().nullable(),
  endYear: z.number().nullable(),
});

/**
 * Vorm van de rauwe Claude-respons vóór de code-level nabewerking
 * (e-mailvalidatie, telefoonnormalisatie, skills-lowercasing).
 */
export const parsedCvSchema = z.object({
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  region: z.string().nullable(),
  skills: z.array(z.string()),
  yearsExperience: z.number().nullable(),
  workExperience: z.array(cvWorkExperienceSchema),
  educations: z.array(cvEducationSchema),
  languages: z.array(z.string()),
  availability: z.string().nullable(),
});

export type ParsedCv = z.infer<typeof parsedCvSchema>;
export type CvWorkExperience = z.infer<typeof cvWorkExperienceSchema>;
export type CvEducation = z.infer<typeof cvEducationSchema>;
