"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";

export interface MailTemplateData {
  id: string;
  name: string;
  description: string | null;
  systemInstruction: string;
  isDefault: boolean;
}

export function MailTemplatesSection({ templates }: { templates: MailTemplateData[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSetDefault(id: string) {
    setError(null);
    try {
      const response = await fetch(`/api/mail-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Bijwerken mislukt.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Dit mailtemplate verwijderen?")) return;
    setError(null);
    try {
      const response = await fetch(`/api/mail-templates/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Verwijderen mislukt.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Het standaardtemplate wordt gebruikt door de shortlist-automatisering. In het mailpaneel per match kun je
        altijd een ander template kiezen.
      </p>

      <div className="flex flex-col gap-3">
        {templates.map((template) => (
          <div key={template.id} className="rounded-lg border border-neutral-100 p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink">{template.name}</span>
                {template.isDefault && <Badge variant="success">Standaard</Badge>}
              </div>
              <div className="flex gap-2">
                <MailTemplateForm
                  trigger={
                    <button type="button" className="text-xs text-ink-muted underline">
                      Bewerken
                    </button>
                  }
                  initialValues={template}
                />
                {!template.isDefault && (
                  <button type="button" className="text-xs text-ink-muted underline" onClick={() => handleSetDefault(template.id)}>
                    Als standaard instellen
                  </button>
                )}
                <button type="button" className="text-xs text-danger underline" onClick={() => handleDelete(template.id)}>
                  Verwijderen
                </button>
              </div>
            </div>
            {template.description && <p className="text-sm text-ink-muted">{template.description}</p>}
            <p className="mt-1 text-xs text-neutral-400">{template.systemInstruction}</p>
          </div>
        ))}
        {templates.length === 0 && <p className="text-sm text-neutral-400">Nog geen mailtemplates.</p>}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div>
        <MailTemplateForm trigger={<Button>Mailtemplate aanmaken</Button>} />
      </div>
    </div>
  );
}

const EMPTY_TEMPLATE = { name: "", description: "", systemInstruction: "", isDefault: false };

function MailTemplateForm({
  trigger,
  initialValues,
}: {
  trigger: ReactNode;
  initialValues?: MailTemplateData;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(
    initialValues
      ? {
          name: initialValues.name,
          description: initialValues.description ?? "",
          systemInstruction: initialValues.systemInstruction,
          isDefault: initialValues.isDefault,
        }
      : EMPTY_TEMPLATE,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(initialValues);

  function handleClose() {
    setOpen(false);
    setValues(
      initialValues
        ? {
            name: initialValues.name,
            description: initialValues.description ?? "",
            systemInstruction: initialValues.systemInstruction,
            isDefault: initialValues.isDefault,
          }
        : EMPTY_TEMPLATE,
    );
    setError(null);
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const url = isEdit ? `/api/mail-templates/${initialValues!.id}` : "/api/mail-templates";
      const method = isEdit ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Opslaan mislukt.");
      handleClose();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onClose={handleClose} title={isEdit ? "Mailtemplate bewerken" : "Mailtemplate aanmaken"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-ink-muted">Naam *</span>
            <Input value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-ink-muted">Korte omschrijving</span>
            <Input
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-ink-muted">Instructie voor genereerMail *</span>
            <Textarea
              value={values.systemInstruction}
              onChange={(e) => setValues((v) => ({ ...v, systemInstruction: e.target.value }))}
              rows={4}
              placeholder="bv. korte introductiemail aan een bekende opdrachtgever, informeel, maximaal 150 woorden"
              required
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={values.isDefault}
              onChange={(e) => setValues((v) => ({ ...v, isDefault: e.target.checked }))}
              className="h-4 w-4 rounded border-neutral-300"
            />
            Als standaardtemplate instellen
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Annuleren
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Bezig…" : "Opslaan"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
