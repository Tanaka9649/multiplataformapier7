export type MetricFormat = "currency" | "integer" | "percentage";
export type CalendarItemType = "reels" | "story" | "post" | "tarefa";
export type CalendarItemStatus = "pendente" | "concluido" | "atrasado";
export type UserRole = "admin" | "member";

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo_path: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface MetricDefinition {
  key: string;
  label: string;
  format: MetricFormat;
  sort_order: number;
}

export interface CompanyMetricConfig {
  company_id: string;
  metric_key: string;
  visible: boolean;
  label_override: string | null;
  sort_order: number;
}

export interface MetricValue {
  company_id: string;
  metric_key: string;
  value: number;
  updated_at: string;
}

export interface CalendarItem {
  id: string;
  company_id: string;
  date: string;
  type: CalendarItemType;
  status: CalendarItemStatus;
  description: string | null;
  objective: string | null;
  responsible: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpreadsheetUpload {
  id: string;
  company_id: string;
  storage_path: string;
  period_start: string | null;
  period_end: string | null;
  description: string | null;
  created_at: string;
}

export interface QualifiedLeadFile {
  id: string;
  company_id: string;
  storage_path: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  role: UserRole;
  created_at: string;
}

export interface CompanyObservation {
  id: string;
  company_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export type GoalValueSource = "metric" | "manual";

export interface CompanyGoal {
  id: string;
  company_id: string;
  name: string;
  metric_key: string | null;
  value_source: GoalValueSource;
  manual_current_value: number | null;
  target_value: number;
  period_start: string | null;
  period_end: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type LeadOrigin = "instagram" | "evento" | "prospeccao" | "trafego_pago";
export type LeadStatus = "abandonou" | "conversando" | "reuniao_marcada" | "contrato_fechado";

export interface Lead {
  id: string;
  company_id: string;
  entry_date: string;
  name: string;
  phone: string;
  service_interest: string;
  origin: LeadOrigin;
  responsible: string;
  qualification: number;
  status: LeadStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

/** Métrica já combinada (definição + config da empresa + valor atual),
 *  pronta para renderizar um MetricCard. */
export interface ResolvedMetric {
  key: string;
  label: string;
  format: MetricFormat;
  sort_order: number;
  value: number;
}

// Tipo mínimo compatível com o client tipado do supabase-js.
// (mantemos simples de propósito — o projeto não depende de geração
// automática de tipos a partir do banco.)
export type Database = any;

// ---------------------------------------------------------------------
// Redes Sociais
// ---------------------------------------------------------------------
export type SocialNetwork = "instagram" | "tiktok" | "youtube";
export type SocialContentType = "reel" | "carrossel" | "post" | "video" | "short";

export interface SocialMediaPeriod {
  id: string;
  company_id: string;
  network: SocialNetwork;
  year: number;
  month: number;
  followers: number | null;
  new_followers: number | null;
  reach: number | null;
  impressions: number | null;
  profile_views: number | null;
  link_clicks: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  watch_hours: number | null;
  reels_count: number | null;
  carousel_count: number | null;
  static_posts_count: number | null;
  stories_count: number | null;
  videos_count: number | null;
  shorts_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface SocialStoryWeek {
  id: string;
  social_period_id: string;
  week_number: number;
  average_views: number;
  created_at: string;
  updated_at: string;
}

export interface SocialTopContent {
  id: string;
  company_id: string;
  network: SocialNetwork;
  year: number;
  month: number;
  content_type: SocialContentType;
  title: string;
  url: string;
  thumbnail_url: string | null;
  thumbnail_storage_path: string | null;
  published_at: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
