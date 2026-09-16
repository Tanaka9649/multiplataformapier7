"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/Modal";
import { ContentThumbnail } from "@/components/social/ContentThumbnail";
import { useToast } from "@/components/Toast";
import { CONTENT_TYPES_BY_NETWORK, getYoutubeThumbnailUrl } from "@/lib/socialMedia";
import type { SocialContentType, SocialNetwork, SocialTopContent } from "@/types/database";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_BASE, LABEL_BASE, cx, uniqueFileName } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

interface SocialContentModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  network: SocialNetwork;
  year: number;
  month: number;
  existing: SocialTopContent | null;
  nextSortOrder: number;
  onSaved: () => void;
}

export function SocialContentModal({
  open,
  onClose,
  companyId,
  network,
  year,
  month,
  existing,
  nextSortOrder,
  onSaved,
}: SocialContentModalProps) {
  const supabase = createClient();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const typeOptions = CONTENT_TYPES_BY_NETWORK[network];

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<SocialContentType>(typeOptions[0]?.value ?? "post");
  const [publishedAt, setPublishedAt] = useState("");
  const [views, setViews] = useState("");
  const [likes, setLikes] = useState("");
  const [comments, setComments] = useState("");
  const [shares, setShares] = useState("");
  const [saves, setSaves] = useState("");
  const [notes, setNotes] = useState("");

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [existingThumbnailUrl, setExistingThumbnailUrl] = useState<string | null>(null);
  const [existingSignedUrl, setExistingSignedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUrl(existing?.url ?? "");
    setTitle(existing?.title ?? "");
    setContentType(existing?.content_type ?? typeOptions[0]?.value ?? "post");
    setPublishedAt(existing?.published_at ?? "");
    setViews(existing?.views != null ? String(existing.views) : "");
    setLikes(existing?.likes != null ? String(existing.likes) : "");
    setComments(existing?.comments != null ? String(existing.comments) : "");
    setShares(existing?.shares != null ? String(existing.shares) : "");
    setSaves(existing?.saves != null ? String(existing.saves) : "");
    setNotes(existing?.notes ?? "");
    setCoverFile(null);
    setCoverPreview(null);
    setExistingThumbnailUrl(existing?.thumbnail_url ?? null);

    if (existing?.thumbnail_storage_path) {
      supabase.storage
        .from("social-content")
        .createSignedUrl(existing.thumbnail_storage_path, 60 * 60)
        .then(({ data }) => setExistingSignedUrl(data?.signedUrl ?? null));
    } else {
      setExistingSignedUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing]);

  // Capa automática do YouTube: só entra em cena se o usuário ainda não subiu uma capa manual.
  useEffect(() => {
    if (network !== "youtube" || coverFile) return;
    const auto = getYoutubeThumbnailUrl(url);
    if (auto) setExistingThumbnailUrl(auto);
  }, [url, network, coverFile]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      showToast("Formato de imagem não suportado. Use JPG, PNG ou WEBP.", "error");
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      showToast("Imagem muito grande. O limite é 8MB.", "error");
      return;
    }
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  }

  function parseNumeric(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }

  /** Best-effort: tenta copiar a thumbnail automática (YouTube) para o Storage,
   *  para reduzir dependência de URL externa. Se falhar (CORS, rede etc.),
   *  seguimos normalmente usando a URL externa como está. */
  async function tryCopyExternalThumbnailToStorage(sourceUrl: string): Promise<string | null> {
    try {
      const res = await fetch(sourceUrl);
      if (!res.ok) return null;
      const blob = await res.blob();
      const path = `${companyId}/${network}/${year}/${month}/${uniqueFileName("capa.jpg")}`;
      const { error } = await supabase.storage.from("social-content").upload(path, blob, {
        upsert: false,
        contentType: blob.type || "image/jpeg",
      });
      if (error) return null;
      return path;
    } catch {
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || !title.trim()) {
      showToast("Preencha ao menos o link e o título.", "error");
      return;
    }

    setSaving(true);
    try {
      let thumbnailUrl: string | null = existing?.thumbnail_url ?? null;
      let thumbnailStoragePath: string | null = existing?.thumbnail_storage_path ?? null;

      if (coverFile) {
        // Upload manual sempre tem prioridade.
        const path = `${companyId}/${network}/${year}/${month}/${uniqueFileName(coverFile.name)}`;
        const { error: uploadError } = await supabase.storage
          .from("social-content")
          .upload(path, coverFile, { upsert: false });
        if (uploadError) throw uploadError;
        thumbnailStoragePath = path;
        thumbnailUrl = null;
      } else if (network === "youtube") {
        const auto = getYoutubeThumbnailUrl(url);
        if (auto && auto !== existing?.thumbnail_url) {
          const copiedPath = await tryCopyExternalThumbnailToStorage(auto);
          if (copiedPath) {
            thumbnailStoragePath = copiedPath;
            thumbnailUrl = auto;
          } else {
            thumbnailUrl = auto;
            thumbnailStoragePath = null;
          }
        }
      }

      const payload = {
        company_id: companyId,
        network,
        year,
        month,
        content_type: contentType,
        title: title.trim(),
        url: url.trim(),
        thumbnail_url: thumbnailUrl,
        thumbnail_storage_path: thumbnailStoragePath,
        published_at: publishedAt || null,
        views: parseNumeric(views),
        likes: parseNumeric(likes),
        comments: parseNumeric(comments),
        shares: parseNumeric(shares),
        saves: parseNumeric(saves),
        notes: notes.trim() || null,
        sort_order: existing?.sort_order ?? nextSortOrder,
      };

      if (existing) {
        const { error } = await supabase.from("social_top_contents").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("social_top_contents").insert(payload);
        if (error) throw error;
      }

      showToast("Salvo.", "success");
      onSaved();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível salvar o conteúdo.", "error");
    } finally {
      setSaving(false);
    }
  }

  const previewSrc = coverPreview ?? existingSignedUrl ?? existingThumbnailUrl;

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title={existing ? "Editar conteúdo" : "Adicionar conteúdo"}
      size="lg"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className={BUTTON_SECONDARY}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving} className={BUTTON_PRIMARY}>
            {saving ? "Salvando..." : "Salvar conteúdo"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={LABEL_BASE}>Capa</label>
            <div className="flex items-center gap-3">
              <div className="h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-zinc-800">
                <ContentThumbnail src={previewSrc} alt="Pré-visualização da capa" />
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={BUTTON_SECONDARY}
                >
                  {previewSrc ? "Alterar capa" : "Adicionar capa"}
                </button>
                {network === "youtube" && !coverFile && (
                  <p className="mt-1.5 text-xs text-slate-400 dark:text-zinc-500">
                    Capa obtida automaticamente pelo link do YouTube.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className={LABEL_BASE}>Link</label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className={INPUT_BASE}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={LABEL_BASE}>Título / nome</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={INPUT_BASE}
            />
          </div>

          <div>
            <label className={LABEL_BASE}>Tipo</label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value as SocialContentType)}
              className={INPUT_BASE}
            >
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL_BASE}>Data</label>
            <input
              type="date"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className={INPUT_BASE}
            />
          </div>

          <div>
            <label className={LABEL_BASE}>Visualizações</label>
            <input type="number" value={views} onChange={(e) => setViews(e.target.value)} className={INPUT_BASE} placeholder="0" />
          </div>
          <div>
            <label className={LABEL_BASE}>Curtidas</label>
            <input type="number" value={likes} onChange={(e) => setLikes(e.target.value)} className={INPUT_BASE} placeholder="0" />
          </div>
          <div>
            <label className={LABEL_BASE}>Comentários</label>
            <input type="number" value={comments} onChange={(e) => setComments(e.target.value)} className={INPUT_BASE} placeholder="0" />
          </div>
          <div>
            <label className={LABEL_BASE}>Compartilhamentos</label>
            <input type="number" value={shares} onChange={(e) => setShares(e.target.value)} className={INPUT_BASE} placeholder="0" />
          </div>
          <div>
            <label className={LABEL_BASE}>Salvamentos (quando aplicável)</label>
            <input type="number" value={saves} onChange={(e) => setSaves(e.target.value)} className={INPUT_BASE} placeholder="0" />
          </div>

          <div className="sm:col-span-2">
            <label className={LABEL_BASE}>Observação</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={cx(INPUT_BASE, "resize-none")}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
