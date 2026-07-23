"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";

interface DuplicateInfo {
  id: string;
  title: string;
  companyName: string;
  location: string;
}

const EMPTY_FORM = {
  title: "",
  companyName: "",
  description: "",
  location: "",
  sourceUrl: "",
  contactPerson: "",
};

export function AddVacancyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);

  function updateField<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    setOpen(false);
    setForm(EMPTY_FORM);
    setError(null);
    setDuplicate(null);
  }

  async function submit(force: boolean) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/vacancies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, force }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Opslaan is mislukt.");

      if (data.status === "duplicate") {
        setDuplicate(data.existing);
        return;
      }

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
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Vacature toevoegen
      </Button>

      <Dialog open={open} onClose={handleClose} title="Vacature toevoegen">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(false);
          }}
          className="flex flex-col gap-3"
        >
          <Field label="Functietitel *">
            <Input value={form.title} onChange={(e) => updateField("title", e.target.value)} required />
          </Field>
          <Field label="Bedrijf *">
            <Input value={form.companyName} onChange={(e) => updateField("companyName", e.target.value)} required />
          </Field>
          <Field label="Vacaturetekst *">
            <Textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={6}
              required
            />
          </Field>
          <Field label="Plaats/regio">
            <Input value={form.location} onChange={(e) => updateField("location", e.target.value)} />
          </Field>
          <Field label="URL naar de originele vacature">
            <Input
              type="url"
              value={form.sourceUrl}
              onChange={(e) => updateField("sourceUrl", e.target.value)}
              placeholder="https://..."
            />
          </Field>
          <Field label="Contactpersoon / manager">
            <Input value={form.contactPerson} onChange={(e) => updateField("contactPerson", e.target.value)} />
          </Field>

          {duplicate && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <p>
                Lijkt op een bestaande vacature: <strong>{duplicate.title}</strong> bij {duplicate.companyName} (
                {duplicate.location}).
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-2"
                onClick={() => void submit(true)}
                disabled={saving}
              >
                Toch toevoegen
              </Button>
            </div>
          )}

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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
