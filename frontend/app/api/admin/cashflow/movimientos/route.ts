// app/api/admin/cashflow/movimientos/route.ts
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
    const pasarela = url.searchParams.get("pasarela"); // opcional
    const estado = url.searchParams.get("estado"); // pending|paid|failed|refunded (opcional)
    const tipo = url.searchParams.get("tipo"); // subscription|extra_asesor|ajuste (opcional)
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

    const CASHFLOW_SOURCE = (process.env.CASHFLOW_SOURCE || "hybrid").toLowerCase(); // ledger|derived|hybrid

    // 2) Intento por LEDGER si procede
    let usarLedger = CASHFLOW_SOURCE === "ledger" || CASHFLOW_SOURCE === "hybrid";
    let ledgerResult:
      | {
          items: any[];
          total: number;
        }
      | null = null;

    if (usarLedger) {
      // Base query ledger
      let q = supabaseAdmin
        .from("movimientos_financieros")
        .select("id, fecha, empresa_id, tipo, descripcion, pasarela, estado, referencia_pasarela, moneda, monto_neto, metadata", { count: "exact" })
        .gte("fecha", desde)
        .lte("fecha", hasta);

      if (empresaId) q = q.eq("empresa_id", empresaId);
      if (pasarela) q = q.eq("pasarela", pasarela);
      if (estado) q = q.eq("estado", estado);
      if (tipo) q = q.eq("tipo", tipo);

      q = q.order("fecha", { ascending: false });

      const { data: rowsAll, error: errAll, count } = await q;
      if (errAll) {
        return NextResponse.json({ error: errAll.message }, { status: 400 });
      }

      const total = count ?? (rowsAll?.length || 0);

      // Paginación manual (ya que select con count no admite range en algunos modos)
      const offset = (page - 1) * pageSize;
      const rows = (rowsAll ?? []).slice(offset, offset + pageSize);

      // Enriquecer con empresa_nombre
      const empresaIds = Array.from(new Set(rows.map((r: any) => r.empresa_id).filter(Boolean)));
      let empresaMap = new Map<string, string>();
      if (empresaIds.length > 0) {
        const { data: empresas, error: empErr } = await supabaseAdmin
          .from("empresas")
          .select("id, nombre_comercial, razon_social")
          .in("id", empresaIds);
        if (empErr) {
          return NextResponse.json({ error: empErr.message }, { status: 400 });
        }
        empresaMap = new Map(
          (empresas ?? []).map((e: any) => [
            e.id as string,
            (e.nombre_comercial || e.razon_social || "") as string,
          ])
        );
      }

      const items = (rows ?? []).map((r: any) => {
        const empresaNombre = empresaMap.get(r.empresa_id) || "";
        const iva = Number((Number(r.monto_neto || 0) * 0.21).toFixed(2));
        const totalConIva = Number((Number(r.monto_neto || 0) * 1.21).toFixed(2));
        return {
          id: r.id as string,
          fecha: r.fecha as string,
          empresa_id: r.empresa_id as string,
          empresa_nombre: empresaNombre,
          tipo: r.tipo as string, // subscription|extra_asesor|ajuste
          concepto: (r.descripcion as string) || null,
          pasarela: (r.pasarela as string) || "simulada",
          moneda: (r.moneda as string) || "ARS",
          monto_neto: Number(r.monto_neto || 0),
          iva_21: iva,
          total_con_iva: totalConIva,
          estado: r.estado as string, // pending|paid|failed|refunded
          referencia_pasarela: (r.referencia_pasarela as string) || null,
          metadata: r.metadata || {},
        };
      });

      if (CASHFLOW_SOURCE === "ledger" || ((rowsAll?.length || 0) > 0)) {
        ledgerResult = { items, total };
      }
    }

    if (ledgerResult) {
      return NextResponse.json(
        {
          items: ledgerResult.items,
          page,
          pageSize,
          total: ledgerResult.total,
        },
        { status: 200 }
      );
    }

    // 3) Derivado (cuando CASHFLOW_SOURCE=derived, o hybrid sin datos en ledger)
    // Estrategia simple: por cada empresa con plan que se solape con [desde, hasta],
    // generar 1 movimiento "subscription" con fecha = max(desde, fecha_inicio) y precio del plan.
    // (Suficiente para pruebas iniciales sin pasarela)
    let qEP = supabaseAdmin
      .from("empresas_planes")
      .select("id, empresa_id, plan_id, fecha_inicio, fecha_fin, activo");

    if (empresaId) qEP = qEP.eq("empresa_id", empresaId);

    // solapamiento: fecha_inicio <= hasta && (fecha_fin is null || fecha_fin >= desde)
    qEP = qEP.lte("fecha_inicio", hasta).or(`fecha_fin.is.null,fecha_fin.gte.${desde}`);

    const { data: epRows, error: epErr } = await qEP;
    if (epErr) {
      return NextResponse.json({ error: epErr.message }, { status: 400 });
    }
    if (!epRows || epRows.length === 0) {
      return NextResponse.json(
        { items: [], page, pageSize, total: 0 },
        { status: 200 }
      );
    }

    const planIds = Array.from(new Set(epRows.map((r: any) => r.plan_id)));
    const { data: planes, error: pErr } = await supabaseAdmin
      .from("planes")
      .select("id, nombre, precio")
      .in("id", planIds);
    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 400 });
    }
    const precioMap = new Map<string, { nombre: string; precio: number }>(
      (planes ?? []).map((p: any) => [
        p.id as string,
        { nombre: String(p.nombre || ""), precio: Number(p.precio || 0) },
      ])
    );

    const empresaIds = Array.from(new Set(epRows.map((r: any) => r.empresa_id)));
    const { data: empresas, error: empErr } = await supabaseAdmin
      .from("empresas")
      .select("id, nombre_comercial, razon_social")
      .in("id", empresaIds);
    if (empErr) {
      return NextResponse.json({ error: empErr.message }, { status: 400 });
    }
    const empresaMap = new Map<string, string>(
      (empresas ?? []).map((e: any) => [
        e.id as string,
        (e.nombre_comercial || e.razon_social || "") as string,
      ])
    );

    const derivedItemsRaw = (epRows ?? []).map((r: any) => {
      const planInfo = precioMap.get(r.plan_id) || { nombre: "", precio: 0 };
      const empresaNombre = empresaMap.get(r.empresa_id) || "";
      // Fecha del movimiento derivado
      const fechaInicio = new Date(r.fecha_inicio).toISOString();
      const fechaMovimiento = fechaInicio < desde ? desde : fechaInicio;

      const monto = Number(planInfo.precio || 0);
      const iva = Number((monto * 0.21).toFixed(2));
      const totalConIva = Number((monto * 1.21).toFixed(2));
      return {
        // sin id real (no existe en ledger)
        id: null as string | null,
        fecha: fechaMovimiento,
        empresa_id: r.empresa_id as string,
        empresa_nombre: empresaNombre,
        tipo: "subscription",
        concepto: `Plan ${planInfo.nombre}`,
        pasarela: "simulada",
        moneda: "ARS",
        monto_neto: monto,
        iva_21: iva,
        total_con_iva: totalConIva,
        estado: "paid", // derivado como cobrado para simplificar el caso base
        referencia_pasarela: null as string | null,
        metadata: { source: "derived" },
      };
    });

    // Filtros opcionales sobre derivados
    let filtered = derivedItemsRaw;
    if (pasarela) filtered = filtered.filter((x) => x.pasarela === pasarela);
    if (estado) filtered = filtered.filter((x) => x.estado === estado);
    if (tipo) filtered = filtered.filter((x) => x.tipo === tipo);

    // Orden por fecha DESC
    filtered.sort((a, b) => (a.fecha > b.fecha ? -1 : a.fecha < b.fecha ? 1 : 0));

    // Paginación
    const total = filtered.length;
    const offset = (page - 1) * pageSize;
    const items = filtered.slice(offset, offset + pageSize);

    return NextResponse.json(
      { items, page, pageSize, total },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
