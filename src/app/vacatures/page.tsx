import type { Prisma } from "@prisma/client";

import { Pagination } from "@/components/pagination";
import { Select } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PROVINCES } from "@/config/provinces";
import { prisma } from "@/lib/db/prisma";
import { BooleanQuerySyntaxError } from "@/lib/search/boolean-query";
import { booleanQueryToVacancyFilter } from "@/lib/search/boolean-query-to-prisma-filter";

import { AddVacancyDialog } from "./add-vacancy-dialog";
import { ShortlistToggle } from "./shortlist-toggle";
import { SourceBadge } from "./source-badge";

const PAGE_SIZE = 50;

interface VacaturesPageProps {
  searchParams: Promise<{
    region?: string | string[];
    bq?: string;
    days?: string;
    shortlist?: string;
    page?: string;
  }>;
}

export default async function VacaturesPage({ searchParams }: VacaturesPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const bq = params.bq?.trim() ?? "";
  const days = params.days ?? "";
  const shortlist = params.shortlist ?? "";
  const selectedRegions = Array.isArray(params.region) ? params.region : params.region ? [params.region] : [];

  let bqError: string | null = null;
  let bqFilter: Prisma.VacancyWhereInput = {};
  if (bq) {
    try {
      bqFilter = booleanQueryToVacancyFilter(bq);
    } catch (error) {
      bqError = error instanceof BooleanQuerySyntaxError ? error.message : "Ongeldige zoekterm.";
    }
  }

  const where: Prisma.VacancyWhereInput = {
    isActive: true,
    ...(selectedRegions.length > 0 ? { region: { in: selectedRegions } } : {}),
    ...(days ? { importedAt: { gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000) } } : {}),
    ...(shortlist === "1" ? { isShortlisted: true } : {}),
    ...(shortlist === "0" ? { isShortlisted: false } : {}),
    ...(bq && !bqError ? bqFilter : {}),
  };

  const [total, vacancies] = await Promise.all([
    prisma.vacancy.count({ where }),
    prisma.vacancy.findMany({
      where,
      orderBy: { importedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(targetPage: number): string {
    const usp = new URLSearchParams();
    for (const r of selectedRegions) usp.append("region", r);
    if (bq) usp.set("bq", bq);
    if (days) usp.set("days", days);
    if (shortlist) usp.set("shortlist", shortlist);
    usp.set("page", String(targetPage));
    return `/vacatures?${usp.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Vacatures</h1>
          <p className="mt-1 text-sm text-ink-muted">{total} vacature(s) gevonden.</p>
        </div>
        <AddVacancyDialog />
      </div>

      <form method="get" className="flex flex-wrap items-end gap-4 rounded-lg bg-surface p-4 shadow-card">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="bq">
            Zoekterm (booleaans: AND/OR/NOT, &quot;exacte groep&quot;)
          </label>
          <input
            id="bq"
            name="bq"
            defaultValue={bq}
            className="w-72 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder='bv. react AND (senior OR medior) NOT stage'
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="region">
            Provincies (ctrl/cmd-klik voor meerdere)
          </label>
          <select
            id="region"
            name="region"
            multiple
            defaultValue={selectedRegions}
            className="h-24 w-48 rounded-md border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="days">
            Periode
          </label>
          <Select id="days" name="days" defaultValue={days} className="w-40">
            <option value="">Alle vacatures</option>
            <option value="7">Laatste 7 dagen</option>
            <option value="30">Laatste 30 dagen</option>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="shortlist">
            Shortlist
          </label>
          <Select id="shortlist" name="shortlist" defaultValue={shortlist} className="w-40">
            <option value="">Alles</option>
            <option value="1">Alleen shortlist</option>
            <option value="0">Alleen niet-shortlist</option>
          </Select>
        </div>

        <button
          type="submit"
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover"
        >
          Filteren
        </button>
      </form>

      {bqError && <p className="text-sm text-danger">Zoekterm kon niet worden verwerkt: {bqError}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Functietitel</TableHead>
            <TableHead>Bedrijf</TableHead>
            <TableHead>Plaats</TableHead>
            <TableHead>Provincie</TableHead>
            <TableHead>Datum</TableHead>
            <TableHead>Bron</TableHead>
            <TableHead>Link</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vacancies.map((vacancy) => (
            <TableRow key={vacancy.id}>
              <TableCell>
                <ShortlistToggle vacancyId={vacancy.id} initialShortlisted={vacancy.isShortlisted} />
              </TableCell>
              <TableCell className="font-medium text-ink">{vacancy.title}</TableCell>
              <TableCell>{vacancy.companyName}</TableCell>
              <TableCell>{vacancy.location}</TableCell>
              <TableCell>{vacancy.region}</TableCell>
              <TableCell>{vacancy.importedAt.toLocaleDateString("nl-NL")}</TableCell>
              <TableCell>
                <SourceBadge source={vacancy.source} sourceUrl={vacancy.sourceUrl} />
              </TableCell>
              <TableCell>
                {vacancy.url ? (
                  <a href={vacancy.url} target="_blank" rel="noopener noreferrer" className="text-ink-muted underline">
                    Bekijken
                  </a>
                ) : (
                  <span className="text-neutral-300">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {vacancies.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-neutral-400">
                Geen vacatures gevonden voor deze filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Pagination page={page} pageCount={pageCount} buildHref={buildHref} />
    </div>
  );
}
