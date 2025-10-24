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

/**
 * Buscar o crear usuario en Auth por email (idempotente).
 * - Intenta crear (email_confirm = true).
 * - Si ya existe, recorre listUsers() (paginado) y retorna el id.
 */
async function getOrCreateAuthUserIdByEmail(email: string, metadata?: Record<string, any>): Promise<string | null> {
  // 1) Intentar crear
  const createRes = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: metadata ?? {},
  });

  // ✅ Supabase v2: la respuesta viene en createRes.data.user
  const createdUserId = (createRes as any)?.data?.user?.id as string | undefined;
  if (!createRes.error && createdUserId) {
    return createdUserId;
  }

  // Si falló por "ya existe", buscamos en listUsers()
  const PER_PAGE = 200;
  const MAX_PAGES = 5;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const list = await supabaseAdmin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (list.error) break;

    const users = (list as any)?.data?.users as Array<{ id: string; email?: string }> | undefined;
    const found = (users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found?.id) return found.id;

    if ((users?.length ?? 0) < PER_PAGE) break;
  }

  return null;
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

    // 1) Buscar/crear usuario en Auth (idempotente)
    const soporteUserId = await getOrCreateAuthUserIdByEmail(email, {
      role: "soporte",
      nombre,
      apellido,
    });

    if (!soporteUserId) {
      return NextResponse.json(
        { error: "No se pudo obtener/crear el usuario de soporte en Auth." },
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
