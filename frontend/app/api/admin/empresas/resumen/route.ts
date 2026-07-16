export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function assertAdmin() {
  const server = supabaseServer();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user?.id) return false;
  const { data: p1 } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: p2 } = p1?.role
    ? { data: null }
    : await admin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
  const role = p1?.role ?? p2?.role ?? null;
  return role === "super_admin" || role === "super_admin_root";
}

function time(v: unknown) {
  const n = v ? new Date(String(v)).getTime() : NaN;
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  try {
    if (!(await assertAdmin()))
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const estado = url.searchParams.get("estado") ?? "todos";
    const creadaDesde = url.searchParams.get("creada_desde");
    const creadaHasta = url.searchParams.get("creada_hasta");
    const cicloHasta = url.searchParams.get("ciclo_hasta");
    const acuerdoHasta = url.searchParams.get("acuerdo_hasta");
    const acuerdoFiltro = url.searchParams.get("acuerdo") ?? "todos";
    const ordenar = url.searchParams.get("ordenar") ?? "ultimas";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = [10, 20, 50].includes(
      Number(url.searchParams.get("pageSize")),
    )
      ? Number(url.searchParams.get("pageSize"))
      : 20;

    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const [empQ, subQ, epQ, acuQ, planQ] = await Promise.all([
      admin
        .from("empresas")
        .select(
          "id, razon_social, nombre_comercial, cuit, provincia, localidad, suspendida, suspendida_at, suspension_motivo, suspension_manual_admin, habilitacion_manual_hasta, habilitacion_manual_motivo, created_at, eliminada_at",
        ),
      admin
        .from("suscripciones")
        .select(
          "id, empresa_id, estado, inicio, fin, ciclo_inicio, ciclo_fin, plan_id, plan_actual_id, metadata",
        ),
      admin
        .from("empresas_planes")
        .select(
          "id, empresa_id, plan_id, fecha_inicio, fecha_fin, activo, max_asesores_override, created_at",
        ),
      admin
        .from("empresa_acuerdos_comerciales")
        .select(
          "id, empresa_id, activo, tipo_acuerdo, plan_id, precio_neto_fijo, max_asesores_override, fecha_inicio, fecha_fin",
        ),
      admin
        .from("planes")
        .select(
          "id, nombre, nombre_comercial, duracion_dias, es_trial, es_desarrollo",
        ),
    ]);
    for (const result of [empQ, subQ, epQ, acuQ, planQ])
      if (result.error) throw new Error(result.error.message);

    const plans = new Map(
      (planQ.data ?? []).map((p: any) => [String(p.id), p]),
    );
    const cycleMap = new Map<string, any>();
    for (const s of subQ.data ?? []) {
      if (String(s.estado).toLowerCase() !== "activa") continue;
      const start = time(s.ciclo_inicio ?? s.inicio);
      const end = time(s.ciclo_fin ?? s.fin);
      if (start == null || end == null || start > now || end <= now) continue;
      const prev = cycleMap.get(String(s.empresa_id));
      if (!prev || end > (time(prev.ciclo_fin ?? prev.fin) ?? 0))
        cycleMap.set(String(s.empresa_id), s);
    }
    const operationalCoverageMap = new Map<string, any>();
    for (const ep of epQ.data ?? []) {
      if (ep.activo !== true) continue;
      const plan = plans.get(String(ep.plan_id)) ?? null;
      if (!plan || (plan.es_trial !== true && plan.es_desarrollo !== true))
        continue;

      const start = time(
        ep.fecha_inicio ? `${ep.fecha_inicio}T00:00:00Z` : null,
      );
      const end = time(ep.fecha_fin ? `${ep.fecha_fin}T23:59:59Z` : null);
      const vigente =
        (start == null || start <= now) && (end == null || end > now);
      if (!vigente) continue;

      const prev = operationalCoverageMap.get(String(ep.empresa_id));
      const prevEnd = prev?.fecha_fin
        ? (time(`${prev.fecha_fin}T23:59:59Z`) ?? 0)
        : Number.MAX_SAFE_INTEGER;
      const nextEnd = end ?? Number.MAX_SAFE_INTEGER;
      if (!prev || nextEnd > prevEnd)
        operationalCoverageMap.set(String(ep.empresa_id), ep);
    }

    const agreementMap = new Map<string, any>();
    for (const a of acuQ.data ?? []) {
      if (
        !a.activo ||
        String(a.fecha_inicio) > today ||
        (a.fecha_fin && String(a.fecha_fin) < today)
      )
        continue;
      agreementMap.set(String(a.empresa_id), a);
    }

    let items = (empQ.data ?? [])
      .filter((e: any) => !e.eliminada_at)
      .map((e: any) => {
        const cicloPagado = cycleMap.get(String(e.id)) ?? null;
        const coberturaEspecial =
          operationalCoverageMap.get(String(e.id)) ?? null;
        const acuerdo = agreementMap.get(String(e.id)) ?? null;

        const cobertura = cicloPagado ?? coberturaEspecial;
        const planId = cicloPagado
          ? String(cicloPagado.plan_actual_id ?? cicloPagado.plan_id)
          : coberturaEspecial
            ? String(coberturaEspecial.plan_id)
            : null;
        const plan = planId ? (plans.get(planId) ?? null) : null;

        const cicloInicio = cicloPagado
          ? (cicloPagado.ciclo_inicio ?? cicloPagado.inicio ?? null)
          : (coberturaEspecial?.fecha_inicio ?? null);
        const cicloFin = cicloPagado
          ? (cicloPagado.ciclo_fin ?? cicloPagado.fin ?? null)
          : (coberturaEspecial?.fecha_fin ?? null);

        const motivoPersistido = String(e.suspension_motivo ?? "").trim();
        const motivoNormalizado = motivoPersistido.toLowerCase();
        const suspensionAutomaticaPersistida = [
          "falta de pago",
          "sin ciclo vigente",
          "trial vencido",
          "plan vencido",
          "sin plan activo",
          "pendiente de pago",
        ].some((fragmento) => motivoNormalizado.includes(fragmento));
        const habilitacionHasta = time(e.habilitacion_manual_hasta);
        const habilitacionManual =
          habilitacionHasta != null && habilitacionHasta > now;
        const suspensionManual =
          e.suspendida === true &&
          (e.suspension_manual_admin === true || !suspensionAutomaticaPersistida);
        const coberturaVigente = !!cobertura;
        const acceso =
          !suspensionManual && (coberturaVigente || habilitacionManual);

        let suspensionMotivo: string | null = null;
        if (!acceso) {
          if (suspensionManual)
            suspensionMotivo = motivoPersistido || "Suspensión administrativa.";
          else if (
            plan?.es_trial === true ||
            motivoNormalizado.includes("trial")
          )
            suspensionMotivo = "Trial vencido.";
          else if (
            planId ||
            motivoNormalizado.includes("pago") ||
            motivoNormalizado.includes("ciclo")
          )
            suspensionMotivo = "Falta de pago: no existe un ciclo vigente.";
          else
            suspensionMotivo = motivoPersistido || "Sin plan o ciclo vigente.";
        }

        return {
          id: e.id,
          nombre: e.nombre_comercial || e.razon_social || "Empresa sin nombre",
          razonSocial: e.razon_social,
          cuit: e.cuit,
          ubicacion:
            [e.localidad, e.provincia].filter(Boolean).join(", ") || null,
          creadaEn: e.created_at,
          suspendida: !acceso,
          suspensionMotivo,
          acceso,
          habilitacionManual,
          habilitacionManualHasta: habilitacionManual
            ? e.habilitacion_manual_hasta
            : null,
          habilitacionManualMotivo: habilitacionManual
            ? e.habilitacion_manual_motivo
            : null,
          estado: acceso ? "activa" : "suspendida",
          plan:
            plan?.es_trial === true
              ? "Trial"
              : (plan?.nombre_comercial ?? plan?.nombre ?? null),
          esTrial: plan?.es_trial === true,
          esDesarrollo: plan?.es_desarrollo === true,
          cicloId: cobertura?.id ?? null,
          cicloInicio,
          cicloFin,
          diasParaVencer: cicloFin
            ? Math.ceil(((time(cicloFin) ?? now) - now) / 86400000)
            : null,
          acuerdo: acuerdo
            ? {
                id: acuerdo.id,
                tipo: acuerdo.tipo_acuerdo,
                fechaFin: acuerdo.fecha_fin,
                precioNeto: acuerdo.precio_neto_fijo,
                maxAsesores: acuerdo.max_asesores_override,
                diasParaVencer: acuerdo.fecha_fin
                  ? Math.ceil(
                      ((time(`${acuerdo.fecha_fin}T23:59:59Z`) ?? now) - now) /
                        86400000,
                    )
                  : null,
              }
            : null,
        };
      });

    if (q)
      items = items.filter((i: any) =>
        [i.nombre, i.razonSocial, i.cuit, i.ubicacion].some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(q),
        ),
      );
    if (estado !== "todos")
      items = items.filter((i: any) => i.estado === estado);
    if (creadaDesde)
      items = items.filter(
        (i: any) => String(i.creadaEn ?? "").slice(0, 10) >= creadaDesde,
      );
    if (creadaHasta)
      items = items.filter(
        (i: any) => String(i.creadaEn ?? "").slice(0, 10) <= creadaHasta,
      );
    if (cicloHasta)
      items = items.filter(
        (i: any) => i.cicloFin && String(i.cicloFin).slice(0, 10) <= cicloHasta,
      );
    if (acuerdoHasta)
      items = items.filter(
        (i: any) =>
          i.acuerdo?.fechaFin && String(i.acuerdo.fechaFin) <= acuerdoHasta,
      );
    if (acuerdoFiltro === "con_acuerdo")
      items = items.filter((i: any) => !!i.acuerdo);
    if (acuerdoFiltro === "sin_acuerdo")
      items = items.filter((i: any) => !i.acuerdo);

    items.sort((a: any, b: any) => {
      if (ordenar === "ultimas")
        return (time(b.creadaEn) ?? 0) - (time(a.creadaEn) ?? 0);
      if (ordenar === "ciclo") {
        const aFin = time(a.cicloFin);
        const bFin = time(b.cicloFin);
        if (aFin == null && bFin == null)
          return String(a.nombre).localeCompare(String(b.nombre), "es");
        if (aFin == null) return 1;
        if (bFin == null) return -1;
        return (
          aFin - bFin || String(a.nombre).localeCompare(String(b.nombre), "es")
        );
      }
      if (ordenar === "antiguas")
        return (time(a.creadaEn) ?? 0) - (time(b.creadaEn) ?? 0);
      if (ordenar === "nombre")
        return String(a.nombre).localeCompare(String(b.nombre), "es");
      const priority = (x: any) =>
        x.estado === "suspendida"
          ? 0
          : x.acuerdo?.diasParaVencer != null && x.acuerdo.diasParaVencer <= 30
            ? 1
            : x.diasParaVencer != null && x.diasParaVencer <= 7
              ? 2
              : 3;
      return (
        priority(a) - priority(b) ||
        String(a.nombre).localeCompare(String(b.nombre), "es")
      );
    });

    const total = items.length;
    const start = (page - 1) * pageSize;
    return NextResponse.json({
      page,
      pageSize,
      total,
      items: items.slice(start, start + pageSize),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Error inesperado." },
      { status: 500 },
    );
  }
}
