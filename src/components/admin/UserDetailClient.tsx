"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Profile, UserStatus } from "@/types/database";
import { PERMISSION_MODULES } from "@/lib/permissions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { PermissionMatrix } from "@/components/admin/PermissionMatrix";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD_SURFACE, INPUT_BASE, LABEL_BASE, cx } from "@/lib/utils";

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
interface RoleRow {
  profile_id: string;
  module_key: string;
  action: string;
  allowed: boolean;
}
interface OverrideRow {
  company_id: string;
  module_key: string;
  action: string;
  allowed: boolean;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function buildBaseMap(roleRows: RoleRow[], profileId: string | undefined): Map<string, boolean> {
  const map = new Map<string, boolean>();
  if (!profileId) return map;
  for (const r of roleRows) {
    if (r.profile_id === profileId) map.set(`${r.module_key}:${r.action}`, r.allowed);
  }
  return map;
}

export function UserDetailClient({
  profile,
  permissionProfiles,
  companies,
  userCompanyIds,
  roleRows,
  overrideRows,
}: {
  profile: Profile;
  permissionProfiles: PermissionProfileRow[];
  companies: CompanyRow[];
  userCompanyIds: string[];
  roleRows: RoleRow[];
  overrideRows: OverrideRow[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const isOwner = profile.system_role === "owner";

  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set(userCompanyIds));
  const [profileName, setProfileName] = useState(
    permissionProfiles.find((p) => p.id === profile.permission_profile_id)?.name ?? permissionProfiles[0]?.name ?? ""
  );
  const currentProfileId = permissionProfiles.find((item) => item.name === profileName)?.id;
  const baseMap = useMemo(() => buildBaseMap(roleRows, currentProfileId), [roleRows, currentProfileId]);

  const [matrixByCompany, setMatrixByCompany] = useState<Map<string, Map<string, boolean>>>(() => {
    const result = new Map<string, Map<string, boolean>>();
    for (const companyId of userCompanyIds) {
      const map = new Map<string, boolean>();
      for (const mod of PERMISSION_MODULES) {
        for (const a of mod.actions) {
          const key = `${mod.key}:${a.key}`;
          const override = overrideRows.find(
            (o) => o.company_id === companyId && o.module_key === mod.key && o.action === a.key
          );
          map.set(key, override ? override.allowed : (baseMap.get(key) ?? false));
        }
      }
      result.set(companyId, map);
    }
    return result;
  });

  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set(userCompanyIds.slice(0, 1)));
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "suspend" | "reject">(null);

  function toggleCompany(id: string) {
    setSelectedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setExpandedCompanies((expanded) => {
          const updated = new Set(expanded);
          updated.delete(id);
          return updated;
        });
      } else {
        next.add(id);
        if (!matrixByCompany.has(id)) {
          const map = new Map<string, boolean>();
          const profileId = permissionProfiles.find((p) => p.name === profileName)?.id;
          const newBase = buildBaseMap(roleRows, profileId);
          for (const mod of PERMISSION_MODULES) {
            for (const a of mod.actions) {
              const key = `${mod.key}:${a.key}`;
              map.set(key, newBase.get(key) ?? false);
            }
          }
          setMatrixByCompany((prevMatrix) => new Map(prevMatrix).set(id, map));
        }
        setExpandedCompanies((expanded) => new Set(expanded).add(id));
      }
      return next;
    });
  }

  function changeProfile(nextProfileName: string) {
    setProfileName(nextProfileName);
    const profileId = permissionProfiles.find((item) => item.name === nextProfileName)?.id;
    const preset = buildBaseMap(roleRows, profileId);
    setMatrixByCompany((previous) => {
      const next = new Map(previous);
      for (const companyId of selectedCompanies) next.set(companyId, new Map(preset));
      return next;
    });
  }

  function toggleExpanded(companyId: string) {
    setExpandedCompanies((previous) => {
      const next = new Set(previous);
      if (next.has(companyId)) next.delete(companyId); else next.add(companyId);
      return next;
    });
  }

  async function handleDecision(decision: "approve" | "reject" | "suspend" | "reactivate") {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${profile.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível concluir a ação.");
      showToast("Feito.", "success");
      setConfirmAction(null);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível concluir a ação.", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const overrides: { companyId: string; moduleKey: string; action: string; allowed: boolean }[] = [];
      for (const companyId of selectedCompanies) {
        const map = matrixByCompany.get(companyId);
        if (!map) continue;
        for (const [key, allowed] of map.entries()) {
          const [moduleKey, action] = key.split(":");
          const baseValue = baseMap.get(key) ?? false;
          if (allowed !== baseValue) {
            overrides.push({ companyId, moduleKey, action, allowed });
          }
        }
      }

      const res = await fetch(`/api/admin/users/${profile.id}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permissionProfileName: profileName,
          companyIds: Array.from(selectedCompanies),
          overrides,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar.");
      showToast("Salvo.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  const activeCompanies = companies.filter((c) => selectedCompanies.has(c.id));

  return (
    <main className="mx-auto max-w-4xl px-4 py-7 sm:px-6 lg:px-8">
      <div className={cx(CARD_SURFACE, "mb-6 p-5")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">{profile.full_name ?? "—"}</h1>
              <StatusBadge status={profile.status} />
              {isOwner && (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                  OWNER
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">{profile.email}</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
              Último acesso: {formatDateTime(profile.last_login_at)}
            </p>
          </div>

          {!isOwner && (
            <div className="flex flex-wrap gap-2">
              {profile.status === "pending" && (
                <>
                  <button onClick={() => handleDecision("approve")} disabled={actionLoading} className={BUTTON_PRIMARY}>
                    Aprovar
                  </button>
                  <button onClick={() => setConfirmAction("reject")} disabled={actionLoading} className={BUTTON_SECONDARY}>
                    Recusar
                  </button>
                </>
              )}
              {profile.status === "active" && (
                <button onClick={() => setConfirmAction("suspend")} disabled={actionLoading} className={BUTTON_SECONDARY}>
                  Suspender
                </button>
              )}
              {profile.status === "suspended" && (
                <button onClick={() => handleDecision("reactivate")} disabled={actionLoading} className={BUTTON_PRIMARY}>
                  Reativar
                </button>
              )}
              {profile.status === "rejected" && (
                <button onClick={() => handleDecision("approve")} disabled={actionLoading} className={BUTTON_PRIMARY}>
                  Reconsiderar e aprovar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {isOwner ? (
        <div className={cx(CARD_SURFACE, "p-5 text-sm text-slate-500 dark:text-zinc-400")}>
          Esta é a conta Owner — acesso irrestrito e protegido. Empresas e permissões não se aplicam aqui.
        </div>
      ) : (
        <>
          <div className={cx(CARD_SURFACE, "mb-6 p-5")}>
            <label className={LABEL_BASE}>Perfil de permissão</label>
            <select value={profileName} onChange={(e) => changeProfile(e.target.value)} className={cx(INPUT_BASE, "mb-4 max-w-xs")}>
              {permissionProfiles.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>

            <label className={LABEL_BASE}>Empresas permitidas</label>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 dark:border-zinc-800 sm:grid-cols-3">
              {companies.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={selectedCompanies.has(c.id)}
                    onChange={() => toggleCompany(c.id)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-700"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>

          {activeCompanies.length > 0 && (
            <div className={cx(CARD_SURFACE, "mb-6 p-5")}>
              <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-zinc-200">Matriz de permissões</h2>
              <div className="space-y-2">
                {activeCompanies.map((company) => {
                  const expanded = expandedCompanies.has(company.id);
                  const matrix = matrixByCompany.get(company.id);
                  return (
                    <div key={company.id} className="rounded-xl border border-slate-200 dark:border-zinc-800">
                      <button type="button" onClick={() => toggleExpanded(company.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-zinc-200">Permissões — {company.name}</span>
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      {expanded && matrix && (
                        <div className="border-t border-slate-100 px-4 dark:border-zinc-800">
                          <PermissionMatrix value={matrix} onChange={(next) => setMatrixByCompany((previous) => new Map(previous).set(company.id, next))} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving} className={BUTTON_PRIMARY}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmAction === "suspend"}
        title="Suspender usuário"
        message="O acesso será cortado imediatamente, em toda a plataforma. Deseja continuar?"
        confirmLabel="Suspender"
        loading={actionLoading}
        onConfirm={() => handleDecision("suspend")}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === "reject"}
        title="Recusar solicitação"
        message="O usuário não terá acesso à plataforma. Você pode reconsiderar depois, se necessário."
        confirmLabel="Recusar"
        loading={actionLoading}
        onConfirm={() => handleDecision("reject")}
        onCancel={() => setConfirmAction(null)}
      />
    </main>
  );
}
