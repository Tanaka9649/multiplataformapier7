"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Upload } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import type { LeadOrigin, LeadStatus } from "@/types/database";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  INPUT_BASE,
  LABEL_BASE,
  LEAD_ORIGIN_LABELS,
  LEAD_STATUS_LABELS,
  cx,
} from "@/lib/utils";

interface LeadImportModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  onImported: () => void;
}

type TargetKey =
  | "entry_date"
  | "name"
  | "phone"
  | "service_interest"
  | "origin"
  | "responsible"
  | "qualification"
  | "status"
  | "notes";

const TARGET_FIELDS: { key: TargetKey; label: string; required?: boolean }[] = [
  { key: "entry_date", label: "Data de entrada" },
  { key: "name", label: "Nome", required: true },
  { key: "phone", label: "Telefone" },
  { key: "service_interest", label: "Serviço de interesse" },
  { key: "origin", label: "Origem" },
  { key: "responsible", label: "Responsável" },
  { key: "qualification", label: "Qualificação" },
  { key: "status", label: "Situação" },
  { key: "notes", label: "Observações" },
];

const SYNONYMS: Record<TargetKey, string[]> = {
  entry_date: ["data", "dataentrada", "dataregistro", "datacriacao", "dataentradalead"],
  name: ["nome", "cliente", "lead", "nomedolead"],
  phone: ["telefone", "celular", "fone", "whatsapp", "numero", "contato"],
  service_interest: ["servico", "servicointeresse", "interesse", "produto", "servicodeinteresse"],
  origin: ["origem", "canal", "fonte"],
  responsible: ["responsavel", "vendedor", "atendente"],
  qualification: ["qualificacao", "nota", "estrelas", "avaliacao"],
  status: ["situacao", "status", "etapa"],
  notes: ["observacoes", "obs", "observacao", "notas", "comentarios"],
};

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function guessMapping(headers: string[]): Record<TargetKey, string> {
  const used = new Set<string>();
  const mapping = {} as Record<TargetKey, string>;
  for (const field of TARGET_FIELDS) {
    const match = headers.find((h) => {
      if (used.has(h)) return false;
      const n = normalize(h);
      return SYNONYMS[field.key].some((syn) => n === syn || n.includes(syn));
    });
    mapping[field.key] = match ?? "";
    if (match) used.add(match);
  }
  return mapping;
}

function parseEntryDate(raw: unknown, xlsxModule?: typeof import("xlsx")): string {
  if (raw == null || raw === "") return todayISO();
  if (typeof raw === "number") {
    const parsed = xlsxModule?.SSF?.parse_date_code?.(raw);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    return todayISO();
  }
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const [, d, mo, yRaw] = m;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return todayISO();
}

function normalizeOrigin(raw: unknown): { value: LeadOrigin; matched: boolean } {
  const n = normalize(String(raw ?? ""));
  if (!n) return { value: "instagram", matched: false };
  if (n.includes("insta")) return { value: "instagram", matched: true };
  if (n.includes("evento") || n.includes("feira")) return { value: "evento", matched: true };
  if (n.includes("prospec")) return { value: "prospeccao", matched: true };
  if (n.includes("trafego") || n.includes("ads") || n.includes("meta") || n.includes("google"))
    return { value: "trafego_pago", matched: true };
  return { value: "instagram", matched: false };
}

function normalizeStatus(raw: unknown): { value: LeadStatus; matched: boolean } {
  const n = normalize(String(raw ?? ""));
  if (!n) return { value: "conversando", matched: false };
  if (n.includes("abandon") || n.includes("perdid") || n.includes("desist"))
    return { value: "abandonou", matched: true };
  if (n.includes("reuniao") || n.includes("agendad") || n.includes("marcad"))
    return { value: "reuniao_marcada", matched: true };
  if (n.includes("fechad") || n.includes("ganho") || n.includes("contrato") || n.includes("venda"))
    return { value: "contrato_fechado", matched: true };
  if (n.includes("convers") || n.includes("andament"))
    return { value: "conversando", matched: true };
  return { value: "conversando", matched: false };
}

function parseQualification(raw: unknown): { value: number; matched: boolean } {
  if (raw == null || raw === "") return { value: 3, matched: false };
  const s = String(raw);
  const starCount = (s.match(/★|⭐/g) || []).length;
  if (starCount >= 1 && starCount <= 5) return { value: starCount, matched: true };
  const num = parseInt(s.replace(/[^\d]/g, ""), 10);
  if (num >= 1 && num <= 5) return { value: num, matched: true };
  return { value: 3, matched: false };
}

interface ParsedRow {
  rowIndex: number;
  valid: boolean;
  issues: string[];
  data: {
    entry_date: string;
    name: string;
    phone: string;
    service_interest: string;
    origin: LeadOrigin;
    responsible: string;
    qualification: number;
    status: LeadStatus;
    notes: string;
  };
}

export function LeadImportModal({ open, onClose, companyId, onImported }: LeadImportModalProps) {
  const supabase = createClient();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"select" | "mapping" | "review">("select");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<TargetKey, string>>(() => guessMapping([]));
  const [importing, setImporting] = useState(false);
  const xlsxRef = useRef<typeof import("xlsx") | null>(null);

  function reset() {
    setStep("select");
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setMapping(guessMapping([]));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    if (importing) return;
    reset();
    onClose();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      xlsxRef.current = XLSX;
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (json.length === 0) {
        showToast("A planilha está vazia.", "error");
        return;
      }
      const detectedHeaders = Object.keys(json[0]);
      setHeaders(detectedHeaders);
      setRawRows(json);
      setMapping(guessMapping(detectedHeaders));
      setFileName(file.name);
      setStep("mapping");
    } catch (err) {
      showToast("Não foi possível ler o arquivo. Verifique o formato.", "error");
    }
  }

  const parsedRows = useMemo<ParsedRow[]>(() => {
    if (step !== "review") return [];
    return rawRows.map((row, i) => {
      const issues: string[] = [];
      const nameCol = mapping.name;
      const name = nameCol ? String(row[nameCol] ?? "").trim() : "";
      if (!name) issues.push("Nome vazio");

      const originResult = mapping.origin ? normalizeOrigin(row[mapping.origin]) : { value: "instagram" as LeadOrigin, matched: true };
      if (mapping.origin && !originResult.matched) issues.push("Origem não reconhecida (definida como Instagram)");

      const statusResult = mapping.status ? normalizeStatus(row[mapping.status]) : { value: "conversando" as LeadStatus, matched: true };
      if (mapping.status && !statusResult.matched) issues.push("Situação não reconhecida (definida como Conversando)");

      const qualResult = mapping.qualification ? parseQualification(row[mapping.qualification]) : { value: 3, matched: true };

      return {
        rowIndex: i,
        valid: name.length > 0,
        issues,
        data: {
          entry_date: mapping.entry_date ? parseEntryDate(row[mapping.entry_date], xlsxRef.current ?? undefined) : todayISO(),
          name,
          phone: mapping.phone ? String(row[mapping.phone] ?? "").trim() : "",
          service_interest: mapping.service_interest ? String(row[mapping.service_interest] ?? "").trim() : "",
          origin: originResult.value,
          responsible: mapping.responsible ? String(row[mapping.responsible] ?? "").trim() : "",
          qualification: qualResult.value,
          status: statusResult.value,
          notes: mapping.notes ? String(row[mapping.notes] ?? "").trim() : "",
        },
      };
    });
  }, [step, rawRows, mapping]);

  const validRows = parsedRows.filter((r) => r.valid);
  const invalidRows = parsedRows.filter((r) => !r.valid);

  async function handleImport() {
    if (validRows.length === 0) {
      showToast("Nenhum registro válido para importar.", "error");
      return;
    }
    setImporting(true);
    try {
      const payload = validRows.map((r) => ({ company_id: companyId, ...r.data }));
      const chunkSize = 500;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error } = await supabase.from("leads").insert(chunk);
        if (error) throw error;
      }
      showToast(`${validRows.length} leads importados.`, "success");
      onImported();
      handleClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível concluir a importação.", "error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Importar leads" size="lg">
      {step === "select" && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-zinc-700">
          <FileUp className="h-8 w-8 text-slate-400 dark:text-zinc-500" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              Selecione uma planilha para importar
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Formatos aceitos: .xlsx, .xls, .csv</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="block text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 dark:text-zinc-400 dark:file:bg-brand-950/60 dark:file:text-brand-300 dark:hover:file:bg-brand-900/60"
          />
        </div>
      )}

      {step === "mapping" && (
        <div>
          <p className="mb-4 text-sm text-slate-500 dark:text-zinc-400">
            Arquivo: <span className="font-medium text-slate-700 dark:text-zinc-300">{fileName}</span> ·{" "}
            {rawRows.length} linhas encontradas
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TARGET_FIELDS.map((field) => (
              <div key={field.key}>
                <label className={LABEL_BASE}>
                  {field.label}
                  {field.required && <span className="text-red-500"> *</span>}
                </label>
                <select
                  value={mapping[field.key]}
                  onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                  className={INPUT_BASE}
                >
                  <option value="">Não importar</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={handleClose} className={BUTTON_SECONDARY}>
              Cancelar
            </button>
            <button
              onClick={() => setStep("review")}
              disabled={!mapping.name}
              className={BUTTON_PRIMARY}
            >
              Avançar
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
            <span className="text-slate-600 dark:text-zinc-400">{parsedRows.length} registros encontrados</span>
            <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> {validRows.length} válidos
            </span>
            {invalidRows.length > 0 && (
              <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" /> {invalidRows.length} com problemas
              </span>
            )}
          </div>

          {invalidRows.length > 0 && (
            <div className="mb-4 max-h-32 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
              {invalidRows.slice(0, 20).map((r) => (
                <p key={r.rowIndex}>
                  Linha {r.rowIndex + 2}: {r.issues.join(", ")}
                </p>
              ))}
              {invalidRows.length > 20 && <p>+ {invalidRows.length - 20} outras linhas</p>}
            </div>
          )}

          <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-zinc-900/60 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Telefone</th>
                  <th className="px-3 py-2">Origem</th>
                  <th className="px-3 py-2">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {validRows.slice(0, 8).map((r) => (
                  <tr key={r.rowIndex}>
                    <td className="px-3 py-2 text-slate-700 dark:text-zinc-300">{r.data.name}</td>
                    <td className="px-3 py-2 text-slate-500 dark:text-zinc-400">{r.data.phone}</td>
                    <td className="px-3 py-2 text-slate-500 dark:text-zinc-400">{LEAD_ORIGIN_LABELS[r.data.origin]}</td>
                    <td className="px-3 py-2 text-slate-500 dark:text-zinc-400">{LEAD_STATUS_LABELS[r.data.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {validRows.length > 8 && (
              <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
                + {validRows.length - 8} outros registros válidos
              </p>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setStep("mapping")} disabled={importing} className={BUTTON_SECONDARY}>
              Voltar
            </button>
            <button onClick={handleImport} disabled={importing || validRows.length === 0} className={BUTTON_PRIMARY}>
              <Upload className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
              {importing ? "Importando..." : `Importar ${validRows.length} leads`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
