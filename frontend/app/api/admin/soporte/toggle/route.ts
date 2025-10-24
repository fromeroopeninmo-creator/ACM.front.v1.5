// app/api/admin/soporte/toggle/route.ts
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
  // 1) Por user_id
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

export async function POST(req: Request) {
  try {
    // 1) Auth/rol (desde cookie del request)
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;

    if (!userId) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const role = await resolveUserRole(userId);
    const allowed = role === "super_admin" || role === "super_admin_root";
    if (!allowed) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // 2) Body
    const body = await req.json().catch(() => null);
    const id = body?.id as number | undefined;
    const email = (body?.email as string | undefined)?.trim().toLowerCase();
    const activo = body?.activo;

    if (typeof activo !== "boolean") {
      return NextResponse.json(
        { error: "Falta 'activo' (boolean)." },
        { status: 400 }
      );
    }
    if (!id && !email) {
      return NextResponse.json(
        { error: "Debe indicar 'id' (number) o 'email' (string)." },
        { status: 400 }
      );
    }

    // 3) Actualizar estado
    if (id) {
      const { error: updErr } = await supabaseAdmin
        .from("soporte")
        .update({ activo })
        .eq("id", id);

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 });
      }
    } else if (email) {
      // Buscar por email para obtener id (opcional), pero actualizamos por email directamente
      const { error: updErr } = await supabaseAdmin
        .from("soporte")
        .update({ activo })
        .eq("email", email);

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 });
      }
    }

    // 4) OK
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
