import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/supabase/requireOwner";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/lib/adminAudit";

interface InviteBody {
  name: string;
  email: string;
  permissionProfileName: string;
  companyIds: string[];
}

export async function POST(request: Request) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let body: InviteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const permissionProfileName = body.permissionProfileName?.trim();
  const companyIds = Array.isArray(body.companyIds) ? body.companyIds : [];

  if (!name || !email || !permissionProfileName) {
    return NextResponse.json({ error: "Nome, e-mail e perfil de permissão são obrigatórios." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro de configuração." }, { status: 500 });
  }

  const { data: profileRow, error: profileLookupError } = await admin
    .from("permission_profiles")
    .select("id")
    .eq("name", permissionProfileName)
    .maybeSingle();

  if (profileLookupError || !profileRow) {
    return NextResponse.json({ error: "Perfil de permissão inválido." }, { status: 400 });
  }

  // Fluxo recomendado do Supabase: convite por e-mail, o próprio usuário
  // define a senha no primeiro acesso. O Owner nunca vê/define a senha
  // de outra pessoa.
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name },
  });

  if (inviteError || !inviteData.user) {
    return NextResponse.json(
      { error: inviteError?.message ?? "Não foi possível convidar este e-mail." },
      { status: 400 }
    );
  }

  const newUserId = inviteData.user.id;

  // Acesso criado pelo Owner já nasce ATIVO, com o perfil e as empresas
  // já configurados.
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      status: "active",
      full_name: name,
      permission_profile_id: profileRow.id,
      approved_at: new Date().toISOString(),
      approved_by: auth.ownerId,
    })
    .eq("id", newUserId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (companyIds.length > 0) {
    const rows = companyIds.map((companyId) => ({ user_id: newUserId, company_id: companyId }));
    const { error: companiesError } = await admin.from("user_companies").upsert(rows, { onConflict: "user_id,company_id" });
    if (companiesError) {
      return NextResponse.json({ error: companiesError.message }, { status: 500 });
    }
  }

  await logAdminAction({
    actorUserId: auth.ownerId,
    action: "user_created",
    targetUserId: newUserId,
    metadata: { email, name, permissionProfile: permissionProfileName, companyIds },
  });

  return NextResponse.json({ ok: true, userId: newUserId });
}
