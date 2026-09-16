import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/supabase/requireOwner";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/lib/adminAudit";

interface OverrideInput {
  companyId: string;
  moduleKey: string;
  action: string;
  allowed: boolean;
}

interface PermissionsBody {
  permissionProfileName?: string;
  companyIds?: string[];
  overrides?: OverrideInput[];
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const targetUserId = params.id;

  let body: PermissionsBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro de configuração." }, { status: 500 });
  }

  const { data: target } = await admin
    .from("profiles")
    .select("id, system_role, permission_profile_id")
    .eq("id", targetUserId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }
  if (target.system_role === "owner") {
    return NextResponse.json({ error: "O Owner não pode ser alterado por aqui." }, { status: 400 });
  }

  const [{ data: beforeCompanies }, { data: beforeProfile }] = await Promise.all([
    admin.from("user_companies").select("company_id").eq("user_id", targetUserId),
    target.permission_profile_id
      ? admin.from("permission_profiles").select("name").eq("id", target.permission_profile_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string } | null }),
  ]);

  if (body.permissionProfileName) {
    const { data: profileRow, error: profileLookupError } = await admin
      .from("permission_profiles")
      .select("id")
      .eq("name", body.permissionProfileName)
      .maybeSingle();
    if (profileLookupError || !profileRow) {
      return NextResponse.json({ error: "Perfil de permissão inválido." }, { status: 400 });
    }
    const { error } = await admin.from("profiles").update({ permission_profile_id: profileRow.id }).eq("id", targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.companyIds) {
    await admin.from("user_companies").delete().eq("user_id", targetUserId);
    if (body.companyIds.length > 0) {
      const rows = body.companyIds.map((companyId) => ({ user_id: targetUserId, company_id: companyId }));
      const { error } = await admin.from("user_companies").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (body.overrides) {
    await admin.from("user_permission_overrides").delete().eq("user_id", targetUserId);
    if (body.overrides.length > 0) {
      const rows = body.overrides.map((o) => ({
        user_id: targetUserId,
        company_id: o.companyId,
        module_key: o.moduleKey,
        action: o.action,
        allowed: o.allowed,
      }));
      const { error } = await admin.from("user_permission_overrides").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  await logAdminAction({
    actorUserId: auth.ownerId,
    action: "permissions_changed",
    targetUserId,
    metadata: {
      before: {
        permissionProfile: beforeProfile?.name ?? null,
        companyIds: (beforeCompanies ?? []).map((r) => r.company_id),
      },
      after: {
        permissionProfile: body.permissionProfileName ?? beforeProfile?.name ?? null,
        companyIds: body.companyIds ?? (beforeCompanies ?? []).map((r) => r.company_id),
        overridesCount: body.overrides?.length,
      },
    },
  });

  return NextResponse.json({ ok: true });
}
