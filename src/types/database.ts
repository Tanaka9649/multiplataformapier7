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
  title: string;
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
export type LeadStatus = "abandonou" | "conversando" | "follow_up" | "reuniao_marcada" | "contrato_fechado";

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

// ---------------------------------------------------------------------
// Follow-up — acompanhamento comercial sobre leads já cadastrados no
// Controle de Leads. Nunca duplica o lead: sempre referencia lead_id.
// ---------------------------------------------------------------------
export type FollowUpActionType = "whatsapp" | "ligacao" | "mensagem" | "outro";

export interface FollowUpRecord {
  id: string;
  lead_id: string;
  company_id: string;
  stage_number: number;
  action_type: FollowUpActionType;
  completed_at: string;
  completed_time: string | null;
  responsible: string;
  notes: string;
  requires_next_contact: boolean;
  next_contact_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  cycle_id: string | null;
  schedule_id: string | null;
  result: FollowUpResult | null;
  delay_hours: number | null;
}

export interface FollowUpScript {
  id: string;
  company_id: string;
  service_interest: string | null;
  stage_number: number;
  content: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FollowUpPlaybook {
  id: string;
  company_id: string;
  service_interest: string | null;
  content: string;
  active: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type FollowUpResult = "no_answer" | "responded" | "interested" | "meeting_scheduled" | "no_interest";

export interface FollowUpCadenceStage {
  id: string;
  cadence_id: string;
  stage_number: number;
  delay_min_hours: number;
  delay_max_hours: number;
  created_at: string;
  updated_at: string;
}

export interface FollowUpCadence {
  id: string;
  company_id: string;
  name: string;
  service_interest: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  follow_up_cadence_stages?: FollowUpCadenceStage[];
}

export interface FollowUpStageSchedule {
  id: string;
  cycle_id: string;
  lead_id: string;
  company_id: string;
  stage_number: number;
  window_start_at: string;
  deadline_at: string;
  status: "pending" | "completed" | "skipped" | "cancelled";
  completed_record_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FollowUpNotification {
  schedule_id: string;
  company_id: string;
  company_slug: string;
  company_name: string;
  lead_id: string;
  lead_name: string;
  responsible: string;
  stage_number: number;
  window_start_at: string;
  deadline_at: string;
  read_at: string | null;
  urgency: "due_soon" | "overdue" | "scheduled";
}

export type FollowUpOutcome = "success" | "no_response";
export type FollowUpCycleStatus = "active" | "completed";

/** Uma linha por lead com o resumo do follow-up mais recente — espelha a
 *  view `follow_up_lead_summary` (ver supabase/migrations/0015). */
export interface FollowUpLeadSummary {
  lead_id: string;
  company_id: string;
  name: string;
  phone: string;
  service_interest: string;
  responsible: string;
  status: LeadStatus;
  current_stage: number | null;
  last_contact_at: string | null;
  next_contact_at: string | null;
  last_notes: string | null;
  cycle_status: FollowUpCycleStatus | null;
  outcome: FollowUpOutcome | null;
  cycle_completed_at: string | null;
  cycle_id: string | null;
  next_schedule_id: string | null;
  next_stage: number | null;
  window_start_at: string | null;
  deadline_at: string | null;
  schedule_status: "pending" | "completed" | "skipped" | "cancelled" | null;
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
// Usuários, aprovação de acesso e permissões
// ---------------------------------------------------------------------
export type UserStatus = "pending" | "active" | "suspended" | "rejected";
export type SystemRole = "owner" | "member";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "member";
  status: UserStatus;
  system_role: SystemRole;
  permission_profile_id: string | null;
  approved_at: string | null;
  approved_by: string | null;
  suspended_at: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface PermissionProfile {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface AdminAuditLog {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

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
