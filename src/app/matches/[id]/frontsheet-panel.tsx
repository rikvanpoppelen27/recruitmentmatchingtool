"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

interface FrontsheetPanelProps {
  matchId: string;
  initialSignedUrl: string | null;
  initialGeneratedAt: Date | null;
}

export function FrontsheetPanel({ matchId, initialSignedUrl, initialGeneratedAt }: FrontsheetPanelProps) {
  const [signedUrl, setSignedUrl] = useState(initialSignedUrl);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/matches/${matchId}/frontsheet`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Genereren van het presentatiedocument is mislukt.");
      setSignedUrl(data.signedUrl);
      setPageCount(data.pageCount);
      setWarnings(data.warnings ?? []);
      setGeneratedAt(new Date());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-neutral-500">
        Automatisch gegenereerd concept — controleer de inhoud altijd voordat je het gebruikt.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleGenerate} disabled={loading}>
          {loading ? "Bezig met genereren…" : signedUrl ? "Opnieuw genereren" : "Genereer presentatiedocument"}
        </Button>
        {signedUrl && (
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-neutral-700 underline">
            Downloaden{pageCount ? ` (${pageCount} pagina's)` : ""}
          </a>
        )}
        {generatedAt && (
          <span className="text-xs text-neutral-400">Laatst gegenereerd op {generatedAt.toLocaleString("nl-NL")}.</span>
        )}
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {warnings.map((warning, i) => (
        <p key={i} className="text-sm text-amber-700">
          ⚠ {warning}
        </p>
      ))}

      {signedUrl && (
        <iframe
          src={signedUrl}
          className="h-[600px] w-full rounded-md border border-neutral-200"
          title="Voorbeeld van het presentatiedocument"
        />
      )}
    </div>
  );
}
