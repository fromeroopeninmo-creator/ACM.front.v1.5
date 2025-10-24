// app/api/admin/soporte/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

// ---- Helpers ----
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

// ---- GET: listar agentes de soporte ----
export async function GET() {
  try {
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

    const { data, error } = await supabaseAdmin
      .from("soporte")
      .select("id, nombre, email, activo, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ items: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

// ---- POST: upsert agente de soporte ----
// Body esperado: { email: string; nombre?: string; apellido?: string }
export async function POST(req: Request) {
  try {
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

    const body = await req.json().catch(() => null);
    const email = String(body?.email || "").trim().toLowerCase();
    const nombre = (body?.nombre ? String(body.nombre) : null) || null;
    const apellido = (body?.apellido ? String(body.apellido) : null) || null;

    if (!email) {
      return NextResponse.json({ error: "Falta email." }, { status: 400 });
    }

    // 1) Buscar/crear usuario en Auth
    let soporteUserId: string | null = null;

    // Buscar por email en auth.users
    const { data: userByEmail, error: findErr } = await supabaseAdmin
      .from("auth.users")
      .select("id")
      .eq("email", email)
      .maybeSingle() as unknown as { data: { id: string } | null; error: any };

    if (findErr) {
      // Nota: select directo a auth.users puede no estar permitido según config;
      // si falla, recurrimos a admin API:
    }

    if (userByEmail?.id) {
      soporteUserId = userByEmail.id;
    } else {
      // Crear usuario confirmado via Admin API
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { role: "soporte", nombre, apellido },
      });
      if (createErr) {
        return NextResponse.json({ error: createErr.message }, { status: 400 });
      }
      soporteUserId = created.user?.id ?? null;
    }

    if (!soporteUserId) {
      return NextResponse.json(
        { error: "No se pudo obtener/crear el usuario de soporte." },
        { status: 500 }
      );
    }

    // 2) Upsert en profiles (rol soporte). Usamos id = user_id = auth.users.id
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: soporteUserId,
          user_id: soporteUserId,
          email,
          role: "soporte",
          nombre,
          apellido,
          empresa_id: null,
        },
        { onConflict: "id" }
      );
    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 400 });
    }

    // 3) Upsert en soporte (si ya existe por email, actualizar nombre/activo)
    // Intentamos update-by-email primero
    const { data: existingSoporte } = await supabaseAdmin
      .from("soporte")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingSoporte?.id) {
      const { error: updErr } = await supabaseAdmin
        .from("soporte")
        .update({
          nombre: nombre ?? undefined,
          activo: true,
        })
        .eq("id", existingSoporte.id);

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 });
      }
    } else {
      const { error: insErr } = await supabaseAdmin.from("soporte").insert({
        nombre,
        email,
        activo: true,
      });
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 400 });
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
