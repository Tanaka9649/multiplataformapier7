"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { BUTTON_PRIMARY, CARD_SURFACE, INPUT_BASE, LABEL_BASE, cx, uniqueFileName } from "@/lib/utils";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function SpreadsheetUploader({
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    if (!ACCEPTED_TYPES.includes(f.type)) {
      showToast("Formato de imagem não suportado. Use PNG, JPG, WEBP ou GIF.", "error");
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      showToast("Imagem muito grande. O limite é 10MB.", "error");
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function resetForm() {
    setFile(null);
    setPreviewUrl(null);
    setPeriodStart("");
    setPeriodEnd("");
    setDescription("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      showToast("Selecione uma imagem para enviar.", "error");
      return;
    }

    setUploading(true);
    try {
      const path = `${companyId}/${uniqueFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("spreadsheet-images")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("spreadsheet_uploads").insert({
        company_id: companyId,
        storage_path: path,
        period_start: periodStart || null,
        period_end: periodEnd || null,
        description: description || null,
      });
      if (insertError) throw insertError;

      showToast("Documento adicionado.", "success");
      resetForm();
      onUploaded();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Não foi possível enviar o documento.",
        "error"
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cx(CARD_SURFACE, "mb-6 p-4 sm:p-5")}>
      <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-zinc-100">
        Adicionar documento
      </h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={LABEL_BASE}>Imagem</label>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 file:transition-colors hover:file:bg-brand-100 dark:text-zinc-400 dark:file:bg-brand-900 dark:file:text-brand-200 dark:hover:file:bg-brand-800"
          />
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Pré-visualização"
              className="mt-3 max-h-48 animate-fade-in rounded-lg border border-slate-200 object-contain dark:border-zinc-800"
            />
          )}
        </div>

        <div>
          <label className={LABEL_BASE}>Período inicial</label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className={INPUT_BASE}
          />
        </div>
        <div>
          <label className={LABEL_BASE}>Período final</label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className={INPUT_BASE}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL_BASE}>Descrição</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Relatório semanal de campanhas"
            className={INPUT_BASE}
          />
        </div>
      </div>

      <button type="submit" disabled={uploading} className={`mt-4 ${BUTTON_PRIMARY}`}>
        {uploading ? "Enviando..." : "Adicionar documento"}
      </button>
    </form>
  );
}
