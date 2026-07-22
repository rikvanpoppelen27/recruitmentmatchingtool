import Link from "next/link";

import { cn } from "../lib/utils";

interface PaginationProps {
  page: number;
  pageCount: number;
  /** Bouwt de href voor een gegeven paginanummer, met de overige filters intact. */
  buildHref: (page: number) => string;
}

export function Pagination({ page, pageCount, buildHref }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav className="flex items-center justify-between px-1 py-3 text-sm text-neutral-600" aria-label="Paginering">
      <span>
        Pagina {page} van {pageCount}
      </span>
      <div className="flex gap-2">
        <Link
          href={buildHref(Math.max(1, page - 1))}
          className={cn(
            "rounded-md border border-neutral-300 px-3 py-1.5",
            page <= 1 ? "pointer-events-none text-neutral-300" : "hover:bg-neutral-50",
          )}
          aria-disabled={page <= 1}
        >
          Vorige
        </Link>
        <Link
          href={buildHref(Math.min(pageCount, page + 1))}
          className={cn(
            "rounded-md border border-neutral-300 px-3 py-1.5",
            page >= pageCount ? "pointer-events-none text-neutral-300" : "hover:bg-neutral-50",
          )}
          aria-disabled={page >= pageCount}
        >
          Volgende
        </Link>
      </div>
    </nav>
  );
}
