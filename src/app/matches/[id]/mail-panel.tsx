"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

type MailVariant = "standaard" | "korter" | "formeler" | "informeler";

export interface MailDraft {
  id: string;
  variant: MailVariant;
  subject: string;
  body: string;
  generatedAt: Date;
}

export interface MailTemplateOption {
  id: string;
  name: string;
  isDefault: boolean;
}

interface MailPanelProps {
  matchId: string;
  hasStyleProfile: boolean;
  initialDrafts: MailDraft[];
  templates: MailTemplateOption[];
}

const VARIANT_LABELS: Record<MailVariant, string> = {
  standaard: "Standaard",
  korter: "Korter",
  formeler: "Formeler",
  informeler: "Informeler",
};

export function MailPanel({ matchId, hasStyleProfile, initialDrafts, templates }: MailPanelProps) {
  const [drafts, setDrafts] = useState<MailDraft[]>(initialDrafts);
  const [templateId, setTemplateId] = useState<string>(templates.find((t) => t.isDefault)?.id ?? "");
  const [loadingVariant, setLoadingVariant] = useState<MailVariant | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(variant: MailVariant) {
    setLoadingVariant(variant);
    setError(null);
    try {
      const response = await fetch(`/api/matches/${matchId}/mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant, templateId: templateId || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Genereren van het mailconcept is mislukt.");
      setDrafts((prev) => [{ id: data.id, variant: data.variant, subject: data.subject, body: data.body, generatedAt: new Date() }, ...prev]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingVariant(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-muted">
        Automatisch gegenereerd concept — controleer de inhoud altijd voordat je het gebruikt. Er is geen verzendknop:
        versturen doe je zelf, in je eigen mailclient.
      </p>

      {!hasStyleProfile && (
        <p className="text-sm text-warning">
          ⚠ Er is nog geen stijlprofiel opgebouwd. Bouw er eerst één op via Instellingen voordat je een mailconcept
          genereert.
        </p>
      )}

      {templates.length > 0 && (
        <label className="flex max-w-xs flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink-muted">Mailtemplate</span>
          <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">Geen (alleen stijlprofiel)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.isDefault ? " (standaard)" : ""}
              </option>
            ))}
          </Select>
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        {(Object.keys(VARIANT_LABELS) as MailVariant[]).map((variant) => (
          <Button
            key={variant}
            variant="secondary"
            disabled={loadingVariant !== null || !hasStyleProfile}
            onClick={() => handleGenerate(variant)}
          >
            {loadingVariant === variant ? "Bezig…" : `Genereer ${VARIANT_LABELS[variant].toLowerCase()}`}
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-col gap-4">
        {drafts.map((draft) => (
          <DraftCard key={draft.id} matchId={matchId} draft={draft} />
        ))}
        {drafts.length === 0 && <p className="text-sm text-neutral-400">Nog geen mailconcept gegenereerd.</p>}
      </div>
    </div>
  );
}

function DraftCard({ matchId, draft }: { matchId: string; draft: MailDraft }) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [savedSubject, setSavedSubject] = useState(draft.subject);
  const [savedBody, setSavedBody] = useState(draft.body);
  const [saving, setSaving] = useState(false);
  const [copiedField, setCopiedField] = useState<"subject" | "body" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = subject !== savedSubject || body !== savedBody;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/matches/${matchId}/mail/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Opslaan is mislukt.");
      setSavedSubject(subject);
      setSavedBody(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy(field: "subject" | "body") {
    await navigator.clipboard.writeText(field === "subject" ? subject : body);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }

  return (
    <div className="rounded-lg border border-neutral-100 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {VARIANT_LABELS[draft.variant]}
        </span>
        <span className="text-xs text-neutral-400">{draft.generatedAt.toLocaleString("nl-NL")}</span>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="flex-1" />
          <Button variant="secondary" onClick={() => handleCopy("subject")}>
            {copiedField === "subject" ? "Gekopieerd" : "Kopieer onderwerp"}
          </Button>
        </div>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => handleCopy("body")}>
            {copiedField === "body" ? "Gekopieerd" : "Kopieer body"}
          </Button>
          <Button onClick={handleSave} disabled={!dirty || saving}>
            {saving ? "Opslaan…" : "Wijzigingen opslaan"}
          </Button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
