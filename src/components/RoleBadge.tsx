import { StatusBadge, type StatusBadgeVariant } from "@/components/StatusBadge";

function roleVariant(role: string): StatusBadgeVariant {
  const normalized = role.toLocaleLowerCase("pt-BR");
  if (normalized.includes("owner") || normalized.includes("administrador") || normalized.includes("acesso total")) {
    return "primary";
  }
  if (normalized.includes("marketing") || normalized.includes("comercial")) return "info";
  if (normalized.includes("leitura")) return "inactive";
  return "neutral";
}

export function RoleBadge({ role, compact = false }: { role: string; compact?: boolean }) {
  return (
    <StatusBadge variant={roleVariant(role)} className={compact ? "px-1.5 text-[10px] font-semibold" : undefined}>
      {role}
    </StatusBadge>
  );
}

