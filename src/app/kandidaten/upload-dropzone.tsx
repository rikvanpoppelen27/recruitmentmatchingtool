"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, type DragEvent, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface UploadResult {
  fileName: string;
  success: boolean;
  error?: string;
  fullName?: string | null;
  outcome?: "new" | "updated";
}

export function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function uploadFiles(files: FileList | File[]) {
    const fileArray = Array.from(files).filter(
      (f) => f.name.toLowerCase().endsWith(".pdf") || f.name.toLowerCase().endsWith(".docx"),
    );
    if (fileArray.length === 0) {
      setError("Alleen .pdf- en .docx-bestanden worden ondersteund.");
      return;
    }

    setUploading(true);
    setError(null);
    setResults(null);

    try {
      const formData = new FormData();
      for (const file of fileArray) formData.append("files", file);

      const response = await fetch("/api/candidates/upload", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Upload mislukt.");
      setResults(data.results as UploadResult[]);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) void uploadFiles(e.dataTransfer.files);
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) void uploadFiles(e.target.files);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center text-sm transition-colors",
          dragging ? "border-neutral-500 bg-neutral-50" : "border-neutral-300",
        )}
      >
        <p className="font-medium text-ink-muted">
          {uploading ? "Bezig met verwerken…" : "Sleep CV's hierheen, of klik om te kiezen"}
        </p>
        <p className="mt-1 text-xs text-ink-muted">PDF of DOCX, één of meer bestanden tegelijk</p>
        <input ref={inputRef} type="file" multiple accept=".pdf,.docx" className="hidden" onChange={handleFileInputChange} />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {results && (
        <ul className="flex flex-col gap-1 text-sm">
          {results.map((r) => (
            <li key={r.fileName} className={r.success ? "text-success" : "text-danger"}>
              {r.success
                ? `✓ ${r.fileName} — ${r.fullName ?? "naam onbekend"} (${r.outcome === "new" ? "nieuw" : "bijgewerkt"})`
                : `✗ ${r.fileName} — ${r.error}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
