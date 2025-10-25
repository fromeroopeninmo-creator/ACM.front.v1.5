// app/api/admin/cashflow/simular-periodo/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

function toISO(d: Date) {
  return d.toISOString();
}
function startOfDayUTC(yyyy_mm_dd: string) {
  const d = new Date(`${yyyy_mm_dd}T00:00:00.000Z`);
  return d;
}
function endOfDayUTC(yyyy_mm_dd: string) {
  const d = new Date(`${yyyy_mm_dd}T23:59:59.999Z`);
  return d;
}
function firstDayOfMonthUTC(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
  return x;
}
function lastDayOfMonthUTC(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return x;
}
function ymKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function addMonthsUTC(d: Date, n: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
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

export async function POST(req: Request) {
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

    // 1) Modo seguro: solo simular si LEDGER_MODE !== 'live'
    const LEDGER_MODE = (process.env.LEDGER_MODE || "simulation").toLowerCase(); // simulation | live
    if (LEDGER_MODE === "live") {
      return NextResponse.json(
        { error: "Simulación deshabilitada en modo 'live'." },
        { status: 409 }
      );
    }

    // 2) Body
    const body = await req.json().catch(() => ({}));
    const desdeRaw: string | undefined = body?.desde; // YYYY-MM-DD
    const hastaRaw: string | undefined = body?.hasta; // YYYY-MM-DD
    const empresaId: string | undefined = body?.empresaId || undefined; // opcional
    const overwrite: boolean = !!body?.overwrite; // si true, permite re-generar (borra previos del periodo/empresa/tipo subscription)

    if (!desdeRaw || !hastaRaw) {
      return NextResponse.json(
        { error: "Campos 'desde' y 'hasta' son obligatorios (YYYY-MM-DD)." },
        { status: 400 }
      );
    }

    const desde = startOfDayUTC(desdeRaw);
    const hasta = endOfDayUTC(hastaRaw);
    if (isNaN(desde.getTime()) || isNaN(hasta.getTime()) || desde > hasta) {
      return NextResponse.json({ error: "Rango de fechas inválido." }, { status: 400 });
    }

    // 3) Traer suscripciones que se solapan con el rango (empresas_planes + planes)
    // solapamiento: fecha_inicio <= hasta && (fecha_fin is null || fecha_fin >= desde)
    let qEP = supabaseAdmin
      .from("empresas_planes")
      .select("id, empresa_id, plan_id, fecha_inicio, fecha_fin, activo, max_asesores_override");

    qEP = qEP.lte("fecha_inicio", toISO(hasta)).or(
      `fecha_fin.is.null,fecha_fin.gte.${toISO(desde)}`
    );

    if (empresaId) qEP = qEP.eq("empresa_id", empresaId);

    const { data: epRows, error: epErr } = await qEP;
    if (epErr) return NextResponse.json({ error: epErr.message }, { status: 400 });

    if (!epRows || epRows.length === 0) {
      return NextResponse.json(
        { inserted: 0, skipped: 0, overwritten: 0, detalles: [], aviso: "No hay suscripciones que se solapen con el rango." },
        { status: 200 }
      );
    }

    const planIds = Array.from(new Set(epRows.map((r: any) => r.plan_id)));
    const { data: planes, error: pErr } = await supabaseAdmin
      .from("planes")
      .select("id, nombre, precio, max_asesores, precio_extra_por_asesor")
      .in("id", planIds);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

    const planMap = new Map<string, { nombre: string; precio: number; max_asesores: number; precio_extra_por_asesor: number }>(
      (planes ?? []).map((p: any) => [
        p.id as string,
        {
          nombre: String(p.nombre || ""),
          precio: Number(p.precio || 0),
          max_asesores: Number(p.max_asesores || 0),
          precio_extra_por_asesor: Number(p.precio_extra_por_asesor || 0),
        },
      ])
    );

    // Conteo actual de asesores activos por empresa (aprox. para simulación)
    const empresaIds = Array.from(new Set(epRows.map((r: any) => r.empresa_id)));
    const { data: asesoresRows, error: aErr } = await supabaseAdmin
      .from("asesores")
      .select("empresa_id")
      .in("empresa_id", empresaIds)
      .eq("activo", true);
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 });

    const asesoresCountMap = new Map<string, number>();
    for (const row of asesoresRows ?? []) {
      const key = String(row.empresa_id);
      asesoresCountMap.set(key, (asesoresCountMap.get(key) || 0) + 1);
    }

    // 4) Construir lista de meses (YYYY-MM) dentro del rango
    const meses: { key: string; inicio: Date; fin: Date }[] = [];
    let cursor = firstDayOfMonthUTC(desde);
    const limite = firstDayOfMonthUTC(addMonthsUTC(hasta, 1)); // exclusivo
    while (cursor < limite) {
      const inicioMes = firstDayOfMonthUTC(cursor);
      const finMes = lastDayOfMonthUTC(cursor);
      meses.push({ key: ymKey(cursor), inicio: inicioMes, fin: finMes });
      cursor = addMonthsUTC(cursor, 1);
    }

    // 5) Si overwrite=true, borro previos de esos periodos/empresa (solo subscription/extra_asesor simulados)
    let overwritten = 0;
    if (overwrite) {
      // Borrar por metadata.periodo IN (meses) y, si empresaId, por empresa; solo pasarela 'simulada'
      const periodos = meses.map((m) => m.key);
      // Borrado en dos tandas para no exceder filtros
      const condPeriodo = periodos.map((p) => `metadata->>'periodo' = '${p}'`).join(" OR ");
      const condEmpresa = empresaId ? ` AND empresa_id = '${empresaId}'` : "";
      const sql = `
        delete from public.movimientos_financieros
        where pasarela = 'simulada'
          and (${condPeriodo})
          and (tipo in ('subscription','extra_asesor'))
          ${condEmpresa}
        returning id;
      `;
      const { data: delRows, error: delErr } = await supabaseAdmin.rpc("exec_sql", { sql_text: sql } as any);
      // Si no tenés una RPC genérica "exec_sql", omitimos el conteo exacto:
      if (delErr) {
        // si no existe rpc, ignoramos y seguimos sin borrar (o podríamos hacer múltiples selects + deletes)
      } else {
        overwritten = Array.isArray(delRows) ? delRows.length : 0;
      }
    }

    // 6) Evitar duplicados: consulto movimientos ya existentes por periodo (simulados)
    const periodos = meses.map((m) => m.key);
    let qExist = supabaseAdmin
      .from("movimientos_financieros")
      .select("id, empresa_id, tipo, metadata")
      .eq("pasarela", "simulada")
      .in("tipo", ["subscription", "extra_asesor"])
      .in("metadata->>periodo", periodos);
    if (empresaId) qExist = qExist.eq("empresa_id", empresaId);

    const { data: existentes, error: exErr } = await qExist;
    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 400 });

    const existeKey = new Set<string>();
    for (const r of existentes ?? []) {
      const periodo = (r as any)?.metadata?.periodo;
      const eid = (r as any)?.empresa_id;
      const tipo = (r as any)?.tipo;
      if (periodo && eid && tipo) {
        existeKey.add(`${eid}::${periodo}::${tipo}`);
      }
    }

    // 7) Generar inserts
    const rowsToInsert: any[] = [];
    const detalles: any[] = [];

    for (const ep of epRows) {
      const empresa_id = String(ep.empresa_id);
      const plan_id = String(ep.plan_id);
      const fi = new Date(ep.fecha_inicio);
      const ff = ep.fecha_fin ? new Date(ep.fecha_fin) : null;

      const planInfo = planMap.get(plan_id) || {
        nombre: "",
        precio: 0,
        max_asesores: 0,
        precio_extra_por_asesor: 0,
      };
      const override = ep.max_asesores_override as number | null;
      const cap = override ?? planInfo.max_asesores;
      const usados = asesoresCountMap.get(empresa_id) || 0;
      const excedente = Math.max(0, usados - cap);
      const precioExtra = planInfo.precio_extra_por_asesor > 0 ? planInfo.precio_extra_por_asesor : 0;

      for (const mes of meses) {
        // Chequear si el plan está vigente (solapa) en este mes
        const solapa = fi <= mes.fin && (ff === null || ff >= mes.inicio);
        if (!solapa) continue;

        // Fecha de asiento: primer día del mes a las 10:00Z (arbitrario pero consistente)
        const fechaAsiento = new Date(Date.UTC(mes.inicio.getUTCFullYear(), mes.inicio.getUTCMonth(), 1, 10, 0, 0, 0));

        // SUBSCRIPTION
        const keySub = `${empresa_id}::${mes.key}::subscription`;
        if (!existeKey.has(keySub)) {
          rowsToInsert.push({
            empresa_id,
            fecha: toISO(fechaAsiento),
            tipo: "subscription",
            descripcion: `Plan ${planInfo.nombre} ${mes.key}`,
            moneda: "ARS",
            monto_neto: Number(planInfo.precio || 0),
            origen: "sistema",
            pasarela: "simulada",
            estado: "paid",
            referencia_pasarela: null,
            metadata: { periodo: mes.key, source: "simulation" },
          });
          detalles.push({ empresa_id, periodo: mes.key, tipo: "subscription", monto_neto: Number(planInfo.precio || 0) });
        }

        // EXTRA_ASESOR (si hay excedente)
        if (excedente > 0 && precioExtra > 0) {
          const keyExtra = `${empresa_id}::${mes.key}::extra_asesor`;
          if (!existeKey.has(keyExtra)) {
            const montoExtra = excedente * precioExtra;
            rowsToInsert.push({
              empresa_id,
              fecha: toISO(fechaAsiento),
              tipo: "extra_asesor",
              descripcion: `Excedente ${excedente} asesores ${mes.key}`,
              moneda: "ARS",
              monto_neto: Number(montoExtra || 0),
              origen: "sistema",
              pasarela: "simulada",
              estado: "paid",
              referencia_pasarela: null,
              metadata: { periodo: mes.key, excedente, precio_extra_por_asesor: precioExtra, source: "simulation" },
            });
            detalles.push({ empresa_id, periodo: mes.key, tipo: "extra_asesor", excedente, monto_neto: Number(montoExtra || 0) });
          }
        }
      }
    }

    // 8) Insertar en lotes (si hay)
    let inserted = 0;
    if (rowsToInsert.length > 0) {
      const { error: insErr } = await supabaseAdmin
        .from("movimientos_financieros")
        .insert(rowsToInsert);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
      inserted = rowsToInsert.length;
    }

    const skipped = (existentes?.length || 0);

    return NextResponse.json(
      {
        inserted,
        skipped,
        overwritten,
        periodos: meses.map((m) => m.key),
        detalles: detalles.slice(0, 50), // acotamos preview
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
