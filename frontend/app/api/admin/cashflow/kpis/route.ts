// app/api/admin/cashflow/kpis/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

function toISODate(d: Date) {
  return d.toISOString();
}
function startOfDayISO(s: string) {
  const d = new Date(s + "T00:00:00.000Z");
  return toISODate(d);
}
function endOfDayISO(s: string) {
  const d = new Date(s + "T23:59:59.999Z");
  return toISODate(d);
}
function firstDayOfMonthISO(s: string) {
  const d = new Date(s + "T00:00:00.000Z");
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return toISODate(d);
}
function lastDayOfMonthISO(s: string) {
  const d = new Date(s + "T00:00:00.000Z");
  d.setUTCMonth(d.getUTCMonth() + 1, 0); // día 0 del siguiente mes = último del actual
  d.setUTCHours(23, 59, 59, 999);
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

    if (!desdeRaw || !hastaRaw) {
      return NextResponse.json(
        { error: "Parámetros 'desde' y 'hasta' son obligatorios (YYYY-MM-DD)." },
        { status: 400 }
      );
    }

    const desde = startOfDayISO(desdeRaw);
    const hasta = endOfDayISO(hastaRaw);

    // Mes de referencia para MRR (mes de 'hasta')
    const mrrDesde = firstDayOfMonthISO(hastaRaw);
    const mrrHasta = lastDayOfMonthISO(hastaRaw);

    const CASHFLOW_SOURCE = (process.env.CASHFLOW_SOURCE || "hybrid").toLowerCase(); // ledger | derived | hybrid

    // 2) Intento por LEDGER si procede
    let usarLedger = CASHFLOW_SOURCE === "ledger" || CASHFLOW_SOURCE === "hybrid";
    let kpisDesdeLedger:
      | {
          ingresos_neto_total: number;
          mrr_neto: number;
          empresas_activas: number;
        }
      | null = null;

    if (usarLedger) {
      // ingresos_neto_total: sum(monto_neto) de movimientos 'paid' dentro del rango
      let qTotal = supabaseAdmin
        .from("movimientos_financieros")
        .select("monto_neto, empresa_id, tipo, estado, fecha")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .eq("estado", "paid");

      if (empresaId) qTotal = qTotal.eq("empresa_id", empresaId);

      const { data: movsRango, error: errRango } = await qTotal;
      if (errRango) {
        return NextResponse.json({ error: errRango.message }, { status: 400 });
      }

      const ingresosNetoTotal =
        (movsRango ?? []).reduce((acc: number, r: any) => acc + Number(r.monto_neto || 0), 0) || 0;

      // mrr_neto: sum(subscription 'paid') del mes de referencia de 'hasta'
      let qMRR = supabaseAdmin
        .from("movimientos_financieros")
        .select("monto_neto, empresa_id, tipo, estado, fecha")
        .gte("fecha", mrrDesde)
        .lte("fecha", mrrHasta)
        .eq("estado", "paid")
        .eq("tipo", "subscription");

      if (empresaId) qMRR = qMRR.eq("empresa_id", empresaId);

      const { data: movsMRR, error: errMRR } = await qMRR;
      if (errMRR) {
        return NextResponse.json({ error: errMRR.message }, { status: 400 });
      }

      const mrrNeto =
        (movsMRR ?? []).reduce((acc: number, r: any) => acc + Number(r.monto_neto || 0), 0) || 0;

      // empresas_activas: cantidad de empresas con al menos 1 'subscription' paid en el rango
      const empresasActivasSet = new Set<string>();
      for (const r of movsRango ?? []) {
        if (r.tipo === "subscription" && r.estado === "paid" && r.empresa_id) {
          empresasActivasSet.add(String(r.empresa_id));
        }
      }
      const empresasActivas = empresasActivasSet.size;

      // Si en 'hybrid' no hay datos útiles, luego caemos a 'derived'
      const hayDatosLedger = (movsRango?.length || 0) > 0 || (movsMRR?.length || 0) > 0;
      if (CASHFLOW_SOURCE === "ledger" || (CASHFLOW_SOURCE === "hybrid" && hayDatosLedger)) {
        kpisDesdeLedger = {
          ingresos_neto_total: ingresosNetoTotal,
          mrr_neto: mrrNeto,
          empresas_activas: empresasActivas,
        };
      }
    }

    // 3) Si no usamos ledger o no hubo datos en hybrid, caemos a derivado
    if (!kpisDesdeLedger) {
      // Derivado simple:
      // - MRR: suma de precio (neto) de planes activos en el mes de referencia (según empresas_planes + planes).
      // - Ingresos en rango: aproximación como MRR del mes de referencia (si el rango cae en ese mes);
      //   para rangos más amplios podríamos multiplicar por meses, pero mantenemos aproximación inicial.
      // - empresas_activas: cantidad de empresas con plan activo en el rango.
      let qEP = supabaseAdmin
        .from("empresas_planes")
        .select("empresa_id, plan_id, fecha_inicio, fecha_fin, activo");

      if (empresaId) qEP = qEP.eq("empresa_id", empresaId);

      // Empresas con plan que se solapa con el rango buscado (cualquier solapamiento)
      // fecha_inicio <= hasta && (fecha_fin is null || fecha_fin >= desde)
      qEP = qEP.lte("fecha_inicio", hasta).or(`fecha_fin.is.null,fecha_fin.gte.${desde}`);

      const { data: epRows, error: epErr } = await qEP;
      if (epErr) {
        return NextResponse.json({ error: epErr.message }, { status: 400 });
      }
      if (!epRows || epRows.length === 0) {
        // Sin datos → KPIs en cero
        return NextResponse.json(
          {
            rango: { desde: desdeRaw, hasta: hastaRaw },
            mrr_neto: 0,
            ingresos_neto_total: 0,
            ingresos_con_iva: 0,
            arpu_neto: 0,
            empresas_activas: 0,
            churn_empresas: 0,
            upgrades: 0,
            downgrades: 0,
          },
          { status: 200 }
        );
      }

      const planIds = Array.from(new Set(epRows.map((r: any) => r.plan_id)));
      const { data: planes, error: pErr } = await supabaseAdmin
        .from("planes")
        .select("id, precio")
        .in("id", planIds);
      if (pErr) {
        return NextResponse.json({ error: pErr.message }, { status: 400 });
      }
      const precioMap = new Map<string, number>(
        (planes ?? []).map((p: any) => [p.id as string, Number(p.precio || 0)])
      );

      // Activas en el mes de referencia: plan que se solapa con [mrrDesde, mrrHasta]
      const activasMesRef = epRows.filter((r: any) => {
        const fi = new Date(r.fecha_inicio).toISOString();
        const ff = r.fecha_fin ? new Date(r.fecha_fin).toISOString() : null;
        const solapa =
          fi <= mrrHasta && (ff === null || ff >= mrrDesde);
        return solapa && (r.activo === true || ff === null || ff >= mrrDesde);
      });

      const empresasActivasSet = new Set<string>(activasMesRef.map((r: any) => String(r.empresa_id)));
      const empresasActivas = empresasActivasSet.size;

      // MRR = suma de precios de los planes activos del mes de referencia (una vez por empresa)
      // (si una empresa tiene múltiples registros solapados, contamos el más reciente por fecha_inicio)
      const ultimoPorEmpresa = new Map<string, any>();
      for (const r of activasMesRef) {
        const key = String(r.empresa_id);
        const prev = ultimoPorEmpresa.get(key);
        if (!prev || new Date(r.fecha_inicio) > new Date(prev.fecha_inicio)) {
          ultimoPorEmpresa.set(key, r);
        }
      }

      let mrrNeto = 0;
      for (const r of ultimoPorEmpresa.values()) {
        mrrNeto += Number(precioMap.get(r.plan_id) || 0);
      }

      // Aproximación: ingresos en el rango ≈ MRR del mes de referencia
      const ingresosNetoTotal = mrrNeto;

      const arpuNeto = empresasActivas > 0 ? ingresosNetoTotal / empresasActivas : 0;

      return NextResponse.json(
        {
          rango: { desde: desdeRaw, hasta: hastaRaw },
          mrr_neto: Number(mrrNeto.toFixed(2)),
          ingresos_neto_total: Number(ingresosNetoTotal.toFixed(2)),
          ingresos_con_iva: Number((ingresosNetoTotal * 1.21).toFixed(2)),
          arpu_neto: Number(arpuNeto.toFixed(2)),
          empresas_activas: empresasActivas,
          churn_empresas: 0,
          upgrades: 0,
          downgrades: 0,
        },
        { status: 200 }
      );
    }

    // 4) Respuesta desde ledger
    const ingresosNetoTotal = kpisDesdeLedger.ingresos_neto_total || 0;
    const empresasActivas = kpisDesdeLedger.empresas_activas || 0;
    const mrrNeto = kpisDesdeLedger.mrr_neto || 0;
    const arpuNeto = empresasActivas > 0 ? ingresosNetoTotal / empresasActivas : 0;

    return NextResponse.json(
      {
        rango: { desde: desdeRaw, hasta: hastaRaw },
        mrr_neto: Number(mrrNeto.toFixed(2)),
        ingresos_neto_total: Number(ingresosNetoTotal.toFixed(2)),
        ingresos_con_iva: Number((ingresosNetoTotal * 1.21).toFixed(2)),
        arpu_neto: Number(arpuNeto.toFixed(2)),
        empresas_activas: empresasActivas,
        churn_empresas: 0, // (cuando definamos bajas/upgrades reales, lo calculamos)
        upgrades: 0,
        downgrades: 0,
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
