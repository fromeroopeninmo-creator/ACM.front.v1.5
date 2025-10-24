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

function parseIntSafe(v: string | null, def: number): number {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : def;
}
function toNum(x: any): number | null {
  if (x === null || x === undefined || x === "") return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x === "string") {
    const n = parseFloat(x);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

async function resolveUserRole(userId: string): Promise<Role | null> {
  // 1) profiles.user_id
  const { data: p1 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (p1?.role) return p1.role as Role;

  // 2) fallback profiles.id
  const { data: p2 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return (p2?.role as Role) ?? null;
}

// ----------------------
// GET /api/admin/planes
// ----------------------
export async function GET(req: Request) {
  try {
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;

    if (!userId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const role = await resolveUserRole(userId);
    if (role !== "super_admin" && role !== "super_admin_root") {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q");
    const page = parseIntSafe(url.searchParams.get("page"), 1);
    const pageSize = parseIntSafe(url.searchParams.get("pageSize"), 10);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from("planes")
      .select(
        "id, nombre, precio, duracion_dias, max_asesores, precio_extra_por_asesor, created_at, updated_at",
        { count: "exact" }
      );

    if (q && q.trim()) {
      query = query.ilike("nombre", `%${q.trim()}%`);
    }

    // Orden por precio ascendente (nulls al final)
    query = query.order("precio", { ascending: true, nullsFirst: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        items:
          (data ?? []).map((p) => ({
            id: p.id,
            nombre: p.nombre,
            max_asesores: p.max_asesores,
            duracion_dias: p.duracion_dias,
            precio: p.precio,
            // Compat: el front espera 'activo'. La tabla no lo tiene; devolvemos true por defecto.
            activo: true,
            created_at: p.created_at ?? null,
            updated_at: p.updated_at ?? null,
            precio_extra_por_asesor: (p as any).precio_extra_por_asesor ?? null,
          })) ?? [],
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

// -----------------------
// POST /api/admin/planes
// -----------------------
export async function POST(req: Request) {
  try {
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;

    if (!userId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const role = await resolveUserRole(userId);
    if (role !== "super_admin" && role !== "super_admin_root") {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    const body = await req.json().catch(() => null as any);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body inválido." }, { status: 400 });
    }

    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    const max_asesores = Number(body.max_asesores);
    const duracion_dias = body.duracion_dias === undefined ? null : Number(body.duracion_dias);
    const precio = toNum(body.precio); // puede ser null
    const precio_extra_por_asesor = toNum(body.precio_extra_por_asesor); // puede ser null

    if (!nombre) return NextResponse.json({ error: "Falta 'nombre'." }, { status: 400 });
    if (!Number.isFinite(max_asesores) || max_asesores <= 0) {
      return NextResponse.json({ error: "'max_asesores' inválido." }, { status: 400 });
    }
    if (duracion_dias !== null && (!Number.isFinite(duracion_dias) || duracion_dias <= 0)) {
      return NextResponse.json({ error: "'duracion_dias' inválido." }, { status: 400 });
    }
    if (precio !== null && precio < 0) {
      return NextResponse.json({ error: "'precio' inválido." }, { status: 400 });
    }
    if (precio_extra_por_asesor !== null && precio_extra_por_asesor < 0) {
      return NextResponse.json({ error: "'precio_extra_por_asesor' inválido." }, { status: 400 });
    }

    const { error: insErr, data: inserted } = await supabaseAdmin
      .from("planes")
      .insert({
        nombre,
        max_asesores,
        duracion_dias: duracion_dias ?? null,
        precio, // neto
        precio_extra_por_asesor,
      })
      .select("id, nombre, precio, duracion_dias, max_asesores, precio_extra_por_asesor")
      .maybeSingle();

    if (insErr) {
      const msg = insErr.message || "";
      const status = msg.toLowerCase().includes("unique") ? 409 : 400;
      return NextResponse.json({ error: msg }, { status });
    }

    // Auditoría
    await supabaseAdmin.from("auditoria_planes").insert({
      actor_id: userId,
      actor_role: role,
      action: "create",
      plan_id: inserted?.id ?? null,
      valores_antes: null,
      valores_despues: {
        nombre,
        precio,
        duracion_dias: duracion_dias ?? null,
        max_asesores,
        precio_extra_por_asesor,
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
