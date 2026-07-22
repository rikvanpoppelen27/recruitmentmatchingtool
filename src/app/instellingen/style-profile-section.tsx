"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { StyleProfileContent } from "@/lib/validation/mail";

interface StyleProfileSectionProps {
  profile: StyleProfileContent | null;
  exampleFileNames: string[];
}

export function StyleProfileSection({ profile, exampleFileNames }: StyleProfileSectionProps) {
  const router = useRouter();
  const [mask, setMask] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function handleRebuild() {
    setLoading(true);
    setError(null);
    setWarnings([]);
    try {
      const response = await fetch("/api/settings/style-profile/rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maskContactInfo: mask }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Opbouwen van het stijlprofiel is mislukt.");
      setWarnings(data.warnings ?? []);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {profile ? (
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <Item label="Aanhef" value={profile.aanhef} />
          <Item label="Toon" value={profile.toon} />
          <Item label="Zinslengte" value={profile.zinslengte} />
          <Item label="Structuur" value={profile.structuur} />
          <Item label="Introductiestijl kandidaat" value={profile.introductiestijlKandidaat} />
          <Item label="Afsluiting" value={profile.afsluiting} />
          <Item label="Onderwerpsregel-patroon" value={profile.onderwerpsregelPatroon} />
          <Item label="Typische formuleringen" value={profile.typischeFormuleringen.join(", ")} />
          <Item label="Vermijdt" value={profile.vermijden.join(", ")} />
          <Item label="Voorbeeldmails" value={exampleFileNames.join(", ")} />
        </dl>
      ) : (
        <p className="text-sm text-neutral-400">Nog geen stijlprofiel opgebouwd.</p>
      )}

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={mask}
          onChange={(e) => setMask(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300"
        />
        Gevonden e-mailadressen/telefoonnummers in de voorbeeldmails maskeren vóór verwerking
      </label>

      <div className="flex items-center gap-3">
        <Button onClick={handleRebuild} disabled={loading}>
          {loading ? "Bezig met opbouwen…" : "Stijlprofiel opnieuw opbouwen uit mail-examples/"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {warnings.map((w, i) => (
        <p key={i} className="text-sm text-amber-700">
          ⚠ {w}
        </p>
      ))}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-neutral-700">{value}</dd>
    </div>
  );
}
