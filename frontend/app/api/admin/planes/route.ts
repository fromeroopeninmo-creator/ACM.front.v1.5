export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

// --- helpers ---
async function resolveUserRole(userId: string): Promise<Role | null> {
  const { data: p1 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (p1?.role) return p1.role as Role;

  const { data: p2 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return (p2?.role as Role) ?? null;
}

function parseIntSafe(v: string | null, def: number): number {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : def;
}

// --- GET: list + filtros ---
export async function GET(req: Request) {
  try {
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const role = await resolveUserRole(userId);
    if (!role || (role !== "super_admin" && role !== "super_admin_root")) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const activo = url.searchParams.get("activo"); // "true" | "false" | null
    const page = parseIntSafe(url.searchParams.get("page"), 1);
    const pageSize = parseIntSafe(url.searchParams.get("pageSize"), 20);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from("planes")
      .select("id, nombre, max_asesores, duracion_dias, precio, activo, created_at", { count: "exact" });

    if (q) query = query.ilike("nombre", `%${q}%`);
    if (activo === "true") query = query.eq("activo", true);
    if (activo === "false") query = query.eq("activo", false);

    query = query.order("nombre", { ascending: true }).range(from, to);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json(
      {
        items: data ?? [],
        page,
        pageSize,
        total: count ?? 0,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}

// --- POST: create ---
export async function POST(req: Request) {
  try {
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const role = await resolveUserRole(userId);
    if (!role || (role !== "super_admin" && role !== "super_admin_root")) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const nombre = String(body?.nombre || "").trim();
    const max_asesores = Number.isFinite(Number(body?.max_asesores)) ? Number(body.max_asesores) : null;
    const duracion_dias = body?.duracion_dias == null ? null : Number(body.duracion_dias);
    const precio = body?.precio == null ? null : Number(body.precio);
    const activo = body?.activo == null ? true : Boolean(body.activo);

    if (!nombre) return NextResponse.json({ error: "Falta nombre." }, { status: 400 });
    if (max_asesores == null || max_asesores < 0) {
      return NextResponse.json({ error: "max_asesores inválido." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("planes")
      .insert({
        nombre,
        max_asesores,
        duracion_dias,
        precio,
        activo,
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, id: data?.id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
