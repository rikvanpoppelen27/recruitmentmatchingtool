import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { getEffectiveMatchSettings } from "@/lib/settings";

import { ImportButton } from "./import-button";
import { ShortlistToggle } from "./vacatures/shortlist-toggle";
import { SourceBadge } from "./vacatures/source-badge";

// Geen searchParams/params op deze pagina, dus Next.js zou 'm anders
// statisch proberen te genereren tijdens de build — met de kerncijfers
// bevroren op het moment van deployen. Dit is een dashboard: altijd verse
// data per request.
export const dynamic = "force-dynamic";

interface WorkbenchRow {
  vacancyId: string;
  title: string;
  companyName: string;
  source: "ADZUNA" | "LINKEDIN" | "INDEED" | "MANUAL" | "OTHER";
  sourceUrl: string | null;
  contactPerson: string | null;
  primaryMatchId: string | null;
  candidateName: string | null;
  score: number | null;
  hasFrontsheet: boolean;
  hasMail: boolean;
  status: "klaar" | "bezig" | "geen-match" | "nog-niet-gematcht";
}

export default async function OverzichtPage() {
  const [vacancyCount, candidateCount, promisingMatchCount, lastImport, matchSettings, shortlistedVacancies] =
    await Promise.all([
      prisma.vacancy.count({ where: { isActive: true } }),
      prisma.candidate.count({ where: { isActive: true } }),
      prisma.match.count({ where: { isPromising: true } }),
      prisma.vacancy.aggregate({ _max: { lastSeenAt: true } }),
      getEffectiveMatchSettings(),
      prisma.vacancy.findMany({
        where: { isShortlisted: true },
        include: {
          matches: {
            orderBy: { score: "desc" },
            include: {
              candidate: { select: { fullName: true } },
              frontsheet: { select: { id: true } },
              emailDrafts: { select: { id: true }, take: 1 },
            },
          },
        },
      }),
    ]);

  const lastImportDate = lastImport._max.lastSeenAt;

  const rows: WorkbenchRow[] = shortlistedVacancies.map((vacancy) => {
    const primary = vacancy.matches.find((m) => m.isPrimary) ?? null;
    const highestScore = vacancy.matches[0]?.score ?? null;

    let status: WorkbenchRow["status"];
    if (primary) {
      status = primary.frontsheet && primary.emailDrafts.length > 0 ? "klaar" : "bezig";
    } else if (vacancy.matches.length > 0) {
      status = "geen-match";
    } else {
      status = "nog-niet-gematcht";
    }

    return {
      vacancyId: vacancy.id,
      title: vacancy.title,
      companyName: vacancy.companyName,
      source: vacancy.source,
      sourceUrl: vacancy.sourceUrl,
      contactPerson: vacancy.contactPerson,
      primaryMatchId: primary?.id ?? null,
      candidateName: primary?.candidate.fullName ?? null,
      score: primary?.score ?? highestScore,
      hasFrontsheet: Boolean(primary?.frontsheet),
      hasMail: Boolean(primary && primary.emailDrafts.length > 0),
      status,
    };
  });

  const statusOrder: Record<WorkbenchRow["status"], number> = {
    klaar: 0,
    bezig: 1,
    "geen-match": 2,
    "nog-niet-gematcht": 3,
  };
  rows.sort((a, b) => {
    if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
    return (b.score ?? -1) - (a.score ?? -1);
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-ink">Overzicht</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-5">
            <p className="text-xs uppercase tracking-wide text-ink-muted">Actieve vacatures</p>
            <p className="mt-1 text-2xl font-bold text-ink">{vacancyCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-xs uppercase tracking-wide text-ink-muted">Kandidaten</p>
            <p className="mt-1 text-2xl font-bold text-ink">{candidateCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-xs uppercase tracking-wide text-ink-muted">Kansrijke matches</p>
            <p className="mt-1 text-2xl font-bold text-ink">{promisingMatchCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-xs uppercase tracking-wide text-ink-muted">Laatste import</p>
            <p className="mt-1 text-2xl font-bold text-ink">
              {lastImportDate ? lastImportDate.toLocaleDateString("nl-NL") : "Nog niet"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vacatures importeren</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shortlist — werkbank ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table className="border-none">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Vacature</TableHead>
                <TableHead>Bron</TableHead>
                <TableHead>Contactpersoon</TableHead>
                <TableHead>Topkandidaat</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Frontsheet</TableHead>
                <TableHead>Mail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.vacancyId}>
                  <TableCell>
                    <ShortlistToggle vacancyId={row.vacancyId} initialShortlisted />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-ink">{row.title}</p>
                    <p className="text-xs text-ink-muted">{row.companyName}</p>
                  </TableCell>
                  <TableCell>
                    <SourceBadge source={row.source} sourceUrl={row.sourceUrl} />
                  </TableCell>
                  <TableCell>{row.contactPerson ?? "—"}</TableCell>
                  <TableCell>{row.candidateName ?? "—"}</TableCell>
                  <TableCell>
                    {row.score !== null ? (
                      <Badge variant={row.score >= matchSettings.matchThreshold ? "success" : "warning"}>
                        {row.score}
                      </Badge>
                    ) : (
                      <Badge variant="neutral">—</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.status === "klaar" && <Badge variant="success">Klaar voor verzending</Badge>}
                    {row.status === "bezig" && <Badge variant="warning">Bezig</Badge>}
                    {row.status === "geen-match" && <Badge variant="neutral">Geen match (nog)</Badge>}
                    {row.status === "nog-niet-gematcht" && <Badge variant="neutral">Nog niet gematcht</Badge>}
                  </TableCell>
                  <TableCell>
                    {row.primaryMatchId ? (
                      <Link href={`/matches/${row.primaryMatchId}#frontsheet`} className="text-ink-muted underline">
                        {row.hasFrontsheet ? "Bekijken" : "Genereren"}
                      </Link>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.primaryMatchId ? (
                      <Link href={`/matches/${row.primaryMatchId}#mail`} className="text-ink-muted underline">
                        {row.hasMail ? "Bekijken" : "Genereren"}
                      </Link>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-neutral-400">
                    Nog geen vacatures op de shortlist. Voeg er één toe via de plus-knop op Vacatures.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
