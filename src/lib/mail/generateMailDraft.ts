import { EmailVariant } from "@prisma/client";

import { genereerMail, type MailInput, type MailVariant } from "../ai/mail";
import { prisma } from "../db/prisma";
import type { StyleProfileContent } from "../validation/mail";

const VARIANT_TO_ENUM: Record<MailVariant, EmailVariant> = {
  standaard: EmailVariant.STANDAARD,
  korter: EmailVariant.KORTER,
  formeler: EmailVariant.FORMELER,
  informeler: EmailVariant.INFORMELER,
};

export interface StyleProfileWithExamples {
  content: StyleProfileContent;
  exampleEmails: Array<{ subject: string; body: string }>;
}

export async function getStyleProfileWithExamples(): Promise<StyleProfileWithExamples | null> {
  const styleProfile = await prisma.styleProfile.findFirst({ include: { exampleEmails: true } });
  if (!styleProfile) return null;
  return {
    content: styleProfile.content as unknown as StyleProfileContent,
    exampleEmails: styleProfile.exampleEmails.map((e) => ({ subject: e.subject, body: e.body })),
  };
}

export interface GeneratedMailDraft {
  id: string;
  matchId: string;
  variant: MailVariant;
  subject: string;
  body: string;
}

/**
 * Genereert een conceptmail voor één match in de stijl van het opgeslagen
 * stijlprofiel en slaat 'm op als een nieuw, los EmailDraft-record (nooit een
 * overschrijving — zie prisma/schema.prisma). Gedeelde implementatie voor
 * scripts/mail.ts (CLI) en /matches/[id] (route handler POST
 * /api/matches/[id]/mail) — zo geven CLI en interface gegarandeerd hetzelfde
 * resultaat.
 */
export async function generateMailDraftForMatch(
  matchId: string,
  variant: MailVariant,
  styleProfile: StyleProfileWithExamples,
): Promise<GeneratedMailDraft> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      candidate: { include: { educations: true, workExperience: true } },
      vacancy: true,
    },
  });

  if (!match) {
    throw new Error(`Match "${matchId}" niet gevonden.`);
  }

  const { candidate, vacancy } = match;

  const input: MailInput = {
    candidate: {
      fullName: candidate.fullName,
      yearsExperience: candidate.yearsExperience,
      skills: candidate.skills,
      workExperience: candidate.workExperience.map((w) => ({
        jobTitle: w.jobTitle,
        employer: w.employer,
        period: w.period,
        description: w.description,
      })),
      educations: candidate.educations.map((e) => ({
        institution: e.institution,
        degree: e.degree,
        fieldOfStudy: e.fieldOfStudy,
      })),
    },
    vacancy: {
      title: vacancy.title,
      companyName: vacancy.companyName,
      description: vacancy.description,
      mustHaveSkills: vacancy.mustHaveSkills,
      niceToHaveSkills: vacancy.niceToHaveSkills,
    },
    match: {
      score: match.score,
      matchedSkills: match.matchedSkills,
      missingSkills: match.missingSkills,
      rationale: match.rationale,
    },
    styleProfile: styleProfile.content,
    exampleEmails: styleProfile.exampleEmails,
  };

  const mail = await genereerMail(input, variant);

  const draft = await prisma.emailDraft.create({
    data: {
      matchId: match.id,
      subject: mail.subject,
      body: mail.body,
      variant: VARIANT_TO_ENUM[variant],
    },
  });

  return { id: draft.id, matchId: match.id, variant, subject: mail.subject, body: mail.body };
}
