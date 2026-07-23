"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { MatchRunSummary } from "@/lib/match/runMatching";

export function MatchRunButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MatchRunSummary | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const response = await fetch("/api/match/run", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Matchen mislukt.");
      setSummary(data as MatchRunSummary);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={handleClick} disabled={loading}>
        {loading ? "Bezig met matchen…" : "Matchen draaien"}
      </Button>
      {error && <p className="max-w-sm text-right text-sm text-danger">{error}</p>}
      {summary && (
        <p className="max-w-sm text-right text-sm text-ink-muted">
          {summary.newMatches} nieuwe match(es) — {summary.aiCallsMade} AI-beoordelingen uitgevoerd,{" "}
          {summary.aiCallsSkipped} overgeslagen (voordrempel niet gehaald).
        </p>
      )}
    </div>
  );
}
