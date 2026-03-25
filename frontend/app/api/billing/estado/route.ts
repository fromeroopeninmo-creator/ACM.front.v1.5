export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";
import {
  assertAuthAndGetContext,
  resolveEmpresaBillingConfig,
} from "#lib/billing/utils";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role =
  | "empresa"
  | "asesor"
  | "soporte"
  | "super_admin"
  | "super_admin_root"
  | string;

function toNum(x: any): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === "number") return x;
  if (typeof x === "string") return parseFloat(x) || 0;
  return Number(x) || 0;
}

function todayDateOnlyUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  try {
    const server = supabaseServer();
    const actor = await assertAuthAndGetContext(server);
    const role = (actor.role ?? "") as Role;

    const url = new URL(req.url);
    const empresaIdParam = url.searchParams.get("empresaId") || undefined;

    const isAdminLike =
      role === "super_admin_root" ||
      role === "super_admin" ||
      role === "soporte";

    let empresaId: string | null = null;

    if (isAdminLike && empresaIdParam) {
      empresaId = empresaIdParam;
    }

    if (!isAdminLike) {
      const a: any = actor;
      const actorUserId = a.userId ?? a.id ?? a.sub ?? null;

      if (!empresaId && actorUserId) {
        const { data: profileRowByUserId, error: profileErrByUserId } =
          await supabaseAdmin
            .from("profiles")
            .select("empresa_id")
            .eq("user_id", actorUserId)
            .maybeSingle();

        if (!profileErrByUserId && profileRowByUserId?.empresa_id) {
          empresaId = profileRowByUserId.empresa_id;
        }
      }

      if (!empresaId && actorUserId) {
        const { data: profileRow, error: profileErr } = await supabaseAdmin
          .from("profiles")
          .select("empresa_id")
          .eq("id", actorUserId)
          .maybeSingle();

        if (!profileErr && profileRow?.empresa_id) {
          empresaId = profileRow.empresa_id;
        }
      }

      if (!empresaId && role === "empresa" && actorUserId) {
        const { data: empFromUser, error: empUserErr } = await supabaseAdmin
          .from("empresas")
          .select("id")
          .eq("user_id", actorUserId)
          .maybeSingle();

        if (!empUserErr && empFromUser?.id) {
          empresaId = empFromUser.id;
        }
      }

      if (!empresaId && role === "asesor") {
        const email = a.email ?? a.user_metadata?.email ?? null;

        if (email) {
          const { data: asesorRow, error: asesorErr } = await supabaseAdmin
            .from("asesores")
            .select("empresa_id")
            .eq("email", email)
            .maybeSingle();

          if (!asesorErr && asesorRow?.empresa_id) {
            empresaId = asesorRow.empresa_id;
          }
        }
      }
    }

    if (!empresaId) {
      return NextResponse.json(
        {
          error: isAdminLike
            ? "Falta 'empresaId' para consulta como admin/soporte."
            : "No se pudo resolver la empresa del usuario.",
        },
        { status: 400 }
      );
    }

    const { data: empRow, error: empErr } = await supabaseAdmin
      .from("empresas")
      .select(
        "id, nombre_comercial, razon_social, suspendida, suspendida_at, suspension_motivo"
      )
      .eq("id", empresaId)
      .maybeSingle();

    if (empErr) {
      return NextResponse.json({ error: empErr.message }, { status: 400 });
    }
    if (!empRow) {
      return NextResponse.json(
        { error: "Empresa no encontrada." },
        { status: 404 }
      );
    }

    const { data: planEP, error: planEpErr } = await supabaseAdmin
      .from("empresas_planes")
      .select(
        "id, plan_id, fecha_inicio, fecha_fin, activo, max_asesores_override"
      )
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .order("fecha_inicio", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (planEpErr) {
      return NextResponse.json({ error: planEpErr.message }, { status: 400 });
    }

    const { data: vEstado } = await supabaseAdmin
      .from("v_suscripcion_estado")
      .select("plan_proximo_id, plan_proximo_nombre, cambio_programado_para")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (!planEP) {
      const suspendidaSinPlan = true;
      const suspensionMotivoSinPlan =
        empRow.suspension_motivo ??
        "Sin plan activo. Debe seleccionar un plan para continuar.";

      return NextResponse.json(
        {
          plan: null,
          ciclo: { inicio: null, fin: null, proximoCobro: null },
          suscripcion: null,
          proximoPlan: vEstado?.plan_proximo_id
            ? {
                id: vEstado.plan_proximo_id,
                nombre: vEstado.plan_proximo_nombre ?? "",
              }
            : null,
          cambioProgramadoPara: vEstado?.cambio_programado_para ?? null,
          estado: {
            suspendida: suspendidaSinPlan,
            suspendida_motivo: suspensionMotivoSinPlan,
            suspendida_at: empRow.suspendida_at ?? null,
            plan_vencido: true,
            dias_desde_vencimiento: 0,
            en_periodo_gracia: false,
            requiere_seleccion_plan: true,
            requiere_pago_inicial_acuerdo: false,
          },
          features: {
            tipo_plan: null,
            incluye_valuador: false,
            incluye_tracker: false,
          },
          pricing: null,
          acuerdoComercial: null,
          cupos: {
            max_asesores_plan: null,
            max_asesores_final: null,
            precio_extra_por_asesor_plan: null,
            precio_extra_por_asesor_final: null,
          },
        },
        { status: 200 }
      );
    }

    const { data: planRow, error: planErr } = await supabaseAdmin
      .from("planes")
      .select(
        "id, nombre, nombre_comercial, precio, duracion_dias, max_asesores, precio_extra_por_asesor, tipo_plan, incluye_valuador, incluye_tracker, es_trial"
      )
      .eq("id", planEP.plan_id)
      .maybeSingle();

    if (planErr) {
      return NextResponse.json({ error: planErr.message }, { status: 400 });
    }

    const billingConfig = await resolveEmpresaBillingConfig({
      supabase: supabaseAdmin,
      empresaId,
      planId: planEP.plan_id,
      maxAsesoresOverride:
        planEP.max_asesores_override == null
          ? null
          : Number(planEP.max_asesores_override),
    });

    const precioNeto = toNum(billingConfig.precio_neto_final);
    const iva = toNum(billingConfig.iva_importe);
    const totalConIVA = toNum(billingConfig.precio_total_final);

    const { data: susRow } = await supabaseAdmin
      .from("suscripciones")
      .select(
        "estado, inicio, fin, plan_id, externo_customer_id, externo_subscription_id, created_at"
      )
      .eq("empresa_id", empresaId)
      .order("inicio", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const cicloInicio = billingConfig.ciclo_inicio ?? planEP.fecha_inicio ?? null;
    const cicloFin = billingConfig.ciclo_fin ?? planEP.fecha_fin ?? null;

    const now = new Date();
    let plan_vencido = false;
    let dias_desde_vencimiento: number | null = null;
    let en_periodo_gracia = false;
    let proximoCobro: string | null = null;

    if (cicloFin) {
      try {
        const fin = new Date(cicloFin as string);
        proximoCobro = fin.toISOString();
        const diffMs = now.getTime() - fin.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        dias_desde_vencimiento = diffDays;

        if (diffDays >= 0) {
          plan_vencido = true;
          en_periodo_gracia = diffDays <= 2;
        }
      } catch {
        proximoCobro = null;
      }
    } else if (cicloInicio && (billingConfig.plan_duracion_dias ?? planRow?.duracion_dias)) {
      try {
        const base = new Date(cicloInicio as string);
        const d = new Date(base.getTime());
        d.setDate(
          d.getDate() +
            Number(billingConfig.plan_duracion_dias ?? planRow?.duracion_dias ?? 30)
        );
        proximoCobro = d.toISOString();
      } catch {
        proximoCobro = null;
      }
    }

    const hoy = todayDateOnlyUTC();

    const acuerdoActivo = !!billingConfig.agreement_applied;
    const acuerdoInicio = billingConfig.agreement_fecha_inicio ?? null;
    const acuerdoFin = billingConfig.agreement_fecha_fin ?? null;

    const acuerdoVigenteHoy =
      acuerdoActivo &&
      !!acuerdoInicio &&
      acuerdoInicio <= hoy &&
      (!acuerdoFin || acuerdoFin >= hoy);

    const acuerdoGratisOVirtual = acuerdoVigenteHoy && round2(totalConIVA) <= 0;

    const suscripcionActivaActual =
      !!susRow &&
      susRow.estado === "activa" &&
      (!susRow.plan_id || String(susRow.plan_id) === String(planEP.plan_id)) &&
      (!!susRow.fin ? String(susRow.fin).slice(0, 10) >= hoy : true);

    const requierePagoInicialAcuerdo =
      acuerdoVigenteHoy &&
      !acuerdoGratisOVirtual &&
      !suscripcionActivaActual;

    const suspendidaPorAcuerdo = requierePagoInicialAcuerdo === true;

    const suspendidaFinal = suspendidaPorAcuerdo || !!empRow.suspendida;

    const suspensionMotivoFinal = suspendidaPorAcuerdo
      ? "Acuerdo comercial pendiente de pago inicial."
      : empRow.suspension_motivo ?? null;

    const enPeriodoGraciaFinal = suspendidaPorAcuerdo
      ? false
      : en_periodo_gracia;

    const planVencidoFinal = acuerdoGratisOVirtual ? false : plan_vencido;
    const diasDesdeVencimientoFinal = acuerdoGratisOVirtual
      ? null
      : dias_desde_vencimiento;

    const tipoPlan = planRow?.tipo_plan ?? null;
    const incluyeValuador = !!planRow?.incluye_valuador;
    const incluyeTracker = !!planRow?.incluye_tracker;

    return NextResponse.json(
      {
        plan: planRow
          ? {
              id: planRow.id,
              nombre:
                (planRow as any).nombre_comercial ??
                planRow.nombre,

              precioNeto,
              totalConIVA,

              precioBaseNeto: billingConfig.precio_base_neto,
              precioNetoFinal: billingConfig.precio_neto_final,
              ivaModo: billingConfig.modo_iva,
              ivaPct: billingConfig.iva_pct,
              ivaImporte: billingConfig.iva_importe,
              precioTotalFinal: billingConfig.precio_total_final,
              pricingSource: billingConfig.pricing_source,

              tipo_plan: tipoPlan,
              incluye_valuador: incluyeValuador,
              incluye_tracker: incluyeTracker,
              es_trial: billingConfig.plan_es_trial ?? !!planRow.es_trial,
              duracion_dias:
                billingConfig.plan_duracion_dias ??
                (planRow?.duracion_dias == null
                  ? null
                  : Number(planRow.duracion_dias)),
            }
          : null,
        ciclo: {
          inicio: cicloInicio,
          fin: cicloFin,
          proximoCobro,
        },
        suscripcion: susRow
          ? {
              estado: susRow.estado,
              externoCustomerId: susRow.externo_customer_id ?? null,
              externoSubscriptionId: susRow.externo_subscription_id ?? null,
            }
          : null,
        proximoPlan: vEstado?.plan_proximo_id
          ? {
              id: vEstado.plan_proximo_id,
              nombre: vEstado.plan_proximo_nombre ?? "",
            }
          : null,
        cambioProgramadoPara: vEstado?.cambio_programado_para ?? null,
        estado: {
          suspendida: suspendidaFinal,
          suspendida_motivo: suspensionMotivoFinal,
          suspendida_at: empRow.suspendida_at ?? null,
          plan_vencido: planVencidoFinal,
          dias_desde_vencimiento: diasDesdeVencimientoFinal,
          en_periodo_gracia: enPeriodoGraciaFinal,
          requiere_seleccion_plan: false,
          requiere_pago_inicial_acuerdo: requierePagoInicialAcuerdo,
        },
        features: {
          tipo_plan: tipoPlan,
          incluye_valuador: incluyeValuador,
          incluye_tracker: incluyeTracker,
        },
        pricing: {
          precio_base_neto: billingConfig.precio_base_neto,
          precio_neto_final: billingConfig.precio_neto_final,
          modo_iva: billingConfig.modo_iva,
          iva_pct: billingConfig.iva_pct,
          iva_importe: billingConfig.iva_importe,
          precio_total_final: billingConfig.precio_total_final,
          pricing_source: billingConfig.pricing_source,
          suscripcion_override_applied:
            billingConfig.suscripcion_override_applied,
          suscripcion_precio_neto_override:
            billingConfig.suscripcion_precio_neto_override,
        },
        cupos: {
          max_asesores_plan: billingConfig.max_asesores_plan,
          max_asesores_final: billingConfig.max_asesores_final,
          precio_extra_por_asesor_plan:
            billingConfig.precio_extra_por_asesor_plan,
          precio_extra_por_asesor_final:
            billingConfig.precio_extra_por_asesor_final,
        },
        acuerdoComercial: billingConfig.agreement_applied
          ? {
              activo: true,
              id: billingConfig.agreement_id,
              tipo: billingConfig.agreement_tipo,
              plan_id: billingConfig.agreement_plan_id,
              fecha_inicio: billingConfig.agreement_fecha_inicio,
              fecha_fin: billingConfig.agreement_fecha_fin,
              modo_iva: billingConfig.modo_iva,
              iva_pct: billingConfig.iva_pct,
              precio_neto_final: billingConfig.precio_neto_final,
              precio_total_final: billingConfig.precio_total_final,
              max_asesores_final: billingConfig.max_asesores_final,
              precio_extra_por_asesor_final:
                billingConfig.precio_extra_por_asesor_final,
            }
          : null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("billing/estado GET error:", e?.message || e);
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
