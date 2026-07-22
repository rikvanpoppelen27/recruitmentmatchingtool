import type { Prisma } from "@prisma/client";

import { Pagination } from "@/components/pagination";
import { Select } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";

import { AddVacancyDialog } from "./add-vacancy-dialog";
import { SourceBadge } from "./source-badge";

const PAGE_SIZE = 50;

interface VacaturesPageProps {
  searchParams: Promise<{
    region?: string;
    q?: string;
    days?: string;
    page?: string;
  }>;
}

export default async function VacaturesPage({ searchParams }: VacaturesPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const q = params.q?.trim() ?? "";
  const region = params.region ?? "";
  const days = params.days ?? "";

  const where: Prisma.VacancyWhereInput = {
    isActive: true,
    ...(region ? { region } : {}),
    ...(days
      ? { importedAt: { gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000) } }
      : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { companyName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, vacancies, regions] = await Promise.all([
    prisma.vacancy.count({ where }),
    prisma.vacancy.findMany({
      where,
      orderBy: { importedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.vacancy.findMany({ distinct: ["region"], select: { region: true }, orderBy: { region: "asc" } }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(targetPage: number): string {
    const usp = new URLSearchParams();
    if (region) usp.set("region", region);
    if (q) usp.set("q", q);
    if (days) usp.set("days", days);
    usp.set("page", String(targetPage));
    return `/vacatures?${usp.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Vacatures</h1>
          <p className="mt-1 text-sm text-neutral-500">{total} vacature(s) gevonden.</p>
        </div>
        <AddVacancyDialog />
      </div>

      <form method="get" className="flex flex-wrap items-end gap-4 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500" htmlFor="q">
            Zoekterm (titel/bedrijf)
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            className="w-56 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
            placeholder="bv. front-end, Yellowtail"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500" htmlFor="region">
            Provincie
          </label>
          <Select id="region" name="region" defaultValue={region} className="w-48">
            <option value="">Alle provincies</option>
            {regions.map((r) => (
              <option key={r.region} value={r.region}>
                {r.region}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500" htmlFor="days">
            Periode
          </label>
          <Select id="days" name="days" defaultValue={days} className="w-40">
            <option value="">Alle vacatures</option>
            <option value="7">Laatste 7 dagen</option>
            <option value="30">Laatste 30 dagen</option>
          </Select>
        </div>

        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Filteren
        </button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
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
              <TableCell className="font-medium text-neutral-900">{vacancy.title}</TableCell>
              <TableCell>{vacancy.companyName}</TableCell>
              <TableCell>{vacancy.location}</TableCell>
              <TableCell>{vacancy.region}</TableCell>
              <TableCell>{vacancy.importedAt.toLocaleDateString("nl-NL")}</TableCell>
              <TableCell>
                <SourceBadge source={vacancy.source} sourceUrl={vacancy.sourceUrl} />
              </TableCell>
              <TableCell>
                {vacancy.url ? (
                  <a
                    href={vacancy.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-700 underline"
                  >
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
              <TableCell colSpan={7} className="py-8 text-center text-neutral-400">
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
