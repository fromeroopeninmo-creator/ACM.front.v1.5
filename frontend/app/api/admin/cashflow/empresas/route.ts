// frontend/app/api/admin/cashflow/empresas/route.ts
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

/**
 * GET /api/admin/cashflow/empresas
 * Query:
 *  - desde (YYYY-MM-DD) [requerido]
 *  - hasta (YYYY-MM-DD) [requerido]
 *  - q (string) [opcional] => busca por nombre/cuit
 *  - plan (string) [opcional] => nombre exacto de plan
 *  - estado_plan ("activo" | "inactivo" | "todos", default "todos")
 *  - page (number, default 1)
 *  - pageSize (number, default 20)
 *  - sortBy ("mrr" | "ingresos" | "nombre" | "movs" | "ultimo_mov") [opcional]
 *  - sortDir ("asc" | "desc"), default "desc" (para métricas) / "asc" (para nombre)
 *
 * Respuesta:
 * {
 *   page, pageSize, total,
 *   items: [{
 *     empresa_id, empresa_nombre, cuit,
 *     plan_nombre, plan_activo, fecha_inicio, fecha_fin,
 *     ingresos_neto_periodo, ingresos_con_iva_periodo,
 *     mrr_neto_actual,
 *     movimientos_count, ultimo_movimiento,
 *     asesores_usados, cupo_plan, override, exceso
 *   }]
 * }
 */
export async function GET(req: Request) {
  try {
    // 0) Auth
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // 1) Autorización
    const role = await resolveUserRole(userId);
    const allowed: Role[] = ["super_admin", "super_admin_root"];
    if (!role || !allowed.includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // 2) Params
    const url = new URL(req.url);
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");
    const q = (url.searchParams.get("q") || "").trim();
    const estadoPlan = (url.searchParams.get("estado_plan") || "todos") as
      | "activo"
      | "inactivo"
      | "todos";

    const page = parseIntSafe(url.searchParams.get("page"), 1);
    const pageSize = parseIntSafe(url.searchParams.get("pageSize"), 20);
    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    const sortBy = (url.searchParams.get("sortBy") ||
      "") as "mrr" | "ingresos" | "nombre" | "movs" | "ultimo_mov" | "";
    let sortDir = (url.searchParams.get("sortDir") || "").toLowerCase() as
      | "asc"
      | "desc"
      | "";

    if (!desde || !hasta) {
      return NextResponse.json(
        { error: "Parámetros 'desde' y 'hasta' son requeridos (YYYY-MM-DD)." },
        { status: 400 }
      );
    }

    // Por defecto: para métricas → desc; para nombre → asc
    if (!sortDir) {
      sortDir = sortBy === "nombre" ? "asc" : "desc";
    }

    const planName = url.searchParams.get("plan");
    let planIdsFilter: string[] | null = null;
    if (planName && planName.trim().length > 0) {
      const { data: planRows, error: planErr } = await supabaseAdmin
        .from("planes")
        .select("id")
        .eq("nombre", planName);
      if (planErr) {
        return NextResponse.json({ error: planErr.message }, { status: 400 });
      }
      planIdsFilter = (planRows ?? []).map((r: any) => String(r.id));
      if (planIdsFilter.length === 0) {
        return NextResponse.json(
          { page, pageSize: limit, total: 0, items: [] },
          { status: 200 }
        );
      }
    }

    // 3) Traer empresas_planes (base)
    let epQuery = supabaseAdmin
      .from("empresas_planes")
      .select("id, empresa_id, plan_id, max_asesores_override, fecha_inicio, fecha_fin, activo");

    if (planIdsFilter) epQuery = epQuery.in("plan_id", planIdsFilter);
    if (estadoPlan === "activo") epQuery = epQuery.eq("activo", true);
    if (estadoPlan === "inactivo") epQuery = epQuery.eq("activo", false);

    const { data: epRows, error: epErr } = await epQuery;
    if (epErr) {
      return NextResponse.json({ error: epErr.message }, { status: 400 });
    }
    if (!epRows || epRows.length === 0) {
      return NextResponse.json(
        { page, pageSize: limit, total: 0, items: [] },
        { status: 200 }
      );
    }

    // 4) Elegir fila representativa por empresa (vigente o más reciente)
    type Ep = {
      id: string;
      empresa_id: string;
      plan_id: string;
      max_asesores_override: number | null;
      fecha_inicio: string | null;
      fecha_fin: string | null;
      activo: boolean;
    };
    const byEmpresa = new Map<string, Ep[]>();
    for (const r of epRows as any[]) {
      const eId = String(r.empresa_id);
      const arr = byEmpresa.get(eId) || [];
      arr.push({
        id: String(r.id),
        empresa_id: eId,
        plan_id: String(r.plan_id),
        max_asesores_override:
          r.max_asesores_override === null || r.max_asesores_override === undefined
            ? null
            : Number(r.max_asesores_override),
        fecha_inicio: r.fecha_inicio ? String(r.fecha_inicio) : null,
        fecha_fin: r.fecha_fin ? String(r.fecha_fin) : null,
        activo: !!r.activo,
      });
      byEmpresa.set(eId, arr);
    }

    function isVigente(row: Ep) {
      if (!row.activo) return false;
      if (!row.fecha_fin) return true;
      try {
        return new Date(row.fecha_fin) >= new Date(`${desde}T00:00:00Z`);
      } catch {
        return true;
      }
    }
    function pickRepresentativa(arr: Ep[]): Ep {
      const vigentes = arr.filter(isVigente);
      if (vigentes.length > 0) {
        return vigentes.sort((a, b) => {
          const da = a.fecha_inicio ? new Date(a.fecha_inicio).getTime() : 0;
          const db = b.fecha_inicio ? new Date(b.fecha_inicio).getTime() : 0;
          return db - da;
        })[0];
      }
      return arr.sort((a, b) => {
        const da = a.fecha_inicio ? new Date(a.fecha_inicio).getTime() : 0;
        const db = b.fecha_inicio ? new Date(b.fecha_inicio).getTime() : 0;
        return db - da;
      })[0];
    }

    const representantes: Ep[] = [];
    for (const [_, arr] of byEmpresa) {
      if (!arr || arr.length === 0) continue;
      representantes.push(pickRepresentativa(arr));
    }
    if (representantes.length === 0) {
      return NextResponse.json(
        { page, pageSize: limit, total: 0, items: [] },
        { status: 200 }
      );
    }

    // 5) Traer empresas y planes
    const empresaIds = Array.from(new Set(representantes.map((r) => r.empresa_id)));
    const planIds = Array.from(new Set(representantes.map((r) => r.plan_id)));

    const [
      { data: empresas, error: empErr },
      { data: planes, error: planErr2 },
    ] = await Promise.all([
      supabaseAdmin
        .from("empresas")
        .select("id, nombre_comercial, razon_social, cuit")
        .in("id", empresaIds),
      supabaseAdmin
        .from("planes")
        .select("id, nombre, precio, max_asesores, precio_extra_por_asesor")
        .in("id", planIds),
    ]);

    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 400 });
    if (planErr2) return NextResponse.json({ error: planErr2.message }, { status: 400 });

    const empresaMap = new Map<string, { nombre: string; cuit: string | null }>(
      (empresas ?? []).map((e: any) => [
        String(e.id),
        {
          nombre: (e.nombre_comercial || e.razon_social || "") as string,
          cuit: e.cuit ?? null,
        },
      ])
    );
    const planMap = new Map<
      string,
      { nombre: string; precio: number; max_asesores: number; precio_extra_por_asesor: number }
    >(
      (planes ?? []).map((p: any) => [
        String(p.id),
        {
          nombre: String(p.nombre),
          precio: toNum(p.precio),
          max_asesores: toNum(p.max_asesores),
          precio_extra_por_asesor: toNum(p.precio_extra_por_asesor),
        },
      ])
    );

    // 6) Asesores usados por empresa
    const { data: detalleRows, error: detErr } = await supabaseAdmin
      .from("v_empresas_detalle_soporte")
      .select("empresa_id, asesores_totales")
      .in("empresa_id", empresaIds);
    if (detErr) return NextResponse.json({ error: detErr.message }, { status: 400 });
    const asesMap = new Map<string, number>(
      (detalleRows ?? []).map((r: any) => [String(r.empresa_id), Number(r.asesores_totales) || 0])
    );

    // 7) Movimientos del período (si existe ledger)
    type LedgerAgg = { empresa_id: string; count: number; max_fecha: string | null };
    let ledgerAgg = new Map<string, LedgerAgg>();
    try {
      const { data: ledgerRows } = await supabaseAdmin
        .from("ledger")
        .select("empresa_id, fecha")
        .in("empresa_id", empresaIds)
        .gte("fecha", desde)
        .lte("fecha", hasta);

      if (ledgerRows && ledgerRows.length > 0) {
        const tmp = new Map<string, { count: number; max: string | null }>();
        for (const r of ledgerRows as any[]) {
          const eId = String(r.empresa_id);
          const fecha = r.fecha ? String(r.fecha) : null;
          const prev = tmp.get(eId) || { count: 0, max: null };
          const nextCount = prev.count + 1;
          const nextMax =
            !prev.max || (fecha && new Date(fecha) > new Date(prev.max)) ? fecha : prev.max;
          tmp.set(eId, { count: nextCount, max: nextMax });
        }
        ledgerAgg = new Map(
          Array.from(tmp.entries()).map(([eId, v]) => [
            eId,
            { empresa_id: eId, count: v.count, max_fecha: v.max },
          ])
        );
      }
    } catch {
      // tabla ledger aún no creada → ignorar
    }

    // 8) Armar items + cálculos
    type Item = {
      empresa_id: string;
      empresa_nombre: string;
      cuit: string | null;
      plan_nombre: string | null;
      plan_activo: boolean;
      fecha_inicio: string | null;
      fecha_fin: string | null;
      ingresos_neto_periodo: number;
      ingresos_con_iva_periodo: number;
      mrr_neto_actual: number;
      movimientos_count: number;
      ultimo_movimiento: string | null;
      asesores_usados: number;
      cupo_plan: number;
      override: number | null;
      exceso: number;
    };

    const itemsAll: Item[] = [];
    for (const row of representantes) {
      const empMeta = empresaMap.get(row.empresa_id);
      const planMeta = planMap.get(row.plan_id);

      const empresa_nombre = empMeta?.nombre ?? "";
      const cuit = empMeta?.cuit ?? null;
      const plan_nombre = planMeta?.nombre ?? null;

      const cupo_base = planMeta ? planMeta.max_asesores : 0;
      const cupo =
        row.max_asesores_override !== null && row.max_asesores_override !== undefined
          ? Number(row.max_asesores_override)
          : cupo_base;

      const asesores_usados = asesMap.get(row.empresa_id) ?? 0;
      const excedente = Math.max(0, asesores_usados - cupo);
      const precio_base = planMeta ? planMeta.precio : 0;
      const precio_extra = planMeta ? planMeta.precio_extra_por_asesor : 0;
      const extra = excedente * precio_extra;

      const mrr_neto_actual = precio_base + extra;
      const ingresos_neto_periodo = mrr_neto_actual;
      const ingresos_con_iva_periodo = Math.round(ingresos_neto_periodo * 1.21);

      const la = ledgerAgg.get(row.empresa_id);
      const movimientos_count = la?.count ?? 0;
      const ultimo_movimiento = la?.max_fecha ?? null;

      itemsAll.push({
        empresa_id: row.empresa_id,
        empresa_nombre,
        cuit,
        plan_nombre,
        plan_activo: row.activo,
        fecha_inicio: row.fecha_inicio,
        fecha_fin: row.fecha_fin,
        ingresos_neto_periodo,
        ingresos_con_iva_periodo,
        mrr_neto_actual,
        movimientos_count,
        ultimo_movimiento,
        asesores_usados,
        cupo_plan: cupo_base,
        override: row.max_asesores_override,
        exceso: excedente,
      });
    }

    // 9) Filtro por q (nombre/cuit)
    const filtered = q
      ? itemsAll.filter((it) => {
          const h = `${it.empresa_nombre} ${it.cuit || ""}`.toLowerCase();
          return h.includes(q.toLowerCase());
        })
      : itemsAll;

    // 10) Ordenamiento
    const dir = sortDir === "asc" ? 1 : -1;
    const sorted = filtered.sort((a, b) => {
      switch (sortBy) {
        case "mrr":
          return (a.mrr_neto_actual - b.mrr_neto_actual) * dir;
        case "ingresos":
          return (a.ingresos_neto_periodo - b.ingresos_neto_periodo) * dir;
        case "movs":
          return (a.movimientos_count - b.movimientos_count) * dir;
        case "ultimo_mov": {
          const ta = a.ultimo_movimiento ? new Date(a.ultimo_movimiento).getTime() : 0;
          const tb = b.ultimo_movimiento ? new Date(b.ultimo_movimiento).getTime() : 0;
          return (ta - tb) * dir;
        }
        case "nombre":
          return a.empresa_nombre.localeCompare(b.empresa_nombre, "es") * (dir === 1 ? 1 : -1);
        default:
          // por defecto: mrr desc
          return (a.mrr_neto_actual - b.mrr_neto_actual) * -1;
      }
    });

    const total = sorted.length;
    const pageItems = sorted.slice(offset, offset + limit);

    return NextResponse.json(
      {
        page,
        pageSize: limit,
        total,
        items: pageItems,
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
