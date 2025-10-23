// app/api/admin/usuarios/role/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role =
  | "empresa"
  | "asesor"
  | "soporte"
  | "super_admin"
  | "super_admin_root";

async function resolveUserRole(userId: string): Promise<Role | null> {
  const { data: p } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  return (p?.role as Role) ?? null;
}

/**
 * POST /api/admin/usuarios/role
 * Cambia el rol de un usuario (solo super_admin_root)
 * Body: { userId: string, newRole: Role }
 */
export async function POST(req: Request) {
  try {
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const actorId = auth?.user?.id ?? null;
    if (!actorId)
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const actorRole = await resolveUserRole(actorId);
    if (actorRole !== "super_admin_root") {
      return NextResponse.json(
        { error: "Solo super_admin_root puede cambiar roles." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null as any);
    const { userId, newRole } = body || {};
    const validRoles: Role[] = [
      "empresa",
      "asesor",
      "soporte",
      "super_admin",
      "super_admin_root",
    ];

    if (!userId || typeof userId !== "string")
      return NextResponse.json({ error: "Falta 'userId'." }, { status: 400 });

    if (!newRole || !validRoles.includes(newRole))
      return NextResponse.json({ error: "Rol inválido." }, { status: 400 });

    // Evitar que se cambie el rol del propio root
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (target?.role === "super_admin_root" && actorId !== userId) {
      return NextResponse.json(
        { error: "No se puede modificar a otro super_admin_root." },
        { status: 403 }
      );
    }

    // Actualizar role
    const { error: updErr } = await supabaseAdmin
      .from("profiles")
      .update({ role: newRole })
      .eq("user_id", userId);

    if (updErr)
      return NextResponse.json({ error: updErr.message }, { status: 400 });

    // Registrar acción
    await supabaseAdmin.from("acciones_soporte").insert({
      soporte_id: actorId,
      empresa_id: null,
      descripcion: `Cambio de rol → ${newRole} (target: ${userId})`,
    });

    return NextResponse.json({ ok: true, newRole }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
