import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { PERMISSION_MODULES } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/supabase/requireOwner";

interface OverrideInput {
  companyId: string;
  moduleKey: string;
  action: string;
  allowed: boolean;
}

interface CreateUserBody {
  name?: string;
  email?: string;
  password?: string;
  permissionProfileName?: string;
  companyIds?: string[];
  overrides?: OverrideInput[];
}

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;
const allowedActions = new Set(
  PERMISSION_MODULES.flatMap((module) => module.actions.map((action) => `${module.key}:${action.key}`))
);

export async function POST(request: Request) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let body: CreateUserBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const permissionProfileName = body.permissionProfileName?.trim();
  const companyIds = Array.from(new Set(Array.isArray(body.companyIds) ? body.companyIds : []));
  const overrides = Array.isArray(body.overrides) ? body.overrides : [];

  if (!name || !email || !permissionProfileName || !password) {
    return NextResponse.json(
      { error: "Nome, e-mail, senha e perfil de permissão são obrigatórios." },
      { status: 400 }
    );
  }
  if (!PASSWORD_PATTERN.test(password)) {
    return NextResponse.json(
      { error: "A senha deve ter pelo menos 10 caracteres, com maiúscula, minúscula e número." },
      { status: 400 }
    );
  }
  if (overrides.length > 1000) {
    return NextResponse.json({ error: "Quantidade de permissões inválida." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro de configuração." },
      { status: 500 }
    );
  }

  const [{ data: profileRow, error: profileError }, { data: validCompanies, error: companiesError }] =
    await Promise.all([
      admin.from("permission_profiles").select("id").eq("name", permissionProfileName).maybeSingle(),
      companyIds.length
        ? admin.from("companies").select("id").in("id", companyIds).eq("active", true)
        : Promise.resolve({ data: [] as { id: string }[], error: null }),
    ]);

  if (profileError || !profileRow) {
    return NextResponse.json({ error: "Perfil de permissão inválido." }, { status: 400 });
  }
  if (companiesError || (validCompanies ?? []).length !== companyIds.length) {
    return NextResponse.json({ error: "Uma ou mais empresas são inválidas." }, { status: 400 });
  }

  const selectedCompanies = new Set(companyIds);
  const sanitizedOverrides: OverrideInput[] = [];
  const seenOverrides = new Set<string>();
  for (const override of overrides) {
    const key = `${override.moduleKey}:${override.action}`;
    const uniqueKey = `${override.companyId}:${key}`;
    if (
      !selectedCompanies.has(override.companyId) ||
      !allowedActions.has(key) ||
      typeof override.allowed !== "boolean" ||
      seenOverrides.has(uniqueKey)
    ) {
      return NextResponse.json({ error: "Configuração de permissões inválida." }, { status: 400 });
    }
    seenOverrides.add(uniqueKey);
    sanitizedOverrides.push(override);
  }

  // A senha é enviada somente ao Supabase Auth e nunca é persistida,
  // registrada no audit log ou devolvida ao navegador.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Não foi possível criar este usuário." },
      { status: 400 }
    );
  }

  const userId = created.user.id;
  try {
    const { error: profileUpdateError } = await admin
      .from("profiles")
      .update({
        status: "active",
        full_name: name,
        permission_profile_id: profileRow.id,
        approved_at: new Date().toISOString(),
        approved_by: auth.ownerId,
      })
      .eq("id", userId);
    if (profileUpdateError) throw profileUpdateError;

    if (companyIds.length > 0) {
      const { error } = await admin.from("user_companies").insert(
        companyIds.map((companyId) => ({ user_id: userId, company_id: companyId }))
      );
      if (error) throw error;
    }

    if (sanitizedOverrides.length > 0) {
      const { error } = await admin.from("user_permission_overrides").insert(
        sanitizedOverrides.map((override) => ({
          user_id: userId,
          company_id: override.companyId,
          module_key: override.moduleKey,
          action: override.action,
          allowed: override.allowed,
        }))
      );
      if (error) throw error;
    }
  } catch (error) {
    // Evita deixar uma conta Auth órfã quando a configuração interna falha.
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível configurar o acesso." },
      { status: 500 }
    );
  }

  await logAdminAction({
    actorUserId: auth.ownerId,
    action: "user_created",
    targetUserId: userId,
    metadata: {
      email,
      name,
      permissionProfile: permissionProfileName,
      companyIds,
      permissionOverrides: sanitizedOverrides,
      emailConfirmed: true,
    },
  });

  return NextResponse.json({ ok: true, userId }, { status: 201 });
}
