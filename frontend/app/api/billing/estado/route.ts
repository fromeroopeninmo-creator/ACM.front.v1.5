export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";
import {
  assertAuthAndGetContext,
  resolveEmpresaBillingConfig,
  round2,
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

function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Determina si una suspensión persistida parece haber sido generada por billing.
 * La usamos para limpiar automáticamente solo suspensiones operativas de pago/plan,
 * sin tocar posibles bloqueos manuales administrativos, fraude, abuso, baja comercial, etc.
 */
function isBillingSuspensionMotivo(motivo?: string | null): boolean {
  if (!motivo) return false;

  const m = motivo.toLowerCase().trim();

  const knownBillingMotivos = [
    "acuerdo comercial pendiente de pago",
    "trial vencido",
    "cuenta temporalmente suspendida por falta de pago",
    "pago no acreditado",
    "suscripción suspendida",
    "suscripcion suspendida",
    "suscripción cancelada",
    "suscripcion cancelada",
    "sin plan activo",
    "plan vencido",
    "falta de pago",
  ];

  return knownBillingMotivos.some((needle) => m.includes(needle));
}

async function persistirSuspensionEmpresa(params: {
  empresaId: string;
  motivo: string;
}) {
  const { empresaId, motivo } = params;

  const { error } = await supabaseAdmin
    .from("empresas")
    .update({
      suspendida: true,
      suspendida_at: nowISO(),
      suspension_motivo: motivo,
      updated_at: nowISO(),
    })
    .eq("id", empresaId);

  if (error) {
    console.warn(
      "billing/estado: no se pudo persistir suspensión:",
      error.message
    );
  }
}

async function limpiarSuspensionEmpresa(params: { empresaId: string }) {
  const { empresaId } = params;

  const { error } = await supabaseAdmin
    .from("empresas")
    .update({
      suspendida: false,
      suspendida_at: null,
      suspension_motivo: null,
      updated_at: nowISO(),
    })
    .eq("id", empresaId);

  if (error) {
    console.warn(
      "billing/estado: no se pudo limpiar suspensión:",
      error.message
    );
  }
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
      const suspensionMotivoSinPlan =
        empRow.suspension_motivo ??
        "Sin plan activo. Debe seleccionar un plan para continuar.";

      if (!empRow.suspendida) {
        await persistirSuspensionEmpresa({
          empresaId,
          motivo: suspensionMotivoSinPlan,
        });
      }

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
            suspendida: true,
            suspendida_motivo: suspensionMotivoSinPlan,
            suspendida_at: empRow.suspendida_at ?? nowISO(),
            plan_vencido: true,
            estado_plan: "sin_plan",
            tipo_cobertura_actual: "sin_cobertura",
            dias_desde_vencimiento: 0,
            en_periodo_gracia: false,
            requiere_seleccion_plan: true,
            requiere_pago: false,
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
    const totalConIVA = toNum(billingConfig.precio_total_final);

    const ahoraIso = nowISO();

    const { data: suscripcionActiva, error: suscripcionActivaError } =
      await supabaseAdmin
        .from("suscripciones")
        .select(
          "id, estado, inicio, fin, plan_id, externo_customer_id, externo_subscription_id, created_at"
        )
        .eq("empresa_id", empresaId)
        .eq("estado", "activa")
        .lte("inicio", ahoraIso)
        .or(`fin.is.null,fin.gte.${ahoraIso}`)
        .order("fin", { ascending: false, nullsFirst: true })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (suscripcionActivaError) {
      return NextResponse.json(
        { error: suscripcionActivaError.message },
        { status: 400 }
      );
    }

    const { data: ultimaSuscripcion, error: ultimaSuscripcionError } =
      await supabaseAdmin
        .from("suscripciones")
        .select(
          "id, estado, inicio, fin, plan_id, externo_customer_id, externo_subscription_id, created_at"
        )
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (ultimaSuscripcionError) {
      return NextResponse.json(
        { error: ultimaSuscripcionError.message },
        { status: 400 }
      );
    }

    const susRow = suscripcionActiva ?? ultimaSuscripcion ?? null;

    const cicloInicio =
      suscripcionActiva?.inicio ??
      billingConfig.ciclo_inicio ??
      planEP.fecha_inicio ??
      null;

    const cicloFin =
      suscripcionActiva?.fin ??
      billingConfig.ciclo_fin ??
      planEP.fecha_fin ??
      null;

    if (suscripcionActiva?.fin) {
      const fechaFinSuscripcion = String(suscripcionActiva.fin).slice(0, 10);
      const fechaFinPlan = planEP.fecha_fin
        ? String(planEP.fecha_fin).slice(0, 10)
        : null;

      if (!fechaFinPlan || fechaFinPlan < fechaFinSuscripcion || !planEP.activo) {
        const { error: syncPlanError } = await supabaseAdmin
          .from("empresas_planes")
          .update({
            activo: true,
            fecha_fin: fechaFinSuscripcion,
          })
          .eq("id", planEP.id);

        if (syncPlanError) {
          console.warn(
            "billing/estado: no se pudo sincronizar empresas_planes:",
            syncPlanError.message
          );
        }
      }
    }

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
    } else if (
      cicloInicio &&
      (billingConfig.plan_duracion_dias ?? planRow?.duracion_dias)
    ) {
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

    const esTrial = billingConfig.plan_es_trial ?? !!planRow?.es_trial;
    const acuerdoActivo = !!billingConfig.agreement_applied;
    const acuerdoInicio = billingConfig.agreement_fecha_inicio ?? null;
    const acuerdoFin = billingConfig.agreement_fecha_fin ?? null;

    const acuerdoVigenteHoy =
      acuerdoActivo &&
      !!acuerdoInicio &&
      acuerdoInicio <= hoy &&
      (!acuerdoFin || acuerdoFin >= hoy);

    const acuerdoGratisOVirtual =
      acuerdoVigenteHoy && round2(totalConIVA) <= 0;

    const suscripcionActivaActual = !!suscripcionActiva;

    // Acuerdo comercial vigente con cobro mensual:
    // si no hay suscripción/ciclo vigente actual, debe pedir pago.
    const requierePagoInicialAcuerdo =
      acuerdoVigenteHoy &&
      !acuerdoGratisOVirtual &&
      !suscripcionActivaActual;

    // Trial vencido fuera de gracia
    const requiereSeleccionPlan =
      !!esTrial && plan_vencido && !en_periodo_gracia;

    // Plan normal vencido fuera de gracia
    const requierePagoPlanNormal =
      !esTrial &&
      !acuerdoVigenteHoy &&
      plan_vencido &&
      !en_periodo_gracia;

    const suspendidaPorAcuerdo = requierePagoInicialAcuerdo === true;
    const suspendidaPorTrial = requiereSeleccionPlan === true;
    const suspendidaPorPlanNormal = requierePagoPlanNormal === true;

    const suspendidaCalculada =
      suspendidaPorAcuerdo ||
      suspendidaPorTrial ||
      suspendidaPorPlanNormal;

    const suspensionMotivoCalculado = suspendidaPorAcuerdo
      ? "Acuerdo comercial pendiente de pago del ciclo actual."
      : suspendidaPorTrial
      ? "Trial vencido. Debe seleccionar un plan para continuar."
      : suspendidaPorPlanNormal
      ? "Cuenta temporalmente suspendida por falta de pago."
      : null;

    let suspendidaPersistidaFinal = !!empRow.suspendida;
    let suspendidaAtFinal = empRow.suspendida_at ?? null;
    let motivoPersistidoFinal = empRow.suspension_motivo ?? null;

    /**
     * Sincronización oportunista:
     * - Si el cálculo dice que debe suspenderse, persistimos suspensión.
     * - Si el cálculo dice que NO debe suspenderse y la suspensión persistida era de billing,
     *   la limpiamos automáticamente.
     * - Si la suspensión persistida parece manual/administrativa no-billing, la respetamos.
     */
    if (suspendidaCalculada && suspensionMotivoCalculado) {
      const debeActualizarMotivo =
        !empRow.suspendida ||
        empRow.suspension_motivo !== suspensionMotivoCalculado;

      if (debeActualizarMotivo) {
        await persistirSuspensionEmpresa({
          empresaId,
          motivo: suspensionMotivoCalculado,
        });
      }

      suspendidaPersistidaFinal = true;
      suspendidaAtFinal = empRow.suspendida_at ?? nowISO();
      motivoPersistidoFinal = suspensionMotivoCalculado;
    } else if (
      empRow.suspendida &&
      isBillingSuspensionMotivo(empRow.suspension_motivo)
    ) {
      await limpiarSuspensionEmpresa({ empresaId });

      suspendidaPersistidaFinal = false;
      suspendidaAtFinal = null;
      motivoPersistidoFinal = null;
    }

    const suspendidaFinal =
      suspendidaCalculada || suspendidaPersistidaFinal;

    const suspensionMotivoFinal = suspendidaCalculada
      ? suspensionMotivoCalculado
      : motivoPersistidoFinal;

    const enPeriodoGraciaFinal =
      suspendidaPorAcuerdo ? false : en_periodo_gracia;

    const planVencidoFinal =
      acuerdoGratisOVirtual || suscripcionActivaActual
        ? false
        : plan_vencido;

    const diasDesdeVencimientoFinal =
      acuerdoGratisOVirtual || suscripcionActivaActual
        ? null
        : dias_desde_vencimiento;

    const tipoPlan = planRow?.tipo_plan ?? null;
    const incluyeValuador = !!planRow?.incluye_valuador;
    const incluyeTracker = !!planRow?.incluye_tracker;

    let tipoCoberturaActual:
      | "trial"
      | "plan"
      | "acuerdo_comercial"
      | "sin_cobertura" = "plan";

    if (esTrial) {
      tipoCoberturaActual = "trial";
    } else if (acuerdoVigenteHoy) {
      tipoCoberturaActual = "acuerdo_comercial";
    } else {
      tipoCoberturaActual = "plan";
    }

    let estadoPlan: "vigente" | "vencido" | "sin_plan" = "vigente";
    if (!planEP) {
      estadoPlan = "sin_plan";
    } else if (planVencidoFinal) {
      estadoPlan = "vencido";
    } else {
      estadoPlan = "vigente";
    }

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
              es_trial: esTrial,
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
          suspendida_at: suspendidaAtFinal,
          plan_vencido: planVencidoFinal,
          estado_plan: estadoPlan,
          tipo_cobertura_actual: tipoCoberturaActual,
          dias_desde_vencimiento: diasDesdeVencimientoFinal,
          en_periodo_gracia: enPeriodoGraciaFinal,
          requiere_seleccion_plan: requiereSeleccionPlan,
          requiere_pago: suspendidaPorAcuerdo || suspendidaPorPlanNormal,
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
