export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function assertAdmin() {
  const server = supabaseServer();
  const { data: { user } } = await server.auth.getUser();
  if (!user?.id) return { ok: false as const, response: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };

  const { data: p1 } = await admin.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
  const { data: p2 } = p1?.role ? { data: null } : await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = p1?.role ?? p2?.role ?? null;
  if (role !== "super_admin" && role !== "super_admin_root") {
    return { ok: false as const, response: NextResponse.json({ error: "Acceso denegado." }, { status: 403 }) };
  }
  return { ok: true as const };
}

function asTime(value: unknown): number | null {
  if (!value) return null;
  const n = new Date(String(value)).getTime();
  return Number.isFinite(n) ? n : null;
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET() {
  try {
    const auth = await assertAdmin();
    if (!auth.ok) return auth.response;

    const now = new Date();
    const nowMs = now.getTime();
    const today = now.toISOString().slice(0, 10);
    const warningLimit = new Date(nowMs + 30 * 86400000).toISOString().slice(0, 10);
    const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

    const [empresasQ, suscripcionesQ, acuerdosQ, movimientosQ, planesQ] = await Promise.all([
      admin.from("empresas").select("id, razon_social, nombre_comercial, suspendida, created_at, eliminada_at"),
      admin.from("suscripciones").select("id, empresa_id, estado, inicio, fin, ciclo_inicio, ciclo_fin, plan_id, plan_actual_id, metadata, created_at"),
      admin.from("empresa_acuerdos_comerciales").select("id, empresa_id, activo, fecha_inicio, fecha_fin, precio_neto_fijo, tipo_acuerdo, plan_id"),
      admin.from("movimientos_financieros").select("empresa_id, fecha, monto_neto, total, estado, tipo, origen").gte("fecha", sixMonthsAgo.toISOString()),
      admin.from("planes").select("id, nombre, es_trial, es_desarrollo"),
    ]);

    for (const q of [empresasQ, suscripcionesQ, acuerdosQ, movimientosQ, planesQ]) {
      if (q.error) throw new Error(q.error.message);
    }

    const empresas = (empresasQ.data ?? []).filter((e: any) => !e.eliminada_at);
    const suscripciones = suscripcionesQ.data ?? [];
    const acuerdos = acuerdosQ.data ?? [];
    const movimientos = movimientosQ.data ?? [];
    const planes = new Map((planesQ.data ?? []).map((p: any) => [String(p.id), p]));

    const ciclosPorEmpresa = new Map<string, any>();
    for (const s of suscripciones as any[]) {
      if (String(s.estado).toLowerCase() !== "activa") continue;
      const inicio = asTime(s.ciclo_inicio ?? s.inicio);
      const fin = asTime(s.ciclo_fin ?? s.fin);
      if (inicio == null || fin == null || inicio > nowMs || fin <= nowMs) continue;
      const prev = ciclosPorEmpresa.get(String(s.empresa_id));
      const prevFin = prev ? asTime(prev.ciclo_fin ?? prev.fin) ?? 0 : 0;
      if (fin > prevFin) ciclosPorEmpresa.set(String(s.empresa_id), s);
    }

    const acuerdosVigentes = new Map<string, any>();
    let acuerdosPorVencer = 0;
    for (const a of acuerdos as any[]) {
      if (!a.activo || String(a.fecha_inicio) > today || (a.fecha_fin && String(a.fecha_fin) < today)) continue;
      acuerdosVigentes.set(String(a.empresa_id), a);
      if (a.fecha_fin && String(a.fecha_fin) <= warningLimit) acuerdosPorVencer += 1;
    }

    let empresasConAcceso = 0;
    let clientesPagos = 0;
    let trials = 0;
    let desarrollo = 0;
    let vencen7d = 0;

    for (const e of empresas as any[]) {
      if (e.suspendida) continue;
      const ciclo = ciclosPorEmpresa.get(String(e.id));
      if (!ciclo) continue;
      empresasConAcceso += 1;
      const plan = planes.get(String(ciclo.plan_actual_id ?? ciclo.plan_id));
      if (plan?.es_desarrollo) desarrollo += 1;
      else if (plan?.es_trial) trials += 1;
      else clientesPagos += 1;
      const fin = asTime(ciclo.ciclo_fin ?? ciclo.fin);
      if (fin != null && fin <= nowMs + 7 * 86400000) vencen7d += 1;
    }

    const monthly = new Map<string, number>();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      monthly.set(monthKey(d), 0);
    }
    let ingresosMes = 0;
    for (const m of movimientos as any[]) {
      const estado = String(m.estado ?? "").toLowerCase();
      if (!["paid", "approved", "accredited", "aprobado", "acreditado"].includes(estado)) continue;
      if (String(m.origen ?? "").toLowerCase().includes("simul")) continue;
      const fecha = new Date(m.fecha);
      if (Number.isNaN(fecha.getTime())) continue;
      const monto = Number(m.monto_neto ?? m.total ?? 0);
      const key = monthKey(fecha);
      if (monthly.has(key)) monthly.set(key, (monthly.get(key) ?? 0) + monto);
      if (fecha.getUTCFullYear() === now.getUTCFullYear() && fecha.getUTCMonth() === now.getUTCMonth()) ingresosMes += monto;
    }

    const suspendidas = empresas.filter((e: any) => !!e.suspendida).length;
    const sinCiclo = empresas.filter((e: any) => !e.suspendida && !ciclosPorEmpresa.has(String(e.id))).length;

    return NextResponse.json({
      generatedAt: now.toISOString(),
      kpis: {
        empresasTotal: empresas.length,
        empresasConAcceso,
        clientesPagos,
        trials,
        desarrollo,
        suspendidas,
        sinCiclo,
        vencen7d,
        acuerdosPorVencer,
        ingresosMes,
      },
      ingresosMensuales: Array.from(monthly.entries()).map(([mes, monto]) => ({ mes, monto })),
      distribucion: [
        { label: "Con acceso", value: empresasConAcceso },
        { label: "Suspendidas", value: suspendidas },
        { label: "Sin ciclo", value: sinCiclo },
      ],
      alertas: {
        acuerdosPorVencer,
        ciclosPorVencer: vencen7d,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error inesperado." }, { status: 500 });
  }
}
