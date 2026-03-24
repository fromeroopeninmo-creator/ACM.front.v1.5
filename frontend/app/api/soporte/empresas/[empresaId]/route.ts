// app/api/soporte/empresas/[empresaId]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";
import {
  resolveEmpresaBillingConfig,
  calcularMontosConIva,
  round2,
} from "#lib/billing/utils";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

type AcuerdoRawRow = {
  id: string;
  empresa_id: string;
  plan_id: string | null;
  activo: boolean;
  tipo_acuerdo: string | null;
  descuento_pct: number | null;
  precio_neto_fijo: number | null;
  max_asesores_override: number | null;
  precio_extra_por_asesor_override: number | null;
  modo_iva: string | null;
  iva_pct: number | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  motivo: string | null;
  observaciones: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

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

export async function GET(
  _req: Request,
  { params }: { params: { empresaId: string } }
) {
  try {
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;

    if (!userId) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const role = await resolveUserRole(userId);
    const allowed: Role[] = ["soporte", "super_admin", "super_admin_root"];
    if (!role || !allowed.includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    const empresaId = params?.empresaId;
    if (!empresaId) {
      return NextResponse.json({ error: "Falta empresaId." }, { status: 400 });
    }

    // 1) Traer detalle y KPIs desde la vista segura
    const { data: detalle, error: detErr } = await supabaseAdmin
      .from("v_empresas_detalle_soporte")
      .select(
        "empresa_id, empresa_nombre, cuit, plan_nombre, max_asesores, max_asesores_override, plan_activo, fecha_inicio, fecha_fin, asesores_totales, informes_totales"
      )
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (detErr) {
      return NextResponse.json({ error: detErr.message }, { status: 400 });
    }
    if (!detalle) {
      return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
    }

    // 2) Logo/color + datos adicionales de empresa
    const { data: empresaRow } = await supabaseAdmin
      .from("empresas")
      .select("logo_url, color, condicion_fiscal, telefono, direccion, localidad, provincia")
      .eq("id", empresaId)
      .maybeSingle();

    // 2.1) Plan operativo SOLO ACTIVO
    const { data: planActivoRow } = await supabaseAdmin
      .from("empresas_planes")
      .select("plan_id, max_asesores_override, activo, fecha_inicio, fecha_fin")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .maybeSingle();

    const planOperativo = planActivoRow ?? null;

    // 2.2) Plan base real SOLO si hay plan operativo activo
    let planBaseRow: any = null;
    if (planOperativo?.plan_id) {
      const { data: planDb } = await supabaseAdmin
        .from("planes")
        .select(
          "id, nombre, precio, duracion_dias, max_asesores, precio_extra_por_asesor, tipo_plan, incluye_valuador, incluye_tracker, es_trial"
        )
        .eq("id", planOperativo.plan_id)
        .maybeSingle();

      planBaseRow = planDb ?? null;
    }

    // 2.3) Acuerdo comercial activo/vigente
    const hoy = new Date().toISOString().slice(0, 10);

    const acuerdoQuery = await supabaseAdmin
      .from("empresa_acuerdos_comerciales")
      .select(
        [
          "id",
          "empresa_id",
          "plan_id",
          "activo",
          "tipo_acuerdo",
          "descuento_pct",
          "precio_neto_fijo",
          "max_asesores_override",
          "precio_extra_por_asesor_override",
          "modo_iva",
          "iva_pct",
          "fecha_inicio",
          "fecha_fin",
          "motivo",
          "observaciones",
          "created_by",
          "updated_by",
          "created_at",
          "updated_at",
        ].join(", ")
      )
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .lte("fecha_inicio", hoy)
      .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const acuerdoRaw = (acuerdoQuery.data ?? null) as AcuerdoRawRow | null;

    // 2.4) Billing resuelto SOLO si hay plan operativo activo
    let billingConfig: Awaited<
      ReturnType<typeof resolveEmpresaBillingConfig>
    > | null = null;

    if (planOperativo?.plan_id) {
      try {
        billingConfig = await resolveEmpresaBillingConfig({
          supabase: supabaseAdmin,
          empresaId,
          planId: planOperativo.plan_id,
          maxAsesoresOverride:
            planOperativo.max_asesores_override == null
              ? null
              : Number(planOperativo.max_asesores_override),
        });
      } catch (billingErr: any) {
        console.warn(
          "api/soporte/empresas/[empresaId]: no se pudo resolver billingConfig:",
          billingErr?.message || billingErr
        );
        billingConfig = null;
      }
    }

    // 2.5) Fallback comercial/manual SOLO si hay plan base activo
    if (!billingConfig && planBaseRow) {
      const precioBaseNeto = Number(planBaseRow.precio ?? 0);

      let precioNetoFinal = round2(precioBaseNeto);
      let pricingSource:
        | "plan"
        | "personalizado_formula"
        | "suscripcion_override"
        | "acuerdo_comercial_descuento"
        | "acuerdo_comercial_precio_fijo" = "plan";

      if (
        acuerdoRaw?.tipo_acuerdo === "descuento_pct" ||
        acuerdoRaw?.tipo_acuerdo === "descuento_con_cupo"
      ) {
        const pct = Number(acuerdoRaw.descuento_pct ?? 0);
        precioNetoFinal = round2(Math.max(precioBaseNeto - precioBaseNeto * (pct / 100), 0));
        pricingSource = "acuerdo_comercial_descuento";
      }

      if (
        acuerdoRaw?.tipo_acuerdo === "precio_fijo" ||
        acuerdoRaw?.tipo_acuerdo === "precio_fijo_con_cupo"
      ) {
        precioNetoFinal = round2(Number(acuerdoRaw.precio_neto_fijo ?? 0));
        pricingSource = "acuerdo_comercial_precio_fijo";
      }

      const modoIva = (acuerdoRaw?.modo_iva ?? "sumar_al_neto") as
        | "sumar_al_neto"
        | "incluido_en_precio"
        | "no_aplica";

      const ivaPct = Number(acuerdoRaw?.iva_pct ?? 21);

      const montos = calcularMontosConIva({
        precioNeto: precioNetoFinal,
        modoIva,
        ivaPct,
      });

      billingConfig = {
        empresa_id: empresaId,
        plan_id: String(planBaseRow.id),
        plan_nombre: (planBaseRow.nombre ?? null) as string | null,
        plan_duracion_dias:
          planBaseRow.duracion_dias == null ? null : Number(planBaseRow.duracion_dias),

        precio_base_neto: round2(precioBaseNeto),
        precio_neto_final: montos.precio_neto_final,

        modo_iva: modoIva,
        iva_pct: ivaPct,
        iva_importe: montos.iva_importe,
        precio_total_final: montos.precio_total_final,

        max_asesores_plan:
          planBaseRow.max_asesores == null ? null : Number(planBaseRow.max_asesores),
        max_asesores_final:
          acuerdoRaw?.max_asesores_override != null
            ? Number(acuerdoRaw.max_asesores_override)
            : planOperativo?.max_asesores_override != null
            ? Number(planOperativo.max_asesores_override)
            : planBaseRow.max_asesores == null
            ? null
            : Number(planBaseRow.max_asesores),

        precio_extra_por_asesor_plan: round2(Number(planBaseRow.precio_extra_por_asesor ?? 0)),
        precio_extra_por_asesor_final:
          acuerdoRaw?.precio_extra_por_asesor_override != null
            ? round2(Number(acuerdoRaw.precio_extra_por_asesor_override))
            : round2(Number(planBaseRow.precio_extra_por_asesor ?? 0)),

        agreement_applied: !!acuerdoRaw,
        agreement_id: acuerdoRaw?.id ?? null,
        agreement_tipo: (acuerdoRaw?.tipo_acuerdo ?? null) as any,
        agreement_plan_id: acuerdoRaw?.plan_id ?? null,
        agreement_fecha_inicio: acuerdoRaw?.fecha_inicio ?? null,
        agreement_fecha_fin: acuerdoRaw?.fecha_fin ?? null,

        suscripcion_override_applied: false,
        suscripcion_precio_neto_override: null,

        ciclo_inicio: planOperativo?.fecha_inicio ?? null,
        ciclo_fin: planOperativo?.fecha_fin ?? null,
        plan_es_trial:
          planBaseRow.es_trial == null ? null : Boolean(planBaseRow.es_trial),

        pricing_source: pricingSource,
      };
    }

    // 3) Últimas acciones de soporte (10)
    const { data: acciones, error: accErr } = await supabaseAdmin
      .from("acciones_soporte")
      .select("id, soporte_id, empresa_id, descripcion, timestamp")
      .eq("empresa_id", empresaId)
      .order("timestamp", { ascending: false })
      .limit(10);

    if (accErr) {
      return NextResponse.json({ error: accErr.message }, { status: 400 });
    }

    // 4) Listado de asesores
    const { data: asesores, error: asesErr } = await supabaseAdmin
      .from("asesores")
      .select("id, nombre, apellido, email, activo, fecha_creacion")
      .eq("empresa_id", empresaId)
      .order("fecha_creacion", { ascending: false });

    if (asesErr) {
      return NextResponse.json({ error: asesErr.message }, { status: 400 });
    }

    // 5) Informes recientes
    const { data: informes, error: infErr } = await supabaseAdmin
      .from("informes")
      .select("id, titulo, estado, fecha_creacion")
      .eq("empresa_id", empresaId)
      .order("fecha_creacion", { ascending: false })
      .limit(20);

    if (infErr) {
      return NextResponse.json({ error: infErr.message }, { status: 400 });
    }

    // 6) Respuesta
    const resp = {
      empresa: {
        id: detalle.empresa_id,
        nombre: detalle.empresa_nombre,
        cuit: detalle.cuit,
        logoUrl: empresaRow?.logo_url ?? null,
        color: empresaRow?.color ?? null,
        condicion_fiscal: empresaRow?.condicion_fiscal ?? null,
        telefono: empresaRow?.telefono ?? null,
        direccion: empresaRow?.direccion ?? null,
        localidad: empresaRow?.localidad ?? null,
        provincia: empresaRow?.provincia ?? null,
      },
      plan: planOperativo && planBaseRow
        ? {
            id: planBaseRow?.id ?? null,
            nombre: planBaseRow?.nombre ?? null,
            maxAsesores:
              planBaseRow?.max_asesores == null ? null : Number(planBaseRow.max_asesores),
            override:
              planOperativo?.max_asesores_override == null
                ? null
                : Number(planOperativo.max_asesores_override),
            activo: true,
            fechaInicio: planOperativo?.fecha_inicio ?? null,
            fechaFin: planOperativo?.fecha_fin ?? null,
            duracionDias: planBaseRow?.duracion_dias ?? null,
            precio: planBaseRow?.precio ?? null,

            precioBaseNeto: billingConfig?.precio_base_neto ?? (planBaseRow?.precio ?? null),
            precioNetoFinal: billingConfig?.precio_neto_final ?? (planBaseRow?.precio ?? null),
            precioTotalFinal: billingConfig?.precio_total_final ?? null,
            ivaModo: billingConfig?.modo_iva ?? "sumar_al_neto",
            ivaPct: billingConfig?.iva_pct ?? 21,
            ivaImporte: billingConfig?.iva_importe ?? null,
            pricingSource: billingConfig?.pricing_source ?? "plan",
            precioExtraPorAsesorPlan:
              billingConfig?.precio_extra_por_asesor_plan ??
              (planBaseRow?.precio_extra_por_asesor ?? null),
            precioExtraPorAsesorFinal:
              billingConfig?.precio_extra_por_asesor_final ??
              (planBaseRow?.precio_extra_por_asesor ?? null),
            maxAsesoresFinal:
              billingConfig?.max_asesores_final ??
              (planOperativo?.max_asesores_override ?? null) ??
              (planBaseRow?.max_asesores ?? null),
          }
        : null,
      acuerdoComercial:
        billingConfig?.agreement_applied || acuerdoRaw
          ? {
              activo: true,
              id: billingConfig?.agreement_id ?? acuerdoRaw?.id ?? null,
              tipo: billingConfig?.agreement_tipo ?? acuerdoRaw?.tipo_acuerdo ?? null,
              precioBaseNeto:
                billingConfig?.precio_base_neto ?? (planBaseRow?.precio ?? null),
              precioNetoFinal:
                billingConfig?.precio_neto_final ??
                (acuerdoRaw?.precio_neto_fijo ?? planBaseRow?.precio ?? null),
              precioTotalFinal: billingConfig?.precio_total_final ?? null,
              modoIva: billingConfig?.modo_iva ?? acuerdoRaw?.modo_iva ?? "sumar_al_neto",
              ivaPct: billingConfig?.iva_pct ?? Number(acuerdoRaw?.iva_pct ?? 21),
              ivaImporte: billingConfig?.iva_importe ?? null,
              maxAsesoresPlan:
                billingConfig?.max_asesores_plan ??
                (planBaseRow?.max_asesores == null ? null : Number(planBaseRow.max_asesores)),
              maxAsesoresFinal:
                billingConfig?.max_asesores_final ??
                (acuerdoRaw?.max_asesores_override ?? null),
              precioExtraPorAsesorPlan:
                billingConfig?.precio_extra_por_asesor_plan ??
                (planBaseRow?.precio_extra_por_asesor == null
                  ? null
                  : Number(planBaseRow.precio_extra_por_asesor)),
              precioExtraPorAsesorFinal:
                billingConfig?.precio_extra_por_asesor_final ??
                (acuerdoRaw?.precio_extra_por_asesor_override ?? null),
              pricingSource: billingConfig?.pricing_source ?? "plan",
              fechaInicio: acuerdoRaw?.fecha_inicio ?? null,
              fechaFin: acuerdoRaw?.fecha_fin ?? null,
              motivo: acuerdoRaw?.motivo ?? null,
              observaciones: acuerdoRaw?.observaciones ?? null,
            }
          : null,
      kpis: {
        asesoresTotales: detalle.asesores_totales ?? 0,
        informesTotales: detalle.informes_totales ?? 0,
      },
      ultimasAccionesSoporte:
        acciones?.map((a) => ({
          id: a.id,
          soporteId: a.soporte_id,
          empresaId: a.empresa_id,
          descripcion: a.descripcion,
          timestamp: a.timestamp,
        })) ?? [],
      asesores:
        (asesores || []).map((a) => ({
          id: a.id,
          nombre: a.nombre,
          apellido: a.apellido,
          email: a.email,
          activo: a.activo,
          fecha_creacion: a.fecha_creacion,
        })) ?? [],
      informes:
        (informes || []).map((i) => ({
          id: i.id,
          titulo: i.titulo,
          estado: i.estado,
          fecha_creacion: i.fecha_creacion,
        })) ?? [],
    };

    return NextResponse.json(resp, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
