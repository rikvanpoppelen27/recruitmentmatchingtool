"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { PROVINCES } from "@/config/provinces";
import { BooleanQuerySyntaxError, describeBooleanQuery } from "@/lib/search/boolean-query";

export interface SearchProfileFormValues {
  id?: string;
  name: string;
  query: string;
  provinces: string[];
  maxDaysOld: number;
  titleOnly: boolean;
  isActive: boolean;
}

const EMPTY_VALUES: SearchProfileFormValues = {
  name: "",
  query: "",
  provinces: [],
  maxDaysOld: 7,
  titleOnly: false,
  isActive: true,
};

interface SearchProfileFormProps {
  trigger: React.ReactNode;
  initialValues?: SearchProfileFormValues;
}

export function SearchProfileForm({ trigger, initialValues }: SearchProfileFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<SearchProfileFormValues>(initialValues ?? EMPTY_VALUES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(initialValues?.id);

  const interpretation = useMemo(() => {
    if (values.query.trim().length === 0) return null;
    try {
      return { description: describeBooleanQuery(values.query), error: null as string | null };
    } catch (err) {
      return { description: null, error: err instanceof BooleanQuerySyntaxError ? err.message : "Ongeldige zoekterm." };
    }
  }, [values.query]);

  function updateField<K extends keyof SearchProfileFormValues>(key: K, value: SearchProfileFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function toggleProvince(code: string) {
    setValues((prev) => ({
      ...prev,
      provinces: prev.provinces.includes(code) ? prev.provinces.filter((c) => c !== code) : [...prev.provinces, code],
    }));
  }

  function handleClose() {
    setOpen(false);
    setValues(initialValues ?? EMPTY_VALUES);
    setError(null);
  }

  async function handleSubmit() {
    if (interpretation?.error) {
      setError(interpretation.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = isEdit ? `/api/search-profiles/${values.id}` : "/api/search-profiles";
      const method = isEdit ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Opslaan is mislukt.");
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

      <Dialog open={open} onClose={handleClose} title={isEdit ? "Zoekprofiel bewerken" : "Zoekprofiel aanmaken"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="flex flex-col gap-3"
        >
          <Field label="Naam *">
            <Input value={values.name} onChange={(e) => updateField("name", e.target.value)} required />
          </Field>

          <Field label="Booleaanse zoekterm *">
            <Textarea
              value={values.query}
              onChange={(e) => updateField("query", e.target.value)}
              rows={3}
              placeholder='bv. ("front-end" OR frontend) AND (react OR vue) NOT stage'
              required
            />
          </Field>

          {interpretation?.error && <p className="text-sm text-red-700">{interpretation.error}</p>}
          {interpretation?.description && (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
              <p>
                <strong>Moet bevatten:</strong>{" "}
                {interpretation.description.mustContain.length > 0 ? interpretation.description.mustContain.join(", ") : "—"}
              </p>
              <p>
                <strong>Mag bevatten:</strong>{" "}
                {interpretation.description.mayContain.length > 0 ? interpretation.description.mayContain.join(", ") : "—"}
              </p>
              <p>
                <strong>Uitgesloten:</strong>{" "}
                {interpretation.description.excluded.length > 0 ? interpretation.description.excluded.join(", ") : "—"}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500">Provincies *</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs text-neutral-500 underline"
                  onClick={() => updateField("provinces", PROVINCES.map((p) => p.code))}
                >
                  Alles selecteren
                </button>
                <button
                  type="button"
                  className="text-xs text-neutral-500 underline"
                  onClick={() => updateField("provinces", [])}
                >
                  Selectie wissen
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-md border border-neutral-200 p-2 sm:grid-cols-3">
              {PROVINCES.map((province) => (
                <label key={province.code} className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={values.provinces.includes(province.code)}
                    onChange={() => toggleProvince(province.code)}
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  {province.name}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Max. dagen oud">
              <Input
                type="number"
                min={1}
                max={90}
                value={values.maxDaysOld}
                onChange={(e) => updateField("maxDaysOld", Number(e.target.value))}
              />
            </Field>
            <div className="flex flex-col justify-end gap-2 pb-2">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={values.titleOnly}
                  onChange={(e) => updateField("titleOnly", e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                Alleen in functietitel zoeken
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={values.isActive}
                  onChange={(e) => updateField("isActive", e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                Actief (draait mee in de import)
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Annuleren
            </Button>
            <Button type="submit" disabled={saving || values.provinces.length === 0}>
              {saving ? "Bezig…" : "Opslaan"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
