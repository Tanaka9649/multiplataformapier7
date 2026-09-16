"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Eye, Heart, MessageCircle, Pencil, Share2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ContentThumbnail } from "@/components/social/ContentThumbnail";
import { CONTENT_TYPE_LABELS } from "@/lib/socialMedia";
import type { SocialTopContent } from "@/types/database";
import { BUTTON_GHOST, CARD_SURFACE, cx, formatDatePtBR } from "@/lib/utils";

function formatCount(value: number | null): string | null {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

interface SocialContentCardProps {
  content: SocialTopContent;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function SocialContentCard({
  content,
  canMoveUp,
  canMoveDown,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: SocialContentCardProps) {
  const supabase = createClient();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (content.thumbnail_storage_path) {
      supabase.storage
        .from("social-content")
        .createSignedUrl(content.thumbnail_storage_path, 60 * 60)
        .then(({ data }) => {
          if (!cancelled) setSignedUrl(data?.signedUrl ?? null);
        });
    } else {
      setSignedUrl(null);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.thumbnail_storage_path]);

  const displaySrc = signedUrl ?? content.thumbnail_url;
  const stats: { icon: typeof Eye; value: string | null }[] = [
    { icon: Eye, value: formatCount(content.views) },
    { icon: Heart, value: formatCount(content.likes) },
    { icon: MessageCircle, value: formatCount(content.comments) },
    { icon: Share2, value: formatCount(content.shares) },
  ].filter((s) => s.value !== null);

  return (
    <div className={cx(CARD_SURFACE, "flex flex-col overflow-hidden p-0")}>
      <div className="aspect-video w-full">
        <ContentThumbnail src={displaySrc} alt={content.title} />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
            {CONTENT_TYPE_LABELS[content.content_type]}
          </span>
          {content.published_at && (
            <span className="text-xs text-slate-400 dark:text-zinc-500">{formatDatePtBR(content.published_at)}</span>
          )}
        </div>

        <h4 className="mb-2 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-zinc-50">{content.title}</h4>

        {stats.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
            {stats.map(({ icon: Icon, value }, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <Icon className="h-3 w-3" strokeWidth={2} />
                {value}
              </span>
            ))}
          </div>
        )}

        <a
          href={content.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cx(BUTTON_GHOST, "mt-auto w-full")}
        >
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
          Ver conteúdo
        </a>

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-zinc-800">
          <div className="flex gap-1">
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              aria-label="Mover para cima"
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 dark:text-zinc-500 dark:hover:bg-zinc-800"
            >
              <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              aria-label="Mover para baixo"
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 dark:text-zinc-500 dark:hover:bg-zinc-800"
            >
              <ArrowDown className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          </div>
          <div className="flex gap-1">
            <button
              onClick={onEdit}
              aria-label="Editar conteúdo"
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
            <button
              onClick={onDelete}
              aria-label="Excluir conteúdo"
              className="flex h-6 w-6 items-center justify-center rounded text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-red-500 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
