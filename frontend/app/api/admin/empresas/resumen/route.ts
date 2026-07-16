export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function assertAdmin() {
  const server = supabaseServer();
  const { data: { user } } = await server.auth.getUser();
  if (!user?.id) return false;
  const { data: p1 } = await admin.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
  const { data: p2 } = p1?.role ? { data: null } : await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = p1?.role ?? p2?.role ?? null;
  return role === "super_admin" || role === "super_admin_root";
}

function time(v: unknown) {
  const n = v ? new Date(String(v)).getTime() : NaN;
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  try {
    if (!(await assertAdmin())) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const estado = url.searchParams.get("estado") ?? "todos";
    const creadaDesde = url.searchParams.get("creada_desde");
    const creadaHasta = url.searchParams.get("creada_hasta");
    const cicloHasta = url.searchParams.get("ciclo_hasta");
    const acuerdoHasta = url.searchParams.get("acuerdo_hasta");
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = [10, 20, 50].includes(Number(url.searchParams.get("pageSize"))) ? Number(url.searchParams.get("pageSize")) : 20;

    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const [empQ, subQ, acuQ, planQ] = await Promise.all([
      admin.from("empresas").select("id, razon_social, nombre_comercial, cuit, provincia, localidad, suspendida, suspendida_at, suspension_motivo, created_at, eliminada_at"),
      admin.from("suscripciones").select("id, empresa_id, estado, inicio, fin, ciclo_inicio, ciclo_fin, plan_id, plan_actual_id, metadata"),
      admin.from("empresa_acuerdos_comerciales").select("id, empresa_id, activo, tipo_acuerdo, plan_id, precio_neto_fijo, max_asesores_override, fecha_inicio, fecha_fin"),
      admin.from("planes").select("id, nombre, es_trial, es_desarrollo"),
    ]);
    for (const result of [empQ, subQ, acuQ, planQ]) if (result.error) throw new Error(result.error.message);

    const plans = new Map((planQ.data ?? []).map((p: any) => [String(p.id), p]));
    const cycleMap = new Map<string, any>();
    for (const s of subQ.data ?? []) {
      if (String(s.estado).toLowerCase() !== "activa") continue;
      const start = time(s.ciclo_inicio ?? s.inicio);
      const end = time(s.ciclo_fin ?? s.fin);
      if (start == null || end == null || start > now || end <= now) continue;
      const prev = cycleMap.get(String(s.empresa_id));
      if (!prev || end > (time(prev.ciclo_fin ?? prev.fin) ?? 0)) cycleMap.set(String(s.empresa_id), s);
    }
    const agreementMap = new Map<string, any>();
    for (const a of acuQ.data ?? []) {
      if (!a.activo || String(a.fecha_inicio) > today || (a.fecha_fin && String(a.fecha_fin) < today)) continue;
      agreementMap.set(String(a.empresa_id), a);
    }

    let items = (empQ.data ?? []).filter((e: any) => !e.eliminada_at).map((e: any) => {
      const ciclo = cycleMap.get(String(e.id)) ?? null;
      const acuerdo = agreementMap.get(String(e.id)) ?? null;
      const plan = ciclo ? plans.get(String(ciclo.plan_actual_id ?? ciclo.plan_id)) ?? null : null;
      const cicloFin = ciclo?.ciclo_fin ?? ciclo?.fin ?? null;
      const acceso = !e.suspendida && !!ciclo;
      return {
        id: e.id,
        nombre: e.nombre_comercial || e.razon_social || "Empresa sin nombre",
        razonSocial: e.razon_social,
        cuit: e.cuit,
        ubicacion: [e.localidad, e.provincia].filter(Boolean).join(", ") || null,
        creadaEn: e.created_at,
        suspendida: !!e.suspendida,
        suspensionMotivo: e.suspension_motivo,
        acceso,
        estado: e.suspendida ? "suspendida" : ciclo ? "activa" : "sin_ciclo",
        plan: plan?.nombre ?? null,
        cicloId: ciclo?.id ?? null,
        cicloFin,
        diasParaVencer: cicloFin ? Math.ceil(((time(cicloFin) ?? now) - now) / 86400000) : null,
        acuerdo: acuerdo ? {
          id: acuerdo.id,
          tipo: acuerdo.tipo_acuerdo,
          fechaFin: acuerdo.fecha_fin,
          precioNeto: acuerdo.precio_neto_fijo,
          maxAsesores: acuerdo.max_asesores_override,
          diasParaVencer: acuerdo.fecha_fin ? Math.ceil(((time(`${acuerdo.fecha_fin}T23:59:59Z`) ?? now) - now) / 86400000) : null,
        } : null,
      };
    });

    if (q) items = items.filter((i: any) => [i.nombre, i.razonSocial, i.cuit, i.ubicacion].some((v) => String(v ?? "").toLowerCase().includes(q)));
    if (estado !== "todos") items = items.filter((i: any) => i.estado === estado);
    if (creadaDesde) items = items.filter((i: any) => String(i.creadaEn ?? "").slice(0, 10) >= creadaDesde);
    if (creadaHasta) items = items.filter((i: any) => String(i.creadaEn ?? "").slice(0, 10) <= creadaHasta);
    if (cicloHasta) items = items.filter((i: any) => i.cicloFin && String(i.cicloFin).slice(0, 10) <= cicloHasta);
    if (acuerdoHasta) items = items.filter((i: any) => i.acuerdo?.fechaFin && String(i.acuerdo.fechaFin) <= acuerdoHasta);

    items.sort((a: any, b: any) => {
      const priority = (x: any) => x.estado === "suspendida" ? 0 : x.acuerdo?.diasParaVencer != null && x.acuerdo.diasParaVencer <= 30 ? 1 : x.diasParaVencer != null && x.diasParaVencer <= 7 ? 2 : 3;
      return priority(a) - priority(b) || String(a.nombre).localeCompare(String(b.nombre), "es");
    });

    const total = items.length;
    const start = (page - 1) * pageSize;
    return NextResponse.json({ page, pageSize, total, items: items.slice(start, start + pageSize) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error inesperado." }, { status: 500 });
  }
}
