"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export interface FrontsheetRevisionInfo {
  id: string;
  instruction: string;
  createdAt: Date;
}

interface FrontsheetPanelProps {
  matchId: string;
  initialSignedUrl: string | null;
  initialGeneratedAt: Date | null;
  initialRevisions: FrontsheetRevisionInfo[];
}

export function FrontsheetPanel({
  matchId,
  initialSignedUrl,
  initialGeneratedAt,
  initialRevisions,
}: FrontsheetPanelProps) {
  const [signedUrl, setSignedUrl] = useState(initialSignedUrl);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [revisions, setRevisions] = useState<FrontsheetRevisionInfo[]>(initialRevisions);
  const [instruction, setInstruction] = useState("");
  const [refining, setRefining] = useState(false);
  const [toelichting, setToelichting] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

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

  async function handleRefine() {
    if (!instruction.trim()) return;
    setRefining(true);
    setError(null);
    setToelichting(null);
    try {
      const response = await fetch(`/api/matches/${matchId}/frontsheet/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Verfijnen van de frontsheet is mislukt.");
      setSignedUrl(data.signedUrl);
      setPageCount(data.pageCount);
      setWarnings(data.warnings ?? []);
      setGeneratedAt(new Date());
      setToelichting(data.toelichting ?? null);
      setRevisions((prev) => [{ id: data.revisionId, instruction, createdAt: new Date() }, ...prev]);
      setInstruction("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefining(false);
    }
  }

  async function handleRestore(revisionId: string) {
    setRestoringId(revisionId);
    setError(null);
    try {
      const response = await fetch(`/api/matches/${matchId}/frontsheet/revisions/${revisionId}/restore`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Terugzetten is mislukt.");
      setSignedUrl(data.signedUrl);
      setPageCount(data.pageCount);
      setWarnings(data.warnings ?? []);
      setGeneratedAt(new Date());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-muted">
        Automatisch gegenereerd concept — controleer de inhoud altijd voordat je het gebruikt.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleGenerate} disabled={loading}>
          {loading ? "Bezig met genereren…" : signedUrl ? "Opnieuw genereren (vanaf nul)" : "Genereer presentatiedocument"}
        </Button>
        {signedUrl && (
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-ink-muted underline"
          >
            Downloaden{pageCount ? ` (${pageCount} pagina's)` : ""}
          </a>
        )}
        {generatedAt && (
          <span className="text-xs text-neutral-400">Laatst gegenereerd op {generatedAt.toLocaleString("nl-NL")}.</span>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {warnings.map((warning, i) => (
        <p key={i} className="text-sm text-warning">
          ⚠ {warning}
        </p>
      ))}

      {signedUrl && (
        <iframe
          src={signedUrl}
          className="h-[600px] w-full rounded-md border border-neutral-100"
          title="Voorbeeld van het presentatiedocument"
        />
      )}

      {signedUrl && (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-100 p-4">
          <p className="text-sm font-medium text-ink">Wijziging aanvragen (chat)</p>
          <p className="text-xs text-ink-muted">
            Beschrijf in gewone taal wat je aangepast wilt hebben, bv. &quot;maak de samenvatting korter&quot; of
            &quot;benoem zijn Vue-ervaring explicieter&quot;. Alleen wat je vraagt wordt aangepast, de rest blijft
            ongewijzigd — en er wordt nooit informatie toegevoegd die niet in het CV of de vacature staat.
          </p>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={2}
            placeholder="bv. haal de opleiding weg"
          />
          <div>
            <Button onClick={handleRefine} disabled={refining || !instruction.trim()}>
              {refining ? "Bezig met aanpassen…" : "Wijziging toepassen"}
            </Button>
          </div>
          {toelichting && <p className="text-sm text-warning">ℹ {toelichting}</p>}

          {revisions.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Geschiedenis</p>
              {revisions.map((revision) => (
                <div key={revision.id} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="text-ink">{revision.instruction}</p>
                    <p className="text-xs text-neutral-400">{revision.createdAt.toLocaleString("nl-NL")}</p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => handleRestore(revision.id)}
                    disabled={restoringId !== null}
                  >
                    {restoringId === revision.id ? "Bezig…" : "Deze versie herstellen"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
