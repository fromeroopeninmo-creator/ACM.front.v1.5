// app/api/soporte/empresas/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

function parseBool(v: string | null): boolean | null {
  if (v === null) return null;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function parseIntSafe(v: string | null, def: number): number {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : def;
}

// Intenta resolver el rol del usuario mirando profiles por user_id y, si no, por id (según tu esquema real)
async function resolveUserRole(userId: string): Promise<Role | null> {
  // Primero por user_id
  const { data: p1 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (p1?.role) return p1.role as Role;

  // Fallback por id (hay installs donde profiles.id === auth.users.id)
  const { data: p2 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return (p2?.role as Role) ?? null;
}

export async function GET(req: Request) {
  try {
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;

    if (!userId) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // Autorización por rol
    const role = await resolveUserRole(userId);
    const allowed: Role[] = ["soporte", "super_admin", "super_admin_root"];
    if (!role || !allowed.includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // Query params
    const url = new URL(req.url);
    const q = url.searchParams.get("q"); // texto
    const plan = url.searchParams.get("plan"); // nombre de plan
    const estado = url.searchParams.get("estado"); // 'activo' | 'inactivo'
    const from = url.searchParams.get("from"); // YYYY-MM-DD
    const to = url.searchParams.get("to"); // YYYY-MM-DD
    const page = parseIntSafe(url.searchParams.get("page"), 1);
    const pageSize = parseIntSafe(url.searchParams.get("pageSize"), 20);
    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    // Base query sobre la vista segura
    let query = supabaseAdmin
      .from("v_empresas_soporte")
      .select(
        "empresa_id, empresa_nombre, cuit, plan_nombre, max_asesores, max_asesores_override, plan_activo, fecha_inicio, fecha_fin, logo_url, color",
        { count: "exact" }
      );

    // Filtros
    if (q) {
      // búsqueda simple por nombre o cuit
      query = query.or(
        `empresa_nombre.ilike.%${q}%,cuit.ilike.%${q}%`
      );
    }

    if (plan && plan.trim().length > 0) {
      query = query.eq("plan_nombre", plan);
    }

    if (estado === "activo") query = query.eq("plan_activo", true);
    if (estado === "inactivo") query = query.eq("plan_activo", false);

    // Rango de fechas por fecha_inicio del plan vigente
    if (from) query = query.gte("fecha_inicio", from);
    if (to) query = query.lte("fecha_inicio", to);

    // Orden y paginado
    query = query.order("empresa_nombre", { ascending: true }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Mapeo de salida según contrato
    const items =
      data?.map((row) => ({
        empresaId: row.empresa_id,
        empresaNombre: row.empresa_nombre,
        cuit: row.cuit,
        planNombre: row.plan_nombre,
        maxAsesores: row.max_asesores,
        override: row.max_asesores_override,
        activo: row.plan_activo,
        fechaInicio: row.fecha_inicio,
        fechaFin: row.fecha_fin,
        logoUrl: row.logo_url,
        color: row.color,
      })) ?? [];

    return NextResponse.json(
      {
        items,
        page,
        pageSize: limit,
        total: count ?? 0,
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
