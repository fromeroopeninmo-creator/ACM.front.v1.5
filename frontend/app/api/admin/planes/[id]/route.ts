// app/api/admin/planes/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

function toNum(x: any): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === "number") return x;
  if (typeof x === "string") {
    const n = parseFloat(x);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

async function resolveUserRole(userId: string): Promise<Role | null> {
  // Pref: profiles.user_id
  const { data: p1 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (p1?.role) return p1.role as Role;

  // Fallback: profiles.id
  const { data: p2 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (p2?.role as Role) ?? null;
}

/**
 * GET /api/admin/planes
 * Lista planes internos
 */
export async function GET() {
  try {
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const role = await resolveUserRole(userId);
    const allowed: Role[] = ["super_admin", "super_admin_root"];
    if (!role || !allowed.includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    const { data, error, count } = await supabaseAdmin
      .from("planes")
      .select("id, nombre, precio, duracion_dias, max_asesores, precio_extra_por_asesor, updated_at", {
        count: "exact",
      })
      .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const items =
      data?.map((p: any) => ({
        id: p.id,
        nombre: p.nombre,
        precio: toNum(p.precio),
        duracion_dias: p.duracion_dias,
        max_asesores: p.max_asesores,
        precio_extra_por_asesor: toNum(p.precio_extra_por_asesor),
        updated_at: p.updated_at,
      })) ?? [];

    return NextResponse.json({ items, total: count ?? items.length }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}

/**
 * POST /api/admin/planes
 * Crea un plan (service-role) + registra auditoría
 * Body:
 * {
 *   nombre: string,
 *   precio: number,
 *   duracion_dias: number,
 *   max_asesores: number,
 *   precio_extra_por_asesor?: number
 * }
 */
export async function POST(req: Request) {
  try {
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const role = await resolveUserRole(userId);
    const allowed: Role[] = ["super_admin", "super_admin_root"];
    if (!role || !allowed.includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    const body = await req.json().catch(() => null as any);
    const nombre = body?.nombre;
    const precio = toNum(body?.precio);
    const duracion_dias = Number.isFinite(body?.duracion_dias) ? Number(body?.duracion_dias) : NaN;
    const max_asesores = Number.isFinite(body?.max_asesores) ? Number(body?.max_asesores) : NaN;
    const precio_extra_por_asesor = toNum(body?.precio_extra_por_asesor ?? 0);

    // Validaciones simples
    if (!nombre || typeof nombre !== "string") {
      return NextResponse.json({ error: "Falta 'nombre'." }, { status: 400 });
    }
    if (!Number.isFinite(precio) || precio < 0) {
      return NextResponse.json({ error: "Campo 'precio' inválido." }, { status: 400 });
    }
    if (!Number.isFinite(duracion_dias) || duracion_dias <= 0) {
      return NextResponse.json({ error: "Campo 'duracion_dias' inválido." }, { status: 400 });
    }
    if (!Number.isFinite(max_asesores) || max_asesores <= 0) {
      return NextResponse.json({ error: "Campo 'max_asesores' inválido." }, { status: 400 });
    }
    if (!Number.isFinite(precio_extra_por_asesor) || precio_extra_por_asesor < 0) {
      return NextResponse.json({ error: "Campo 'precio_extra_por_asesor' inválido." }, { status: 400 });
    }

    // Insert plan
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("planes")
      .insert({
        nombre,
        precio,
        duracion_dias,
        max_asesores,
        precio_extra_por_asesor,
      })
      .select("id, nombre, precio, duracion_dias, max_asesores, precio_extra_por_asesor, updated_at")
      .maybeSingle();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
    if (!inserted) return NextResponse.json({ error: "No se pudo crear el plan." }, { status: 400 });

    // Auditoría (service-role)
    await supabaseAdmin.from("auditoria_planes").insert({
      actor_id: userId,
      actor_role: role,
      action: "create",
      plan_id: inserted.id,
      valores_antes: null,
      valores_despues: {
        nombre: inserted.nombre,
        precio: inserted.precio,
        duracion_dias: inserted.duracion_dias,
        max_asesores: inserted.max_asesores,
        precio_extra_por_asesor: inserted.precio_extra_por_asesor,
      },
    });

    return NextResponse.json({ id: inserted.id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
