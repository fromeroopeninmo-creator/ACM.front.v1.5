// app/api/admin/cashflow/suscripciones/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

function clampPageSize(v: number, min = 1, max = 200) {
  return Math.max(min, Math.min(max, v));
}
function parseIntSafe(v: string | null, def: number): number {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : def;
}
function toISODate(d: Date) {
  return d.toISOString();
}
function startOfDayISO(yyyy_mm_dd: string) {
  const d = new Date(`${yyyy_mm_dd}T00:00:00.000Z`);
  return toISODate(d);
}
function endOfDayISO(yyyy_mm_dd: string) {
  const d = new Date(`${yyyy_mm_dd}T23:59:59.999Z`);
  return toISODate(d);
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
    // 0) Auth + rol
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const role = await resolveUserRole(userId);
    if (!role || !["super_admin", "super_admin_root"].includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // 1) Parámetros
    const url = new URL(req.url);
    const desdeRaw = url.searchParams.get("desde"); // YYYY-MM-DD (obligatorio)
    const hastaRaw = url.searchParams.get("hasta"); // YYYY-MM-DD (obligatorio)
    const empresaId = url.searchParams.get("empresaId"); // opcional
    const estado = url.searchParams.get("estado"); // 'activo' | 'inactivo' | 'todos' (opcional)
    const page = parseIntSafe(url.searchParams.get("page"), 1);
    const pageSize = clampPageSize(parseIntSafe(url.searchParams.get("pageSize"), 50));

    if (!desdeRaw || !hastaRaw) {
      return NextResponse.json(
        { error: "Parámetros 'desde' y 'hasta' son obligatorios (YYYY-MM-DD)." },
        { status: 400 }
      );
    }

    const desde = startOfDayISO(desdeRaw);
    const hasta = endOfDayISO(hastaRaw);

    // 2) Traer suscripciones que se solapen con el rango
    // solapamiento: fecha_inicio <= hasta && (fecha_fin is null || fecha_fin >= desde)
    let qEP = supabaseAdmin
      .from("empresas_planes")
      .select("id, empresa_id, plan_id, fecha_inicio, fecha_fin, activo, max_asesores_override", { count: "exact" })
      .lte("fecha_inicio", hasta)
      .or(`fecha_fin.is.null,fecha_fin.gte.${desde}`);

    if (empresaId) qEP = qEP.eq("empresa_id", empresaId);
    if (estado === "activo") qEP = qEP.eq("activo", true);
    if (estado === "inactivo") qEP = qEP.eq("activo", false);
    // 'todos' => sin filtro extra

    qEP = qEP.order("fecha_inicio", { ascending: false });

    const { data: epRows, error: epErr, count } = await qEP;
    if (epErr) {
      return NextResponse.json({ error: epErr.message }, { status: 400 });
    }

    if (!epRows || epRows.length === 0) {
      return NextResponse.json(
        { items: [], page, pageSize, total: 0 },
        { status: 200 }
      );
    }

    // 3) Enriquecer: empresas, planes y conteo de asesores activos por empresa
    const empresaIds = Array.from(new Set(epRows.map((r: any) => r.empresa_id as string)));
    const planIds = Array.from(new Set(epRows.map((r: any) => r.plan_id as string)));

    const [
      { data: empresas, error: empErr },
      { data: planes, error: pErr },
      { data: asesoresRows, error: aErr },
    ] = await Promise.all([
      supabaseAdmin
        .from("empresas")
        .select("id, nombre_comercial, razon_social")
        .in("id", empresaIds),
      supabaseAdmin
        .from("planes")
        .select("id, nombre, max_asesores")
        .in("id", planIds),
      // Para contar asesores activos por empresa, traemos sólo empresa_id (minimiza payload)
      supabaseAdmin
        .from("asesores")
        .select("empresa_id")
        .in("empresa_id", empresaIds)
        .eq("activo", true),
    ]);

    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 400 });
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 });

    const empresaMap = new Map<string, string>(
      (empresas ?? []).map((e: any) => [
        e.id as string,
        (e.nombre_comercial || e.razon_social || "") as string,
      ])
    );
    const planMap = new Map<string, { nombre: string; max_asesores: number }>(
      (planes ?? []).map((p: any) => [
        p.id as string,
        { nombre: String(p.nombre || ""), max_asesores: Number(p.max_asesores || 0) },
      ])
    );

    // Conteo de asesores activos por empresa
    const asesoresCountMap = new Map<string, number>();
    for (const row of asesoresRows ?? []) {
      const key = String(row.empresa_id);
      asesoresCountMap.set(key, (asesoresCountMap.get(key) || 0) + 1);
    }

    // 4) Paginación manual (sobre resultado enriquecido)
    const offset = (page - 1) * pageSize;
    const epPaged = epRows.slice(offset, offset + pageSize);

    // 5) Armar respuesta
    const items = epPaged.map((r: any) => {
      const empresa_id = r.empresa_id as string;
      const plan_id = r.plan_id as string;
      const empresa_nombre = empresaMap.get(empresa_id) || "";
      const planInfo = planMap.get(plan_id) || { nombre: "", max_asesores: 0 };

      const override = r.max_asesores_override as number | null;
      const maxPlan = Number(planInfo.max_asesores || 0);
      const max_asesores_effective = override ?? maxPlan;

      const utilizados = asesoresCountMap.get(empresa_id) || 0;
      const cupo_excedido = Math.max(0, utilizados - max_asesores_effective);

      return {
        empresa_id,
        empresa_nombre,
        plan_id,
        plan_nombre: planInfo.nombre,
        fecha_inicio: r.fecha_inicio as string,
        fecha_fin: (r.fecha_fin as string) ?? null,
        activo: !!r.activo,
        max_asesores_plan: maxPlan,
        max_asesores_override: override,
        asesores_utilizados: utilizados,
        cupo_excedido,
      };
    });

    return NextResponse.json(
      {
        items,
        page,
        pageSize,
        total: count ?? epRows.length,
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
