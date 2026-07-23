"use client";

import { Check, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface ShortlistToggleProps {
  vacancyId: string;
  initialShortlisted: boolean;
}

export function ShortlistToggle({ vacancyId, initialShortlisted }: ShortlistToggleProps) {
  const router = useRouter();
  const [shortlisted, setShortlisted] = useState(initialShortlisted);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function handleToggle() {
    const next = !shortlisted;
    setShortlisted(next);
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const response = await fetch(`/api/vacancies/${vacancyId}/shortlist`, { method: next ? "POST" : "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Actie is mislukt.");
      if (next) {
        if (data.primaryMatch) {
          setSummary(`Topkandidaat: ${data.primaryMatch.candidateName ?? "onbekend"} (score ${data.primaryMatch.score}).`);
        } else if (data.highestScore !== null && data.highestScore !== undefined) {
          setSummary(`Geen match boven de drempel (hoogste score: ${data.highestScore}).`);
        }
      }
      router.refresh();
    } catch (err) {
      setShortlisted(!next);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        aria-label={shortlisted ? "Van shortlist halen" : "Aan shortlist toevoegen"}
        title={shortlisted ? "Van shortlist halen" : "Aan shortlist toevoegen"}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          shortlisted
            ? "border-success bg-success-bg text-success"
            : "border-neutral-300 text-ink-muted hover:bg-neutral-50",
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : shortlisted ? (
          <Check className="h-4 w-4" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
      </button>
      {error && <span className="max-w-[10rem] text-[10px] text-danger">{error}</span>}
      {summary && <span className="max-w-[10rem] text-[10px] text-ink-muted">{summary}</span>}
    </div>
  );
}
