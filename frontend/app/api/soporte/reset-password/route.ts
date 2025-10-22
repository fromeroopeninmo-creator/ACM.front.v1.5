// app/api/soporte/reset-password/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

async function resolveUserRole(userId: string): Promise<Role | null> {
  // 1) Por user_id (tu esquema)
  const { data: p1 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (p1?.role) return p1.role as Role;

  // 2) Fallback por id
  const { data: p2 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return (p2?.role as Role) ?? null;
}

async function findEmpresaIdByEmail(email: string): Promise<string | null> {
  // 1) profiles.email -> empresa_id
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("empresa_id")
    .eq("email", email)
    .maybeSingle();
  if (prof?.empresa_id) return prof.empresa_id as string;

  // 2) asesores.email -> empresa_id
  const { data: asesor } = await supabaseAdmin
    .from("asesores")
    .select("empresa_id")
    .eq("email", email)
    .maybeSingle();
  if (asesor?.empresa_id) return asesor.empresa_id as string;

  return null;
}

export async function POST(req: Request) {
  try {
    // 1) Autenticación
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const soporteUserId = auth?.user?.id ?? null;
    if (!soporteUserId) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // 2) Autorización
    const role = await resolveUserRole(soporteUserId);
    const allowed: Role[] = ["soporte", "super_admin", "super_admin_root"];
    if (!role || !allowed.includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // 3) Body
    const body = await req.json().catch(() => null as any);
    const email: string | undefined = body?.email;
    const redirectTo: string | undefined = body?.redirectTo; // opcional (p.ej. `${SITE_URL}/auth/callback`)
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Falta 'email'." }, { status: 400 });
    }

    // 4) Generar link de recuperación (service-role)
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: redirectTo ? { redirectTo } : undefined,
    });

    if (linkErr) {
      return NextResponse.json({ error: linkErr.message }, { status: 400 });
    }

    const actionLink =
      // v2 suele traerlo en properties.action_link
      // @ts-ignore
      linkData?.properties?.action_link ??
      // @ts-ignore
      linkData?.action_link ??
      null;

    // 5) Intentar vincular empresa del destinatario (si existe)
    let empresaId: string | null = null;
    try {
      empresaId = await findEmpresaIdByEmail(email);
    } catch {
      empresaId = null;
    }

    // 6) Log de acción de soporte
    const descripcion = `Reset de contraseña solicitado para ${email}`;
    await supabaseAdmin.from("acciones_soporte").insert({
      soporte_id: soporteUserId,
      empresa_id: empresaId, // puede ser null si no pertenece a ninguna
      descripcion,
      // timestamp y updated_at tienen default now()
    });

    // 7) Respuesta
    return NextResponse.json(
      {
        ok: true,
        email,
        actionLink, // útil en dev/sin SMTP
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
