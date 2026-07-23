import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProvinceByCode } from "@/config/provinces";
import { prisma } from "@/lib/db/prisma";

import { SearchProfileForm } from "./search-profile-form";
import { SearchProfileRowActions } from "./search-profile-row-actions";

export const dynamic = "force-dynamic";

export default async function ZoekprofielenPage() {
  const profiles = await prisma.searchProfile.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Zoekprofielen</h1>
          <p className="mt-1 text-sm text-ink-muted">
            De import draait over alle actieve profielen hieronder — geen hardcoded zoektermen meer.
          </p>
        </div>
        <SearchProfileForm trigger={<Button>Zoekprofiel aanmaken</Button>} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Naam</TableHead>
            <TableHead>Zoekterm</TableHead>
            <TableHead>Provincies</TableHead>
            <TableHead>Max. dagen</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Laatste run</TableHead>
            <TableHead>Acties</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((profile) => (
            <TableRow key={profile.id}>
              <TableCell className="font-medium text-ink">{profile.name}</TableCell>
              <TableCell className="max-w-xs truncate font-mono text-xs" title={profile.query}>
                {profile.query}
              </TableCell>
              <TableCell>
                {profile.provinces.map((code) => getProvinceByCode(code)?.name ?? code).join(", ")}
              </TableCell>
              <TableCell>{profile.maxDaysOld}</TableCell>
              <TableCell>
                {profile.isActive ? <Badge variant="success">Actief</Badge> : <Badge variant="neutral">Gepauzeerd</Badge>}
              </TableCell>
              <TableCell className="text-xs text-ink-muted">
                {profile.lastRunAt
                  ? `${profile.lastRunAt.toLocaleString("nl-NL")} (${profile.resultCount ?? 0} resultaten)`
                  : "Nog niet uitgevoerd"}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-2">
                  <SearchProfileForm
                    trigger={
                      <button type="button" className="text-left text-xs text-ink-muted underline">
                        Bewerken
                      </button>
                    }
                    initialValues={{
                      id: profile.id,
                      name: profile.name,
                      query: profile.query,
                      provinces: profile.provinces,
                      maxDaysOld: profile.maxDaysOld,
                      titleOnly: profile.titleOnly,
                      isActive: profile.isActive,
                    }}
                  />
                  <SearchProfileRowActions id={profile.id} isActive={profile.isActive} />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {profiles.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-neutral-400">
                Nog geen zoekprofielen. Maak er één aan om te beginnen met importeren.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
