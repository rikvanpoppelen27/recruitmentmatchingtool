import "dotenv/config";

import { EmailVariant } from "@prisma/client";

import { genereerMail, type MailInput, type MailVariant as MailVariantLiteral } from "../src/lib/ai/mail";
import { prisma } from "../src/lib/db/prisma";
import type { StyleProfileContent } from "../src/lib/validation/mail";

const VARIANT_TO_ENUM: Record<MailVariantLiteral, EmailVariant> = {
  standaard: EmailVariant.STANDAARD,
  korter: EmailVariant.KORTER,
  formeler: EmailVariant.FORMELER,
  informeler: EmailVariant.INFORMELER,
};

const VALID_VARIANTS: MailVariantLiteral[] = ["standaard", "korter", "formeler", "informeler"];

function parseVariantArg(args: string[]): MailVariantLiteral {
  const variantArg = args.find((a) => a.startsWith("--variant="));
  if (!variantArg) return "standaard";
  const value = variantArg.split("=")[1];
  if (!VALID_VARIANTS.includes(value as MailVariantLiteral)) {
    throw new Error(`Ongeldige --variant "${value}". Geldige waarden: ${VALID_VARIANTS.join(", ")}.`);
  }
  return value as MailVariantLiteral;
}

interface StyleProfileWithExamples {
  content: StyleProfileContent;
  exampleEmails: Array<{ subject: string; body: string }>;
}

async function getStyleProfileWithExamples(): Promise<StyleProfileWithExamples> {
  const styleProfile = await prisma.styleProfile.findFirst({ include: { exampleEmails: true } });
  if (!styleProfile) {
    throw new Error('Nog geen stijlprofiel gevonden. Draai eerst "npm run style-profile".');
  }
  return {
    content: styleProfile.content as unknown as StyleProfileContent,
    exampleEmails: styleProfile.exampleEmails.map((e) => ({ subject: e.subject, body: e.body })),
  };
}

interface GeneratedDraft {
  matchId: string;
  variant: MailVariantLiteral;
  subject: string;
  body: string;
}

async function processMatch(
  matchId: string,
  variant: MailVariantLiteral,
  styleProfile: StyleProfileWithExamples,
): Promise<GeneratedDraft> {
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

  await prisma.emailDraft.create({
    data: {
      matchId: match.id,
      subject: mail.subject,
      body: mail.body,
      variant: VARIANT_TO_ENUM[variant],
    },
  });

  return { matchId: match.id, variant, subject: mail.subject, body: mail.body };
}

function printDraft(draft: GeneratedDraft) {
  console.log(`\n=== Concept voor match ${draft.matchId} (variant: ${draft.variant}) ===`);
  console.log(`Onderwerp: ${draft.subject}\n`);
  console.log(draft.body);
  console.log(`\nCONCEPT — niet verzonden. Controleer voor gebruik.`);
}

async function main() {
  const args = process.argv.slice(2);
  const arg = args[0];

  if (!arg) {
    console.error(
      "Gebruik: npm run mail -- <matchId> [--variant=korter|formeler|informeler]  of  npm run mail -- --all-kansrijk",
    );
    process.exitCode = 1;
    return;
  }

  const variant = parseVariantArg(args);
  const styleProfile = await getStyleProfileWithExamples();

  if (arg === "--all-kansrijk") {
    const matches = await prisma.match.findMany({
      where: { isPromising: true, emailDrafts: { none: {} } },
      select: { id: true },
    });

    if (matches.length === 0) {
      console.log("Geen kansrijke matches zonder bestaand mailconcept gevonden.");
      return;
    }

    console.log(`${matches.length} kansrijke match(es) zonder bestaand concept gevonden.`);
    let succeeded = 0;
    let failed = 0;

    for (const { id } of matches) {
      try {
        const draft = await processMatch(id, variant, styleProfile);
        printDraft(draft);
        succeeded += 1;
      } catch (error) {
        console.error(`Match ${id} mislukt: ${(error as Error).message}`);
        failed += 1;
      }
    }

    console.log(`\n=== Samenvatting mail === geslaagd=${succeeded}, mislukt=${failed}`);
    return;
  }

  const draft = await processMatch(arg, variant, styleProfile);
  printDraft(draft);
}

main()
  .catch((error) => {
    console.error("[mail] Onverwachte fout:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
