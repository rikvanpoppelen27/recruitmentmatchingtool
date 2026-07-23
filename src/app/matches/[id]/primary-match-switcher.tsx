"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

interface SiblingMatch {
  matchId: string;
  candidateName: string | null;
  score: number;
  isPrimary: boolean;
}

interface PrimaryMatchSwitcherProps {
  vacancyId: string;
  matches: SiblingMatch[];
}

/** Toont andere kandidaten boven de matchdrempel voor dezelfde vacature, met de mogelijkheid de primaire kandidaat te wisselen (fase 6B). */
export function PrimaryMatchSwitcher({ vacancyId, matches }: PrimaryMatchSwitcherProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleMakePrimary(matchId: string) {
    setLoadingId(matchId);
    setError(null);
    try {
      const response = await fetch(`/api/vacancies/${vacancyId}/primary-match`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Wisselen is mislukt.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingId(null);
    }
  }

  if (matches.length <= 1) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-ink-muted">
        {matches.length} kandidaten halen de matchdrempel voor deze vacature. De hoogst scorende is automatisch
        primair (frontsheet/mail); je kunt dit hier wisselen.
      </p>
      <div className="flex flex-col gap-2">
        {matches.map((m) => (
          <div key={m.matchId} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-ink">
              {m.candidateName ?? "Naam onbekend"} — score {m.score}
              {m.isPrimary ? " (primair)" : ""}
            </span>
            {!m.isPrimary && (
              <Button variant="secondary" onClick={() => handleMakePrimary(m.matchId)} disabled={loadingId !== null}>
                {loadingId === m.matchId ? "Bezig…" : "Maak primair"}
              </Button>
            )}
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
