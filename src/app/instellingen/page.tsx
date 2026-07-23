import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { getEffectiveAutoGenerateMode, getEffectiveBrandingSettings, getEffectiveMatchSettings } from "@/lib/settings";
import type { StyleProfileContent } from "@/lib/validation/mail";

import { MailTemplatesSection } from "./mail-templates-section";
import { SettingsForm } from "./settings-form";
import { StyleProfileSection } from "./style-profile-section";

// Zie toelichting in src/app/page.tsx — geen searchParams/params hier,
// dus expliciet dynamisch houden i.p.v. statisch bevriezen bij build.
export const dynamic = "force-dynamic";

export default async function InstellingenPage() {
  const [matchSettings, brandingSettings, autoGenerateMode, styleProfile, mailTemplates] = await Promise.all([
    getEffectiveMatchSettings(),
    getEffectiveBrandingSettings(),
    getEffectiveAutoGenerateMode(),
    prisma.styleProfile.findFirst({ include: { exampleEmails: true } }),
    prisma.mailTemplate.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-ink">Instellingen</h1>

      <Card>
        <CardHeader>
          <CardTitle>Matching &amp; frontsheet</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm matchSettings={matchSettings} brandingSettings={brandingSettings} autoGenerateMode={autoGenerateMode} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mailtemplates</CardTitle>
        </CardHeader>
        <CardContent>
          <MailTemplatesSection templates={mailTemplates} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stijlprofiel</CardTitle>
        </CardHeader>
        <CardContent>
          <StyleProfileSection
            profile={(styleProfile?.content as unknown as StyleProfileContent) ?? null}
            exampleFileNames={styleProfile?.exampleEmails.map((e) => e.subject) ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
