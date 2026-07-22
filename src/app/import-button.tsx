"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ImportSummary } from "@/lib/import/runImport";

export function ImportButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const response = await fetch("/api/import/run", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Import mislukt.");
      setSummary(data as ImportSummary);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleClick} disabled={loading}>
        {loading ? "Bezig met importeren…" : "Vacatures importeren"}
      </Button>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {summary && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
          <p className="font-medium">
            Totaal: opgehaald {summary.totalFetched}, nieuw {summary.totalNew}, al bekend {summary.totalAlreadyKnown},
            duplicaten in run {summary.totalDuplicatesWithinRun}.
          </p>
          <ul className="mt-1 list-inside list-disc">
            {summary.perProfile.map((p) => (
              <li key={p.profileId}>
                {p.profileName}: opgehaald {p.fetched}, nieuw {p.new}, al bekend {p.alreadyKnown}
                {p.errors.length > 0 && (
                  <ul className="ml-4 list-inside list-disc text-red-700">
                    {p.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          {summary.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-red-700">
              {summary.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
