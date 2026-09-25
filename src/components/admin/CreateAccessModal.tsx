"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import { Modal } from "@/components/Modal";
import { PermissionMatrix } from "@/components/admin/PermissionMatrix";
import { useToast } from "@/components/Toast";
import { PERMISSION_MODULES } from "@/lib/permissions";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_BASE, LABEL_BASE, cx } from "@/lib/utils";

interface PermissionProfileRow { id: string; name: string; description: string | null }
interface CompanyRow { id: string; name: string; slug: string }
interface RoleRow { profile_id: string; module_key: string; action: string; allowed: boolean }

interface CreateAccessModalProps {
  open: boolean;
  onClose: () => void;
  permissionProfiles: PermissionProfileRow[];
  companies: CompanyRow[];
  roleRows: RoleRow[];
  onCreated: () => void;
}

function buildPreset(roleRows: RoleRow[], profileId: string | undefined): Map<string, boolean> {
  const result = new Map<string, boolean>();
  for (const permissionModule of PERMISSION_MODULES) {
    for (const action of permissionModule.actions) result.set(`${permissionModule.key}:${action.key}`, false);
  }
  if (!profileId) return result;
  for (const row of roleRows) {
    if (row.profile_id === profileId) result.set(`${row.module_key}:${row.action}`, row.allowed);
  }
  return result;
}

export function CreateAccessModal({ open, onClose, permissionProfiles, companies, roleRows, onCreated }: CreateAccessModalProps) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [profileName, setProfileName] = useState(permissionProfiles[0]?.name ?? "");
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [matrixByCompany, setMatrixByCompany] = useState<Map<string, Map<string, boolean>>>(new Map());
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function presetFor(profile: string) {
    return buildPreset(roleRows, permissionProfiles.find((item) => item.name === profile)?.id);
  }

  function toggleCompany(id: string) {
    setSelectedCompanies((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
        setExpandedCompanies((expanded) => {
          const updated = new Set(expanded);
          updated.delete(id);
          return updated;
        });
      } else {
        next.add(id);
        setMatrixByCompany((matrices) => new Map(matrices).set(id, presetFor(profileName)));
        setExpandedCompanies((expanded) => new Set(expanded).add(id));
      }
      return next;
    });
  }

  function changeProfile(nextProfile: string) {
    setProfileName(nextProfile);
    const preset = presetFor(nextProfile);
    setMatrixByCompany((previous) => {
      const next = new Map(previous);
      for (const companyId of selectedCompanies) next.set(companyId, new Map(preset));
      return next;
    });
  }

  function toggleExpanded(id: string) {
    setExpandedCompanies((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function reset() {
    setName("");
    setEmail("");
    setPassword("");
    setPasswordConfirmation("");
    setShowPassword(false);
    setProfileName(permissionProfiles[0]?.name ?? "");
    setSelectedCompanies(new Set());
    setMatrixByCompany(new Map());
    setExpandedCompanies(new Set());
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !profileName || !password) {
      showToast("Preencha nome, e-mail, senha e perfil de permissão.", "error");
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/.test(password)) {
      showToast("Use ao menos 10 caracteres, com maiúscula, minúscula e número.", "error");
      return;
    }
    if (password !== passwordConfirmation) {
      showToast("As senhas não coincidem.", "error");
      return;
    }
    if (selectedCompanies.size === 0) {
      showToast("Selecione pelo menos uma empresa.", "error");
      return;
    }

    const base = presetFor(profileName);
    const overrides: { companyId: string; moduleKey: string; action: string; allowed: boolean }[] = [];
    for (const companyId of selectedCompanies) {
      const matrix = matrixByCompany.get(companyId);
      if (!matrix) continue;
      for (const [key, allowed] of matrix) {
        if (allowed === (base.get(key) ?? false)) continue;
        const [moduleKey, action] = key.split(":");
        overrides.push({ companyId, moduleKey, action, allowed });
      }
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), email: email.trim(), password,
          permissionProfileName: profileName,
          companyIds: Array.from(selectedCompanies), overrides,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível criar o acesso.");
      showToast("Usuário criado e pronto para entrar.", "success");
      reset();
      onCreated();
      onClose();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível criar o acesso.", "error");
    } finally {
      setSaving(false);
    }
  }

  const activeCompanies = companies.filter((company) => selectedCompanies.has(company.id));

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title="Criar acesso" size="lg" footer={<>
      <button onClick={onClose} disabled={saving} className={BUTTON_SECONDARY}>Cancelar</button>
      <button onClick={handleSubmit} disabled={saving} className={BUTTON_PRIMARY}>{saving ? "Criando..." : "Criar acesso"}</button>
    </>}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          O usuário nasce com o e-mail confirmado. Informe a senha a ele por um canal seguro; ela não será armazenada pela plataforma.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className={LABEL_BASE}>Nome</label><input type="text" required value={name} onChange={(event) => setName(event.target.value)} className={INPUT_BASE} /></div>
          <div><label className={LABEL_BASE}>E-mail</label><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={INPUT_BASE} placeholder="pessoa@empresa.com" /></div>
          <div>
            <label className={LABEL_BASE}>Senha</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={cx(INPUT_BASE, "pr-10")} />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">Mínimo de 10 caracteres, com maiúscula, minúscula e número.</p>
          </div>
          <div><label className={LABEL_BASE}>Confirmar senha</label><input type={showPassword ? "text" : "password"} required autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} className={INPUT_BASE} /></div>
        </div>

        <div>
          <label className={LABEL_BASE}>Perfil de permissão</label>
          <select value={profileName} onChange={(event) => changeProfile(event.target.value)} className={INPUT_BASE}>
            {permissionProfiles.map((profile) => <option key={profile.id} value={profile.name}>{profile.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">O perfil preenche os padrões; as alterações abaixo valem somente para este usuário e empresa.</p>
        </div>

        <div>
          <label className={LABEL_BASE}>Empresas</label>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 dark:border-zinc-800 sm:grid-cols-3">
            {companies.map((company) => <label key={company.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
              <input type="checkbox" checked={selectedCompanies.has(company.id)} onChange={() => toggleCompany(company.id)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-700" />
              {company.name}
            </label>)}
          </div>
        </div>

        {activeCompanies.length > 0 && <div className="space-y-2">
          {activeCompanies.map((company) => {
            const expanded = expandedCompanies.has(company.id);
            const matrix = matrixByCompany.get(company.id);
            return <div key={company.id} className="rounded-xl border border-slate-200 dark:border-zinc-800">
              <button type="button" onClick={() => toggleExpanded(company.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-zinc-200">Permissões — {company.name}</span>
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {expanded && matrix && <div className="border-t border-slate-100 px-4 dark:border-zinc-800">
                <PermissionMatrix value={matrix} onChange={(next) => setMatrixByCompany((previous) => new Map(previous).set(company.id, next))} />
              </div>}
            </div>;
          })}
        </div>}
      </form>
    </Modal>
  );
}
