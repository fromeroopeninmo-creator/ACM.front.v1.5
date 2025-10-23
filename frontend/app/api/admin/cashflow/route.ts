// app/api/admin/cashflow/route.ts
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

async function resolveUserRole(userId: string): Promise<Role | null> {
  // Preferente: profiles.user_id
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

export async function GET(req: Request) {
  try {
    // 0) Auth
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // 1) Rol
    const role = await resolveUserRole(userId);
    const allowed: Role[] = ["super_admin", "super_admin_root"];
    if (!role || !allowed.includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // 2) Query params
    const url = new URL(req.url);
    const from = url.searchParams.get("from"); // YYYY-MM-DD
    const to = url.searchParams.get("to");     // YYYY-MM-DD
    const planName = url.searchParams.get("plan"); // nombre exacto del plan (opcional)
    const estado = url.searchParams.get("estado"); // 'activo' | 'finalizado' | 'todos' (opcional)
    const page = parseIntSafe(url.searchParams.get("page"), 1);
    const pageSize = parseIntSafe(url.searchParams.get("pageSize"), 50);
    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    // 3) Resolver filtro por plan (por nombre → ids)
    let planIdsFilter: string[] | null = null;
    if (planName && planName.trim().length > 0) {
      const { data: planRows, error: planErr } = await supabaseAdmin
        .from("planes")
        .select("id")
        .eq("nombre", planName);
      if (planErr) {
        return NextResponse.json({ error: planErr.message }, { status: 400 });
      }
      planIdsFilter = (planRows ?? []).map((r: any) => r.id as string);
      if (planIdsFilter.length === 0) {
        // No hay planes con ese nombre → respuesta vacía pero consistente
        return NextResponse.json(
          { items: [], page, pageSize: limit, total: 0 },
          { status: 200 }
        );
      }
    }

    // 4) Base query: empresas_planes con filtros y count
    let q = supabaseAdmin
      .from("empresas_planes")
      .select("id, empresa_id, plan_id, fecha_inicio, fecha_fin, activo", { count: "exact" });

    if (from) q = q.gte("fecha_inicio", from);
    if (to) q = q.lte("fecha_inicio", to);

    if (planIdsFilter) q = q.in("plan_id", planIdsFilter);

    if (estado === "activo") q = q.eq("activo", true);
    if (estado === "finalizado") q = q.eq("activo", false);
    // 'todos' → sin filtro extra

    // Orden y paginación
    q = q.order("fecha_inicio", { ascending: false }).range(offset, offset + limit - 1);

    const { data: epRows, error: epErr, count } = await q;
    if (epErr) {
      return NextResponse.json({ error: epErr.message }, { status: 400 });
    }

    if (!epRows || epRows.length === 0) {
      return NextResponse.json(
        { items: [], page, pageSize: limit, total: count ?? 0 },
        { status: 200 }
      );
    }

    // 5) Fetch relacionados (empresas y planes) y map
    const empresaIds = Array.from(new Set(epRows.map((r: any) => r.empresa_id as string)));
    const planIds = Array.from(new Set(epRows.map((r: any) => r.plan_id as string)));

    const [{ data: empresas, error: empErr }, { data: planes, error: planesErr }] = await Promise.all([
      supabaseAdmin
        .from("empresas")
        .select("id, nombre_comercial, razon_social")
        .in("id", empresaIds),
      supabaseAdmin
        .from("planes")
        .select("id, nombre")
        .in("id", planIds),
    ]);

    if (empErr) {
      return NextResponse.json({ error: empErr.message }, { status: 400 });
    }
    if (planesErr) {
      return NextResponse.json({ error: planesErr.message }, { status: 400 });
    }

    const empresaMap = new Map<string, { nombre_comercial: string | null; razon_social: string | null }>(
      (empresas ?? []).map((e: any) => [e.id as string, { nombre_comercial: e.nombre_comercial ?? null, razon_social: e.razon_social ?? null }])
    );
    const planMap = new Map<string, string>((planes ?? []).map((p: any) => [p.id as string, p.nombre as string]));

    const items = epRows.map((row: any) => {
      const e = empresaMap.get(row.empresa_id as string);
      const p = planMap.get(row.plan_id as string) ?? null;
      const empresaNombre = e?.nombre_comercial || e?.razon_social || "";
      return {
        empresaId: row.empresa_id as string,
        empresaNombre,
        plan: p,
        fechaInicio: row.fecha_inicio as string,
        fechaFin: (row.fecha_fin as string) ?? null,
        activo: !!row.activo,
      };
    });

    return NextResponse.json(
      { items, page, pageSize: limit, total: count ?? items.length },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
