import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";

import { ImportButton } from "./import-button";

// Geen searchParams/params op deze pagina, dus Next.js zou 'm anders
// statisch proberen te genereren tijdens de build — met de kerncijfers
// bevroren op het moment van deployen. Dit is een dashboard: altijd verse
// data per request.
export const dynamic = "force-dynamic";

export default async function OverzichtPage() {
  const [vacancyCount, candidateCount, promisingMatchCount, lastImport, recentPromisingMatches] = await Promise.all([
    prisma.vacancy.count({ where: { isActive: true } }),
    prisma.candidate.count({ where: { isActive: true } }),
    prisma.match.count({ where: { isPromising: true } }),
    prisma.vacancy.aggregate({ _max: { lastSeenAt: true } }),
    prisma.match.findMany({
      where: { isPromising: true },
      orderBy: { calculatedAt: "desc" },
      take: 10,
      include: {
        candidate: { select: { fullName: true } },
        vacancy: { select: { title: true, companyName: true } },
      },
    }),
  ]);

  const lastImportDate = lastImport._max.lastSeenAt;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-neutral-900">Overzicht</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-5">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Actieve vacatures</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{vacancyCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Kandidaten</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{candidateCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Kansrijke matches</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{promisingMatchCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Laatste import</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">
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
          <CardTitle>10 nieuwste kansrijke matches</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table className="border-none">
            <TableHeader>
              <TableRow>
                <TableHead>Kandidaat</TableHead>
                <TableHead>Vacature</TableHead>
                <TableHead>Bedrijf</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPromisingMatches.map((match) => (
                <TableRow key={match.id}>
                  <TableCell>
                    <Link href={`/matches/${match.id}`} className="font-medium text-neutral-900 hover:underline">
                      {match.candidate.fullName ?? "Naam onbekend"}
                    </Link>
                  </TableCell>
                  <TableCell>{match.vacancy.title}</TableCell>
                  <TableCell>{match.vacancy.companyName}</TableCell>
                  <TableCell className="font-semibold">{match.score}</TableCell>
                </TableRow>
              ))}
              {recentPromisingMatches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-neutral-400">
                    Nog geen kansrijke matches.
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
