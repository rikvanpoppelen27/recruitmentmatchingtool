import path from "node:path";

import { Prisma } from "@prisma/client";

import { bouwStijlprofiel } from "../ai/style-profile";
import { prisma } from "../db/prisma";
import type { StyleProfileContent } from "../validation/mail";
import { importExampleEmails, type ParsedExampleEmail } from "./import-examples";

// process.cwd() i.p.v. __dirname — zie de toelichting in lib/pdf/template.ts.
const MAIL_EXAMPLES_DIR = path.join(process.cwd(), "mail-examples");
const DEFAULT_USER_EMAIL = "recruiter@example.com";

export interface BuildStyleProfileResult {
  profile: StyleProfileContent;
  representativeExamples: ParsedExampleEmail[];
  warnings: string[];
  exampleCount: number;
}

/**
 * Bouwt (of vernieuwt) het stijlprofiel uit mail-examples/ en slaat het op.
 * Gedeelde implementatie voor scripts/style-profile.ts (CLI) en de
 * "Stijlprofiel opnieuw opbouwen"-knop op /instellingen (route handler POST
 * /api/settings/style-profile/rebuild).
 */
export async function rebuildStyleProfile(options: { maskContactInfo?: boolean } = {}): Promise<BuildStyleProfileResult> {
  const { examples, warnings } = await importExampleEmails(MAIL_EXAMPLES_DIR, options);

  if (examples.length === 0) {
    throw new Error(`Geen voorbeeldmails gevonden in "${MAIL_EXAMPLES_DIR}", kan geen stijlprofiel opbouwen.`);
  }

  const { profile, representativeExamples } = await bouwStijlprofiel(examples);

  const user = await prisma.user.findUniqueOrThrow({ where: { email: DEFAULT_USER_EMAIL } });

  const exampleEmailData = representativeExamples.map((e) => ({
    subject: e.subject ?? "(geen onderwerpsregel)",
    body: e.body,
  }));

  await prisma.styleProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      content: profile as unknown as Prisma.InputJsonValue,
      exampleEmails: { create: exampleEmailData },
    },
    update: {
      content: profile as unknown as Prisma.InputJsonValue,
      exampleEmails: { deleteMany: {}, create: exampleEmailData },
    },
  });

  return { profile, representativeExamples, warnings, exampleCount: examples.length };
}
