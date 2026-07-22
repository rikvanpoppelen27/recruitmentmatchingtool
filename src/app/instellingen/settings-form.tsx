"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EffectiveBrandingSettings, EffectiveMatchSettings } from "@/lib/settings";

interface SettingsFormProps {
  matchSettings: EffectiveMatchSettings;
  brandingSettings: EffectiveBrandingSettings;
}

export function SettingsForm({ matchSettings, brandingSettings }: SettingsFormProps) {
  const router = useRouter();
  const [values, setValues] = useState({
    matchThreshold: matchSettings.matchThreshold,
    skillWeight: matchSettings.skillWeight,
    semanticWeight: matchSettings.semanticWeight,
    mustHaveWeight: matchSettings.mustHaveWeight,
    niceToHaveWeight: matchSettings.niceToHaveWeight,
    knockOutCapScore: matchSettings.knockOutCapScore,
    aiCallMustHaveThreshold: matchSettings.aiCallMustHaveThreshold,
    anonymizeCV: brandingSettings.anonymizeCV,
    companyName: brandingSettings.companyName,
    footerText: brandingSettings.footerText,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateField<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Opslaan mislukt.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Matchdrempel (0-100, vanaf wanneer een match 'kansrijk' is)">
          <Input
            type="number"
            min={0}
            max={100}
            value={values.matchThreshold}
            onChange={(e) => updateField("matchThreshold", Number(e.target.value))}
          />
        </Field>
        <Field label="Knock-out-cap (max. score bij ontbrekende must-have)">
          <Input
            type="number"
            min={0}
            max={100}
            value={values.knockOutCapScore}
            onChange={(e) => updateField("knockOutCapScore", Number(e.target.value))}
          />
        </Field>
        <Field label="Gewicht skill-score (0-1)">
          <Input
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={values.skillWeight}
            onChange={(e) => updateField("skillWeight", Number(e.target.value))}
          />
        </Field>
        <Field label="Gewicht semantische score (0-1)">
          <Input
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={values.semanticWeight}
            onChange={(e) => updateField("semanticWeight", Number(e.target.value))}
          />
        </Field>
        <Field label="Gewicht must-have-dekking binnen skill-score (0-1)">
          <Input
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={values.mustHaveWeight}
            onChange={(e) => updateField("mustHaveWeight", Number(e.target.value))}
          />
        </Field>
        <Field label="Gewicht nice-to-have-dekking binnen skill-score (0-1)">
          <Input
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={values.niceToHaveWeight}
            onChange={(e) => updateField("niceToHaveWeight", Number(e.target.value))}
          />
        </Field>
        <Field label="AI-voordrempel (must-have-dekking vanaf wanneer laag 2 wordt aangeroepen, 0-1)">
          <Input
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={values.aiCallMustHaveThreshold}
            onChange={(e) => updateField("aiCallMustHaveThreshold", Number(e.target.value))}
          />
        </Field>
        <Field label="Bedrijfsnaam op frontsheet">
          <Input value={values.companyName} onChange={(e) => updateField("companyName", e.target.value)} />
        </Field>
        <Field label="Voettekst op frontsheet">
          <Input value={values.footerText} onChange={(e) => updateField("footerText", e.target.value)} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={values.anonymizeCV}
          onChange={(e) => updateField("anonymizeCV", e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300"
        />
        Contactgegevens uit het CV verwijderen bij het samenvoegen tot een presentatiedocument (anonimisering)
      </label>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Opslaan…" : "Instellingen opslaan"}
        </Button>
        {saved && <span className="text-sm text-green-700">Opgeslagen.</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
