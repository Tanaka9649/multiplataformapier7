"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_BASE, LABEL_BASE, cx } from "@/lib/utils";

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

interface CreateAccessModalProps {
  open: boolean;
  onClose: () => void;
  permissionProfiles: PermissionProfileRow[];
  companies: CompanyRow[];
  onCreated: () => void;
}

export function CreateAccessModal({ open, onClose, permissionProfiles, companies, onCreated }: CreateAccessModalProps) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileName, setProfileName] = useState(permissionProfiles[0]?.name ?? "");
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function toggleCompany(id: string) {
    setSelectedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setName("");
    setEmail("");
    setProfileName(permissionProfiles[0]?.name ?? "");
    setSelectedCompanies(new Set());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !profileName) {
      showToast("Preencha nome, e-mail e perfil de permissão.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          permissionProfileName: profileName,
          companyIds: Array.from(selectedCompanies),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível criar o acesso.");
      showToast("Convite enviado. O acesso já está ativo.", "success");
      reset();
      onCreated();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível criar o acesso.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="Criar acesso"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className={BUTTON_SECONDARY}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving} className={BUTTON_PRIMARY}>
            {saving ? "Enviando..." : "Criar acesso"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-400 dark:text-zinc-500">
          A pessoa recebe um e-mail de convite e define a própria senha. Você nunca precisa criar ou saber a senha dela.
        </p>

        <div>
          <label className={LABEL_BASE}>Nome</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={INPUT_BASE} />
        </div>
        <div>
          <label className={LABEL_BASE}>E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT_BASE}
            placeholder="pessoa@empresa.com"
          />
        </div>
        <div>
          <label className={LABEL_BASE}>Perfil de permissão</label>
          <select value={profileName} onChange={(e) => setProfileName(e.target.value)} className={INPUT_BASE}>
            {permissionProfiles.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_BASE}>Empresas</label>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 dark:border-zinc-800">
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
          <p className="mt-1.5 text-xs text-slate-400 dark:text-zinc-500">
            As permissões detalhadas por módulo podem ser ajustadas depois, na página do usuário.
          </p>
        </div>
      </form>
    </Modal>
  );
}
