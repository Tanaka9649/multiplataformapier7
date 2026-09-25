/**
 * Registry central de módulos e ações do sistema de permissões.
 *
 * Única fonte de verdade usada pela UI de Administração (matriz de
 * permissões) e pelo hook usePermissions(). As strings de module_key e
 * action aqui precisam corresponder exatamente às usadas nas policies de
 * RLS (ver supabase/migrations/0010_permissions.sql, has_permission()).
 *
 * `implemented` marca se o módulo tem um gate de RLS real por trás. Os
 * módulos de Eventos (events_*) vivem em outro app Next.js (o formulário
 * de eventos), mas usam o MESMO projeto Supabase — e a RLS de lá já
 * chama has_permission()/has_event_permission() com exatamente estas
 * module_key/action, então marcá-los aqui é real, não decorativo. Só a
 * UI de administração fica neste dashboard; a tela onde as ações
 * acontecem (criar evento, check-in etc.) é o outro app.
 */

export type ActionKey =
  | "view"
  | "add"
  | "edit"
  | "delete"
  | "import"
  | "export"
  | "upload"
  | "download"
  | "checkin"
  | "edit_metrics"
  | "manage_goals"
  | "edit_observations"
  | "add_content"
  | "edit_content"
  | "delete_content"
  | "register";

export interface ModuleAction {
  key: ActionKey;
  label: string;
}

export interface PermissionModule {
  key: string;
  label: string;
  implemented: boolean;
  actions: ModuleAction[];
}

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    key: "traffic",
    label: "Tráfego pago",
    implemented: true,
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "edit_metrics", label: "Editar métricas" },
      { key: "manage_goals", label: "Gerenciar metas" },
      { key: "edit_observations", label: "Editar observações" },
    ],
  },
  {
    key: "social",
    label: "Redes sociais",
    implemented: true,
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "edit_metrics", label: "Editar métricas" },
      { key: "add_content", label: "Adicionar conteúdo" },
      { key: "edit_content", label: "Editar conteúdo" },
      { key: "delete_content", label: "Excluir conteúdos" },
    ],
  },
  {
    key: "calendar",
    label: "Calendário",
    implemented: true,
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "add", label: "Adicionar" },
      { key: "edit", label: "Editar" },
      { key: "delete", label: "Excluir" },
    ],
  },
  {
    key: "spreadsheets",
    label: "Documentos",
    implemented: true,
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "upload", label: "Adicionar/upload" },
      { key: "delete", label: "Excluir" },
    ],
  },
  {
    // A aba "Leads qualificados" foi removida da navegação (todas as
    // empresas), mas a tabela/RLS continuam existindo — mantemos o módulo
    // aqui para não deixar permissões já concedidas órfãs.
    key: "leads",
    label: "Leads qualificados",
    implemented: true,
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "upload", label: "Adicionar/upload" },
      { key: "download", label: "Baixar" },
      { key: "delete", label: "Excluir" },
    ],
  },
  {
    key: "leads_control",
    label: "Controle de Leads",
    implemented: true,
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "add", label: "Adicionar" },
      { key: "edit", label: "Editar" },
      { key: "delete", label: "Excluir" },
      { key: "import", label: "Importar" },
      { key: "export", label: "Exportar" },
    ],
  },
  {
    key: "follow_up",
    label: "Follow-up",
    implemented: true,
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "register", label: "Registrar follow-up" },
      { key: "edit", label: "Editar registro" },
      { key: "delete", label: "Excluir registro" },
    ],
  },
  {
    key: "events_overview",
    label: "Eventos — Visão geral",
    implemented: true,
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "edit", label: "Editar" },
    ],
  },
  {
    key: "events_participants",
    label: "Eventos — Participantes",
    implemented: true,
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "add", label: "Adicionar" },
      { key: "edit", label: "Editar" },
      { key: "delete", label: "Excluir" },
      { key: "import", label: "Importar" },
      { key: "export", label: "Exportar" },
      { key: "checkin", label: "Check-in" },
    ],
  },
  {
    key: "events_finance",
    label: "Eventos — Financeiro",
    implemented: true,
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "add", label: "Adicionar" },
      { key: "edit", label: "Editar" },
      { key: "delete", label: "Excluir" },
      { key: "import", label: "Importar" },
      { key: "export", label: "Exportar" },
    ],
  },
  {
    key: "events_form",
    label: "Eventos — Formulário",
    implemented: true,
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "edit", label: "Editar" },
    ],
  },
  {
    key: "events_partners",
    label: "Eventos — Parceiros/Links",
    implemented: true,
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "add", label: "Adicionar" },
      { key: "edit", label: "Editar" },
      { key: "delete", label: "Excluir" },
      { key: "export", label: "Exportar" },
    ],
  },
];

export function getModule(key: string): PermissionModule | undefined {
  return PERMISSION_MODULES.find((m) => m.key === key);
}

export const USER_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  active: "Ativo",
  suspended: "Suspenso",
  rejected: "Recusado",
};

export interface PermissionProfileOption {
  name: string;
  description: string;
}

/** Nível simples exibido por padrão na UI (visão "básica" do item 7). */
export type SimpleLevel = "none" | "view" | "edit";

/**
 * Deriva o nível simples (Sem acesso / Somente visualizar / Editar) a
 * partir do conjunto de ações permitidas de um módulo. "Editar" é
 * considerado presente se QUALQUER ação além de "view" estiver ligada.
 */
export function deriveSimpleLevel(mod: PermissionModule, allowedActions: Set<ActionKey>): SimpleLevel {
  const hasView = allowedActions.has("view");
  const hasAnyEdit = mod.actions.some((a) => a.key !== "view" && allowedActions.has(a.key));
  if (hasAnyEdit) return "edit";
  if (hasView) return "view";
  return "none";
}

/** Aplica o nível simples, retornando o novo conjunto de ações permitidas. */
export function applySimpleLevel(mod: PermissionModule, level: SimpleLevel): Set<ActionKey> {
  const result = new Set<ActionKey>();
  if (level === "none") return result;
  result.add("view");
  if (level === "edit") {
    for (const a of mod.actions) result.add(a.key);
  }
  return result;
}
