export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

type Body = {
  email: string;
  password?: string; // opcional si generate_recovery_link = true
  role?: "super_admin" | "super_admin_root"; // default super_admin
  confirm_email?: boolean; // default true
  generate_recovery_link?: boolean; // si true, no se requiere password y se devuelve action_link
};

async function resolveUserRole(userId: string): Promise<Role | null> {
  // Primero por profiles.user_id
  const { data: p1 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (p1?.role) return p1.role as Role;

  // Fallback profiles.id
  const { data: p2 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return (p2?.role as Role) ?? null;
}

function deny(msg: string, status = 403) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  try {
    // 0) Auth del caller
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const callerId = auth?.user?.id ?? null;
    if (!callerId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const callerRole = await resolveUserRole(callerId);
    if (!callerRole) return deny("Acceso denegado.");

    // 1) Parse body
    const body = (await req.json()) as Body;
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password?.trim();
    const targetRole: "super_admin" | "super_admin_root" = body.role || "super_admin";
    const confirmEmail = body.confirm_email ?? true;
    const wantRecovery = body.generate_recovery_link === true;

    if (!email) {
      return NextResponse.json({ error: "Email es requerido." }, { status: 400 });
    }

    // 2) Autorización de operación según rol
    const isCallerRoot = callerRole === "super_admin_root";
    const isCallerAdmin = isCallerRoot || callerRole === "super_admin";

    if (!isCallerAdmin) {
      return deny("Solo super_admin o super_admin_root pueden gestionar admins.");
    }
    if (targetRole === "super_admin_root" && !isCallerRoot) {
      return deny("Solo super_admin_root puede gestionar cuentas root.");
    }

    // 3) Buscar usuario por email en auth.users
    const { data: gotUsers, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 400 });

    const existing = gotUsers?.users?.find((u) => u.email?.toLowerCase() === email) || null;

    // 4) Si piden recovery link → generar y devolver
    if (wantRecovery) {
      // Si no existe, primero creamos el usuario con email_confirm=true y sin password
      // (Supabase requiere un user para generar el recovery link).
      let userId = existing?.id || null;

      if (!userId) {
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
        });
        if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 });
        userId = created.user?.id || null;
        if (!userId) return NextResponse.json({ error: "No se pudo crear el usuario." }, { status: 500 });
      }

      // Upsert profile con rol target
      await supabaseAdmin.from("profiles").upsert(
        { id: userId, user_id: userId, email: email, role: targetRole },
        { onConflict: "id" }
      );

      // Generar link de recuperación
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
      });
      if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 });

      // ✅ En v2 viene en data.properties.action_link
      const actionLink =
        (linkData as any)?.properties?.action_link ?? null;

      return NextResponse.json(
        {
          ok: true,
          mode: "recovery",
          email,
          role: targetRole,
          action_link: actionLink,
          message:
            "Envia este action_link al usuario para que establezca su contraseña y acceda.",
        },
        { status: 200 }
      );
    }

    // 5) Crear o actualizar con password
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Password requerido (mínimo 6 caracteres) o use generate_recovery_link." },
        { status: 400 }
      );
    }

    let userId = existing?.id || null;

    if (!userId) {
      // Crear nuevo
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: confirmEmail,
      });
      if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 });
      userId = created.user?.id || null;
      if (!userId) return NextResponse.json({ error: "No se pudo crear el usuario." }, { status: 500 });
    } else {
      // Actualizar password
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
      });
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    // 6) Upsert en profiles con el rol destino
    const { error: profErr } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        user_id: userId,
        email,
        role: targetRole,
      },
      { onConflict: "id" }
    );
    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 400 });

    return NextResponse.json(
      {
        ok: true,
        mode: "password",
        email,
        role: targetRole,
        user_id: userId,
        message: "Usuario admin asegurado. Ya puede iniciar sesión.",
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado en ensure-root." },
      { status: 500 }
    );
  }
}
