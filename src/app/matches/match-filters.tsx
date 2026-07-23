"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Select } from "@/components/ui/input";

interface MatchFiltersProps {
  candidates: Array<{ id: string; fullName: string | null }>;
  vacancies: Array<{ id: string; title: string; companyName: string }>;
}

export function MatchFilters({ candidates, vacancies }: MatchFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [minScore, setMinScore] = useState(Number(searchParams.get("minScore") ?? 0));

  function updateParam(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-neutral-100 bg-surface p-4">
      <label className="flex items-center gap-2 text-sm text-ink-muted">
        <input
          type="checkbox"
          defaultChecked={searchParams.get("kansrijk") === "1"}
          onChange={(e) => updateParam("kansrijk", e.target.checked ? "1" : "")}
          className="h-4 w-4 rounded border-neutral-300"
        />
        Alleen kansrijk
      </label>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink-muted">Minimale score: {minScore}</label>
        <input
          type="range"
          min={0}
          max={100}
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          onMouseUp={(e) => updateParam("minScore", (e.target as HTMLInputElement).value)}
          onTouchEnd={(e) => updateParam("minScore", (e.target as HTMLInputElement).value)}
          className="w-40"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink-muted">Kandidaat</label>
        <Select
          className="w-56"
          defaultValue={searchParams.get("candidateId") ?? ""}
          onChange={(e) => updateParam("candidateId", e.target.value)}
        >
          <option value="">Alle kandidaten</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName ?? c.id}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink-muted">Vacature</label>
        <Select
          className="w-64"
          defaultValue={searchParams.get("vacancyId") ?? ""}
          onChange={(e) => updateParam("vacancyId", e.target.value)}
        >
          <option value="">Alle vacatures</option>
          {vacancies.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title} — {v.companyName}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
