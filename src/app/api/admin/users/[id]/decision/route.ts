import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/supabase/requireOwner";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/lib/adminAudit";

type Decision = "approve" | "reject" | "suspend" | "reactivate";

const VALID_DECISIONS: Decision[] = ["approve", "reject", "suspend", "reactivate"];

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const targetUserId = params.id;

  let body: { decision?: Decision };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (!body.decision || !VALID_DECISIONS.includes(body.decision)) {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro de configuração." }, { status: 500 });
  }

  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id, status, system_role, email")
    .eq("id", targetUserId)
    .maybeSingle();

  if (targetError || !target) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  // Proteção do Owner: nunca pode ser suspenso, recusado ou ter o
  // acesso alterado por esta rota — nem por si mesmo, nem por engano.
  if (target.system_role === "owner") {
    return NextResponse.json({ error: "O Owner não pode ser alterado por aqui." }, { status: 400 });
  }

  const previousStatus = target.status;
  let nextStatus = previousStatus;
  const updatePayload: Record<string, unknown> = {};

  switch (body.decision) {
    case "approve":
      nextStatus = "active";
      updatePayload.status = "active";
      updatePayload.approved_at = new Date().toISOString();
      updatePayload.approved_by = auth.ownerId;
      updatePayload.suspended_at = null;
      break;
    case "reject":
      nextStatus = "rejected";
      updatePayload.status = "rejected";
      break;
    case "suspend":
      nextStatus = "suspended";
      updatePayload.status = "suspended";
      updatePayload.suspended_at = new Date().toISOString();
      break;
    case "reactivate":
      nextStatus = "active";
      updatePayload.status = "active";
      updatePayload.suspended_at = null;
      updatePayload.approved_at = new Date().toISOString();
      updatePayload.approved_by = auth.ownerId;
      break;
  }

  const { error: updateError } = await admin.from("profiles").update(updatePayload).eq("id", targetUserId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Bloqueia/libera emissão de novos tokens imediatamente. O acesso a
  // dados já é cortado no mesmo instante pelo RLS (has_company_access
  // exige status = 'active'), independente de o token antigo ainda ser
  // tecnicamente válido por mais alguns minutos.
  if (body.decision === "suspend") {
    await admin.auth.admin.updateUserById(targetUserId, { ban_duration: "876000h" });
  } else if (body.decision === "reactivate") {
    await admin.auth.admin.updateUserById(targetUserId, { ban_duration: "none" });
  }

  const auditActionByDecision: Record<Decision, string> = {
    approve: "user_approved",
    reject: "user_rejected",
    suspend: "user_suspended",
    reactivate: "user_reactivated",
  };

  await logAdminAction({
    actorUserId: auth.ownerId,
    action: auditActionByDecision[body.decision],
    targetUserId,
    metadata: { email: target.email, previousStatus, nextStatus },
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
