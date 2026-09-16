import type { SocialContentType, SocialNetwork } from "@/types/database";

/**
 * Configuração central do módulo de Redes Sociais.
 *
 * Regra de negócio: todas as empresas têm Instagram; somente a Pier7
 * também tem TikTok e YouTube. Esta é a ÚNICA fonte de verdade para essa
 * regra — nenhum outro arquivo deve checar `slug === "pier7"` para decidir
 * quais redes mostrar. Para liberar TikTok/YouTube para outra empresa no
 * futuro, basta editar `SOCIAL_NETWORKS_BY_SLUG` abaixo.
 */
const DEFAULT_NETWORKS: SocialNetwork[] = ["instagram"];

const SOCIAL_NETWORKS_BY_SLUG: Record<string, SocialNetwork[]> = {
  pier7: ["instagram", "tiktok", "youtube"],
};

export function getSocialNetworksForCompany(slug: string): SocialNetwork[] {
  return SOCIAL_NETWORKS_BY_SLUG[slug] ?? DEFAULT_NETWORKS;
}

export const SOCIAL_NETWORK_LABELS: Record<SocialNetwork, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export interface SocialField {
  key: string;
  label: string;
}

/** Cards de métricas exibidos por rede (não inclui produção nem stories). */
export const METRIC_FIELDS_BY_NETWORK: Record<SocialNetwork, SocialField[]> = {
  instagram: [
    { key: "followers", label: "Seguidores atuais" },
    { key: "new_followers", label: "Novos seguidores no mês" },
    { key: "reach", label: "Alcance" },
    { key: "impressions", label: "Impressões / Visualizações" },
    { key: "profile_views", label: "Visitas ao perfil" },
    { key: "link_clicks", label: "Cliques no link" },
    { key: "likes", label: "Curtidas" },
    { key: "comments", label: "Comentários" },
    { key: "shares", label: "Compartilhamentos" },
    { key: "saves", label: "Salvamentos" },
  ],
  tiktok: [
    { key: "followers", label: "Seguidores atuais" },
    { key: "new_followers", label: "Novos seguidores" },
    { key: "impressions", label: "Visualizações" },
    { key: "profile_views", label: "Visualizações do perfil" },
    { key: "likes", label: "Curtidas" },
    { key: "comments", label: "Comentários" },
    { key: "shares", label: "Compartilhamentos" },
  ],
  youtube: [
    { key: "followers", label: "Inscritos atuais" },
    { key: "new_followers", label: "Novos inscritos" },
    { key: "impressions", label: "Visualizações" },
    { key: "watch_hours", label: "Horas de exibição" },
  ],
};

/** Indicadores de produção do mês, exibidos como cards menores. */
export const PRODUCTION_FIELDS_BY_NETWORK: Record<SocialNetwork, SocialField[]> = {
  instagram: [
    { key: "reels_count", label: "Reels publicados" },
    { key: "carousel_count", label: "Carrosséis publicados" },
    { key: "static_posts_count", label: "Posts estáticos publicados" },
    { key: "stories_count", label: "Stories publicados" },
  ],
  tiktok: [{ key: "videos_count", label: "Vídeos publicados" }],
  youtube: [
    { key: "videos_count", label: "Vídeos publicados" },
    { key: "shorts_count", label: "Shorts publicados" },
  ],
};

/** Métricas com comparação automática vs. mês anterior (as demais de produção não comparam). */
export const COMPARABLE_METRIC_KEYS = [
  "followers",
  "reach",
  "impressions",
  "profile_views",
  "link_clicks",
  "likes",
  "comments",
  "shares",
  "saves",
  "watch_hours",
];

export const CONTENT_TYPES_BY_NETWORK: Record<SocialNetwork, { value: SocialContentType; label: string }[]> = {
  instagram: [
    { value: "reel", label: "Reel" },
    { value: "carrossel", label: "Carrossel" },
    { value: "post", label: "Post" },
  ],
  tiktok: [{ value: "video", label: "Vídeo" }],
  youtube: [
    { value: "video", label: "Vídeo" },
    { value: "short", label: "Short" },
  ],
};

export const CONTENT_TYPE_LABELS: Record<SocialContentType, string> = {
  reel: "Reel",
  carrossel: "Carrossel",
  post: "Post",
  video: "Vídeo",
  short: "Short",
};

export const MONTH_LABELS_PT_BR = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function formatMonthYear(year: number, month: number): string {
  return `${MONTH_LABELS_PT_BR[month - 1]} de ${year}`;
}

/** Move (ano, mês) N passos à frente (N negativo anda para trás). */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 };
}

/** Extrai o ID de um vídeo do YouTube a partir de várias formas de URL. */
export function extractYoutubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1) || null;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] ?? null;
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Thumbnail oficial e estável do YouTube — não requer autenticação nem scraping. */
export function getYoutubeThumbnailUrl(url: string): string | null {
  const id = extractYoutubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}
