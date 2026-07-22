"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

interface SearchProfileRowActionsProps {
  id: string;
  isActive: boolean;
}

export function SearchProfileRowActions({ id, isActive }: SearchProfileRowActionsProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleRunNow() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/search-profiles/${id}/run`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Uitvoeren is mislukt.");
      setResult(`Opgehaald: ${data.fetched}, nieuw: ${data.new}, al bekend: ${data.alreadyKnown}.`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function handleToggleActive() {
    setToggling(true);
    setError(null);
    try {
      const response = await fetch(`/api/search-profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Bijwerken is mislukt.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Dit zoekprofiel verwijderen?")) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/search-profiles/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Verwijderen is mislukt.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={handleRunNow} disabled={running} className="h-7 px-2 text-xs">
          {running ? "Bezig…" : "Nu uitvoeren"}
        </Button>
        <Button variant="secondary" onClick={handleToggleActive} disabled={toggling} className="h-7 px-2 text-xs">
          {isActive ? "Deactiveren" : "Activeren"}
        </Button>
        <Button variant="danger" onClick={handleDelete} disabled={deleting} className="h-7 px-2 text-xs">
          Verwijderen
        </Button>
      </div>
      {result && <p className="text-xs text-neutral-500">{result}</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
