"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { BUTTON_PRIMARY, CARD_SURFACE, LABEL_BASE, cx, uniqueFileName } from "@/lib/utils";

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export function QualifiedLeadUploader({
  companyId,
  onUploaded,
}: {
  companyId: string;
  onUploaded: () => void;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_SIZE_BYTES) {
      showToast("Arquivo muito grande. O limite é 25MB.", "error");
      return;
    }
    setFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      showToast("Selecione um arquivo para enviar.", "error");
      return;
    }

    setUploading(true);
    try {
      const path = `${companyId}/${uniqueFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("qualified-leads")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("qualified_lead_files").insert({
        company_id: companyId,
        storage_path: path,
        original_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (insertError) throw insertError;

      showToast("Arquivo enviado.", "success");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploaded();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Não foi possível enviar o arquivo.",
        "error"
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cx(CARD_SURFACE, "mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5")}
    >
      <div className="flex-1">
        <label className={LABEL_BASE}>Arquivo</label>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="block w-full text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 file:transition-colors hover:file:bg-brand-100 dark:text-zinc-400 dark:file:bg-brand-900 dark:file:text-brand-200 dark:hover:file:bg-brand-800"
        />
      </div>
      <button type="submit" disabled={uploading} className={`shrink-0 ${BUTTON_PRIMARY}`}>
        {uploading ? "Enviando..." : "Enviar"}
      </button>
    </form>
  );
}
