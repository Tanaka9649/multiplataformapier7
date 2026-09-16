"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cx } from "@/lib/utils";

/**
 * Sempre exibe algo elegante, nunca um ícone de imagem quebrada:
 * enquanto não há `src`, ou se o `src` falhar ao carregar, cai no
 * placeholder. `onError` do <img> garante o fallback também para URLs
 * externas que pararem de funcionar depois de salvas.
 */
export function ContentThumbnail({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const showPlaceholder = !src || failed;

  return (
    <div className={cx("relative h-full w-full overflow-hidden bg-slate-100 dark:bg-zinc-800", className)}>
      {showPlaceholder ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-300 dark:text-zinc-600">
          <ImageOff className="h-6 w-6" strokeWidth={1.5} />
          <span className="text-[11px] font-medium">Sem capa</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
