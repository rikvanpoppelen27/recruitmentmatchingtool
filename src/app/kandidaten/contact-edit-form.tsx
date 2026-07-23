"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ContactEditFormProps {
  candidateId: string;
  email: string | null;
  phone: string | null;
}

export function ContactEditForm({ candidateId, email, phone }: ContactEditFormProps) {
  const router = useRouter();
  const [emailValue, setEmailValue] = useState(email ?? "");
  const [phoneValue, setPhoneValue] = useState(phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = emailValue !== (email ?? "") || phoneValue !== (phone ?? "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue, phone: phoneValue }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Opslaan mislukt.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <Input
          value={emailValue}
          onChange={(e) => setEmailValue(e.target.value)}
          placeholder="⚠ ontbreekt"
          className="h-8 w-40 text-xs"
        />
      </div>
      <div className="flex items-center gap-1">
        <Input
          value={phoneValue}
          onChange={(e) => setPhoneValue(e.target.value)}
          placeholder="⚠ ontbreekt"
          className="h-8 w-40 text-xs"
        />
      </div>
      {dirty && (
        <Button onClick={handleSave} disabled={saving} className="h-7 px-2 text-xs">
          {saving ? "Opslaan…" : "Opslaan"}
        </Button>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
