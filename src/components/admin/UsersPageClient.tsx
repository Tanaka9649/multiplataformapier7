"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import type { UserStatus } from "@/types/database";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { CreateAccessModal } from "@/components/admin/CreateAccessModal";
import { EmptyState } from "@/components/EmptyState";
import { BUTTON_PRIMARY, CARD_SURFACE, INPUT_BASE, SELECTED_PILL, UNSELECTED_PILL, cx } from "@/lib/utils";

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  status: UserStatus;
  system_role: "owner" | "member";
  permission_profile_id: string | null;
  last_login_at: string | null;
}
interface PermissionProfileRow {
  id: string;
  name: string;
  description: string | null;
}
interface CompanyRow {
  id: string;
  name: string;
  slug: string;
}
interface UserCompanyRow {
  user_id: string;
  company_id: string;
}
interface RoleRow {
  profile_id: string;
  module_key: string;
  action: string;
  allowed: boolean;
}

const FILTERS: { key: "all" | UserStatus; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendentes" },
  { key: "active", label: "Ativos" },
  { key: "suspended", label: "Suspensos" },
  { key: "rejected", label: "Recusados" },
];

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function UsersPageClient({
  profiles,
  permissionProfiles,
  companies,
  userCompanies,
  roleRows,
}: {
  profiles: ProfileRow[];
  permissionProfiles: PermissionProfileRow[];
  companies: CompanyRow[];
  userCompanies: UserCompanyRow[];
  roleRows: RoleRow[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | UserStatus>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const profileNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of permissionProfiles) map.set(p.id, p.name);
    return map;
  }, [permissionProfiles]);

  const companyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of companies) map.set(c.id, c.name);
    return map;
  }, [companies]);

  const companiesByUser = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const uc of userCompanies) {
      const name = companyNameById.get(uc.company_id);
      if (!name) continue;
      const list = map.get(uc.user_id) ?? [];
      list.push(name);
      map.set(uc.user_id, list);
    }
    return map;
  }, [userCompanies, companyNameById]);

  const pendingCount = profiles.filter((p) => p.status === "pending").length;

  const filtered = profiles.filter((p) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchesName = (p.full_name ?? "").toLowerCase().includes(q);
      const matchesEmail = (p.email ?? "").toLowerCase().includes(q);
      if (!matchesName && !matchesEmail) return false;
    }
    return true;
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">Usuários</h1>
        <button onClick={() => setCreateOpen(true)} className={BUTTON_PRIMARY}>
          <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
          Criar acesso
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cx(
                "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                filter === f.key
                  ? SELECTED_PILL
                  : UNSELECTED_PILL
              )}
            >
              {f.label}
              {f.key === "pending" && pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className={cx(INPUT_BASE, "w-56 pl-8")}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="Nenhum usuário encontrado." />
      ) : (
        <div className={cx(CARD_SURFACE, "overflow-hidden p-0")}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Empresas</th>
                <th className="px-4 py-3">Último acesso</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/admin/users/${p.id}`)}
                  className="cursor-pointer border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50 dark:border-zinc-900 dark:hover:bg-zinc-900/60"
                >
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-zinc-200">
                    {p.full_name ?? "—"}
                    {p.system_role === "owner" && (
                      <span className="ml-1.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                        OWNER
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-zinc-400">{p.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-zinc-400">
                    {p.system_role === "owner"
                      ? "Acesso total"
                      : p.permission_profile_id
                        ? (profileNameById.get(p.permission_profile_id) ?? "—")
                        : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-zinc-400">
                    {p.system_role === "owner" ? "Todas" : (companiesByUser.get(p.id) ?? []).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 dark:text-zinc-500">{formatDate(p.last_login_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateAccessModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        permissionProfiles={permissionProfiles}
        companies={companies}
        roleRows={roleRows}
        onCreated={() => router.refresh()}
      />
    </main>
  );
}
