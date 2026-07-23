import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";

import { MatchFilters } from "./match-filters";
import { MatchRunButton } from "./match-run-button";

const PAGE_SIZE = 50;

interface MatchesPageProps {
  searchParams: Promise<{
    kansrijk?: string;
    minScore?: string;
    candidateId?: string;
    vacancyId?: string;
    page?: string;
  }>;
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const minScore = Number(params.minScore) || 0;

  const where: Prisma.MatchWhereInput = {
    score: { gte: minScore },
    ...(params.kansrijk === "1" ? { isPromising: true } : {}),
    ...(params.candidateId ? { candidateId: params.candidateId } : {}),
    ...(params.vacancyId ? { vacancyId: params.vacancyId } : {}),
  };

  const [total, matches, candidates, vacancies] = await Promise.all([
    prisma.match.count({ where }),
    prisma.match.findMany({
      where,
      orderBy: { score: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        candidate: { select: { fullName: true } },
        vacancy: { select: { title: true, companyName: true } },
        frontsheet: { select: { id: true } },
        emailDrafts: { select: { id: true }, take: 1 },
      },
    }),
    prisma.candidate.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.vacancy.findMany({
      where: { isActive: true },
      select: { id: true, title: true, companyName: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(targetPage: number): string {
    const usp = new URLSearchParams();
    if (params.kansrijk) usp.set("kansrijk", params.kansrijk);
    if (params.minScore) usp.set("minScore", params.minScore);
    if (params.candidateId) usp.set("candidateId", params.candidateId);
    if (params.vacancyId) usp.set("vacancyId", params.vacancyId);
    usp.set("page", String(targetPage));
    return `/matches?${usp.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Matches</h1>
          <p className="mt-1 text-sm text-ink-muted">{total} match(es) gevonden.</p>
        </div>
        <MatchRunButton />
      </div>

      <MatchFilters candidates={candidates} vacancies={vacancies} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kandidaat</TableHead>
            <TableHead>Vacature</TableHead>
            <TableHead>Bedrijf</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Kansrijk</TableHead>
            <TableHead>Frontsheet</TableHead>
            <TableHead>Mail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matches.map((match) => (
            <TableRow key={match.id} className="hover:bg-neutral-50">
              <TableCell>
                <Link href={`/matches/${match.id}`} className="font-medium text-ink hover:underline">
                  {match.candidate.fullName ?? "Naam onbekend"}
                </Link>
              </TableCell>
              <TableCell>{match.vacancy.title}</TableCell>
              <TableCell>{match.vacancy.companyName}</TableCell>
              <TableCell className="font-semibold">{match.score}</TableCell>
              <TableCell>
                {match.isPromising ? <Badge variant="success">Kansrijk</Badge> : <Badge variant="neutral">—</Badge>}
              </TableCell>
              <TableCell>{match.frontsheet ? "Ja" : "Nee"}</TableCell>
              <TableCell>{match.emailDrafts.length > 0 ? "Ja" : "Nee"}</TableCell>
            </TableRow>
          ))}
          {matches.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-neutral-400">
                Geen matches gevonden voor deze filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Pagination page={page} pageCount={pageCount} buildHref={buildHref} />
    </div>
  );
}
