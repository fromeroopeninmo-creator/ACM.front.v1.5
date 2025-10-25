// frontend/app/api/admin/cashflow/empresas/export/route.ts
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
/** Escapa valores para CSV, respetando el delimitador elegido */
function csvEscape(v: any, delim: string) {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  // Si contiene comillas, saltos de línea o el delimitador, se envuelve en comillas
  const needsQuotes = s.includes('"') || s.includes("\n") || s.includes(delim);
  return needsQuotes ? `"${s}"` : s;
}

export async function GET(req: Request) {
  try {
    // 0) Auth
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    // 1) Autorización
    const role = await resolveUserRole(userId);
    const allowed: Role[] = ["super_admin", "super_admin_root"];
    if (!role || !allowed.includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // 2) Params (mismos que el listado)
    const url = new URL(req.url);
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");
    const q = (url.searchParams.get("q") || "").trim();
    const estadoPlan = (url.searchParams.get("estado_plan") || "todos") as
      | "activo"
      | "inactivo"
      | "todos";
    const sortBy = (url.searchParams.get("sortBy") ||
      "") as "mrr" | "ingresos" | "nombre" | "movs" | "ultimo_mov" | "";
    let sortDir = (url.searchParams.get("sortDir") || "").toLowerCase() as
      | "asc"
      | "desc"
      | "";
    const planName = url.searchParams.get("plan");

    // Delimitador CSV: por defecto ';' (Excel es-AR), se puede override con ?delim=,
    const delim = url.searchParams.get("delim") || ";";

    if (!desde || !hasta) {
      return NextResponse.json(
        { error: "Parámetros 'desde' y 'hasta' son requeridos (YYYY-MM-DD)." },
        { status: 400 }
      );
    }
    if (!sortDir) sortDir = sortBy === "nombre" ? "asc" : "desc";

    // 3) Resolver plan ids si corresponde
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
        // CSV vacío pero válido (con BOM y "sep=" para Excel)
        const bom = "\uFEFF";
        const header =
          `sep=${delim}\n` +
          [
            "empresa",
            "cuit",
            "plan",
            "activo",
            "fecha_inicio",
            "fecha_fin",
            "mrr_neto",
            "ingresos_neto",
            "ingresos_con_iva",
            "movs",
            "ultimo_mov",
            "asesores",
            "cupo",
            "override",
            "exceso",
          ].join(delim) + "\n";
        const headers = new Headers({
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="cashflow_empresas_${desde}_${hasta}.csv"`,
        });
        return new NextResponse(bom + header, { headers, status: 200 });
      }
    }

    // 4) Base empresas_planes
    let epQuery = supabaseAdmin
      .from("empresas_planes")
      .select("id, empresa_id, plan_id, max_asesores_override, fecha_inicio, fecha_fin, activo");
    if (planIdsFilter) epQuery = epQuery.in("plan_id", planIdsFilter);
    if (estadoPlan === "activo") epQuery = epQuery.eq("activo", true);
    if (estadoPlan === "inactivo") epQuery = epQuery.eq("activo", false);

    const { data: epRows, error: epErr } = await epQuery;
    if (epErr) return NextResponse.json({ error: epErr.message }, { status: 400 });

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
        { nombre: (e.nombre_comercial || e.razon_social || "") as string, cuit: e.cuit ?? null },
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

    const { data: detalleRows } = await supabaseAdmin
      .from("v_empresas_detalle_soporte")
      .select("empresa_id, asesores_totales")
      .in("empresa_id", empresaIds);
    const asesMap = new Map<string, number>(
      (detalleRows ?? []).map((r: any) => [String(r.empresa_id), Number(r.asesores_totales) || 0])
    );

    // ledger agg
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
      // sin ledger → ok
    }

    type Row = {
      empresa: string;
      cuit: string | null;
      plan: string | null;
      activo: boolean;
      fecha_inicio: string | null;
      fecha_fin: string | null;
      mrr_neto: number;
      ingresos_neto: number;
      ingresos_con_iva: number;
      movs: number;
      ultimo_mov: string | null;
      asesores: number;
      cupo: number;
      override: number | null;
      exceso: number;
    };

    const rows: Row[] = [];
    for (const rep of representantes) {
      const emp = empresaMap.get(rep.empresa_id);
      const pl = planMap.get(rep.plan_id);
      const cupo_base = pl ? pl.max_asesores : 0;
      const cupo =
        rep.max_asesores_override !== null && rep.max_asesores_override !== undefined
          ? Number(rep.max_asesores_override)
          : cupo_base;
      const asesores_usados = asesMap.get(rep.empresa_id) ?? 0;
      const excedente = Math.max(0, asesores_usados - cupo);
      const precio_base = pl ? pl.precio : 0;
      const precio_extra = pl ? pl.precio_extra_por_asesor : 0;
      const extra = excedente * precio_extra;
      const mrr = precio_base + extra;
      const ingresos = mrr;
      const ingresosIva = Math.round(ingresos * 1.21);

      const la = ledgerAgg.get(rep.empresa_id);
      const movs = la?.count ?? 0;
      const ultimo = la?.max_fecha ?? null;

      rows.push({
        empresa: emp?.nombre ?? "",
        cuit: emp?.cuit ?? null,
        plan: pl?.nombre ?? null,
        activo: rep.activo,
        fecha_inicio: rep.fecha_inicio,
        fecha_fin: rep.fecha_fin,
        mrr_neto: mrr,
        ingresos_neto: ingresos,
        ingresos_con_iva: ingresosIva,
        movs,
        ultimo_mov: ultimo,
        asesores: asesores_usados,
        cupo: cupo_base,
        override: rep.max_asesores_override,
        exceso: excedente,
      });
    }

    // filtro q
    const filtered = q
      ? rows.filter((r) => {
          const h = `${r.empresa} ${r.cuit || ""}`.toLowerCase();
          return h.includes(q.toLowerCase());
        })
      : rows;

    // orden
    const dir = sortDir === "asc" ? 1 : -1;
    const sorted = filtered.sort((a, b) => {
      switch (sortBy) {
        case "mrr":
          return (a.mrr_neto - b.mrr_neto) * dir;
        case "ingresos":
          return (a.ingresos_neto - b.ingresos_neto) * dir;
        case "movs":
          return (a.movs - b.movs) * dir;
        case "ultimo_mov": {
          const ta = a.ultimo_mov ? new Date(a.ultimo_mov).getTime() : 0;
          const tb = b.ultimo_mov ? new Date(b.ultimo_mov).getTime() : 0;
          return (ta - tb) * dir;
        }
        case "nombre":
          return a.empresa.localeCompare(b.empresa, "es") * (dir === 1 ? 1 : -1);
        default:
          return (a.mrr_neto - b.mrr_neto) * -1;
      }
    });

    // CSV (Excel-friendly): BOM + "sep=<delim>" + encabezado + filas, usando el delimitador elegido
    const headerCols = [
      "empresa",
      "cuit",
      "plan",
      "activo",
      "fecha_inicio",
      "fecha_fin",
      "mrr_neto",
      "ingresos_neto",
      "ngresos_con_iva", // (mantengo etiqueta tal cual estabas usando; si querés corregimos a 'ingresos_con_iva')
      "movs",
      "ultimo_mov",
      "asesores",
      "cupo",
      "override",
      "exceso",
    ];
    // OJO: corrijo un posible typo en el header anterior; si querés dejarlo exacto, reemplazá por 'ingresos_con_iva'
    headerCols[8] = "ingresos_con_iva";

    const header = headerCols.join(delim) + "\n";
    const lines = sorted.map((r) =>
      [
        csvEscape(r.empresa, delim),
        csvEscape(r.cuit, delim),
        csvEscape(r.plan, delim),
        r.activo ? "1" : "0",
        csvEscape(r.fecha_inicio, delim),
        csvEscape(r.fecha_fin, delim),
        r.mrr_neto,
        r.ingresos_neto,
        r.ingresos_con_iva,
        r.movs,
        csvEscape(r.ultimo_mov, delim),
        r.asesores,
        r.cupo,
        r.override ?? "",
        r.exceso,
      ].join(delim)
    );

    const sepLine = `sep=${delim}\n`;
    const csv = sepLine + header + lines.join("\n") + "\n";

    // BOM UTF-8 para Excel
    const bom = "\uFEFF";
    const body = bom + csv;

    const headers = new Headers({
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="cashflow_empresas_${desde}_${hasta}.csv"`,
    });
    return new NextResponse(body, { headers, status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
