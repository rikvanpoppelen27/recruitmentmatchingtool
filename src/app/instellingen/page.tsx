import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { getEffectiveBrandingSettings, getEffectiveMatchSettings } from "@/lib/settings";
import type { StyleProfileContent } from "@/lib/validation/mail";

import { SettingsForm } from "./settings-form";
import { StyleProfileSection } from "./style-profile-section";

// Zie toelichting in src/app/page.tsx — geen searchParams/params hier,
// dus expliciet dynamisch houden i.p.v. statisch bevriezen bij build.
export const dynamic = "force-dynamic";

export default async function InstellingenPage() {
  const [matchSettings, brandingSettings, styleProfile] = await Promise.all([
    getEffectiveMatchSettings(),
    getEffectiveBrandingSettings(),
    prisma.styleProfile.findFirst({ include: { exampleEmails: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-neutral-900">Instellingen</h1>

      <Card>
        <CardHeader>
          <CardTitle>Matching &amp; frontsheet</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm matchSettings={matchSettings} brandingSettings={brandingSettings} />
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
