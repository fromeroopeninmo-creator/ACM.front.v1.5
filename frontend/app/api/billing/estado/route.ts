// frontend/app/api/billing/estado/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";
import {
  assertAuthAndGetContext,
  getEmpresaAcuerdoComercialActivo,
  getSuscripcionEstado,
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

function nowISO(): string {
  return new Date().toISOString();
}

function todayUTC(): string {
  return nowISO().slice(0, 10);
}

function isBillingSuspensionReason(reason?: string | null): boolean {
  if (!reason) return false;
  const normalized = reason.toLowerCase().trim();
  return [
    "falta de pago",
    "pago no acreditado",
    "suscripción vencida",
    "suscripcion vencida",
    "plan vencido",
    "trial vencido",
    "acuerdo comercial pendiente de pago",
    "sin ciclo vigente",
    "sin plan activo",
  ].some((token) => normalized.includes(token));
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000))
  );
}

async function resolveEmpresaId(params: {
  role: Role;
  actor: any;
  empresaIdParam?: string;
}): Promise<string | null> {
  const { role, actor, empresaIdParam } = params;
  const isAdminLike =
    role === "super_admin_root" ||
    role === "super_admin" ||
    role === "soporte";

  if (isAdminLike && empresaIdParam) return empresaIdParam;
  if (actor?.empresaId) return String(actor.empresaId);

  const userId = actor?.userId ?? actor?.id ?? actor?.sub ?? null;
  if (!userId) return null;

  const { data: byProfileUserId } = await supabaseAdmin
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (byProfileUserId?.empresa_id) return String(byProfileUserId.empresa_id);

  const { data: byProfileId } = await supabaseAdmin
    .from("profiles")
    .select("empresa_id")
    .eq("id", userId)
    .maybeSingle();

  if (byProfileId?.empresa_id) return String(byProfileId.empresa_id);

  if (role === "empresa") {
    // Compatibilidad con altas históricas:
    // algunas empresas quedaron vinculadas por user_id y otras por id_usuario.
    const { data: empresa, error: empresaError } = await supabaseAdmin
      .from("empresas")
      .select("id")
      .or(`user_id.eq.${userId},id_usuario.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (empresaError) {
      console.error("No se pudo resolver empresa por usuario:", empresaError);
    }

    if (empresa?.id) return String(empresa.id);
  }

  if (role === "asesor") {
    const email = actor?.email ?? actor?.user_metadata?.email ?? null;
    if (email) {
      const { data: asesor } = await supabaseAdmin
        .from("asesores")
        .select("empresa_id")
        .ilike("email", String(email).trim())
        .maybeSingle();

      if (asesor?.empresa_id) return String(asesor.empresa_id);
    }
  }

  return null;
}

async function getLatestSubscription(empresaId: string) {
  const { data } = await supabaseAdmin
    .from("suscripciones")
    .select(
      "id, estado, inicio, fin, ciclo_inicio, ciclo_fin, plan_id, plan_actual_id, plan_proximo_id, cambio_programado_para, moneda, precio_neto_override, externo_customer_id, externo_subscription_id, metadata, created_at"
    )
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

async function getLatestExpiredPaidCycle(empresaId: string) {
  const now = nowISO();
  const { data } = await supabaseAdmin
    .from("suscripciones")
    .select("id, ciclo_inicio, ciclo_fin, inicio, fin, plan_id, plan_actual_id")
    .eq("empresa_id", empresaId)
    .eq("estado", "activa")
    .or(`ciclo_fin.lte.${now},and(ciclo_fin.is.null,fin.lte.${now})`)
    .order("ciclo_fin", { ascending: false, nullsFirst: false })
    .order("fin", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

async function getLatestAgreement(empresaId: string) {
  const { data } = await supabaseAdmin
    .from("empresa_acuerdos_comerciales")
    .select(
      "id, empresa_id, plan_id, activo, tipo_acuerdo, descuento_pct, precio_neto_fijo, max_asesores_override, precio_extra_por_asesor_override, modo_iva, iva_pct, fecha_inicio, fecha_fin, motivo, observaciones, created_at"
    )
    .eq("empresa_id", empresaId)
    .order("fecha_inicio", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

async function syncOperationalPlanFromCurrentCycle(params: {
  empresaId: string;
  planId: string;
  cycleStart: string;
  cycleEnd: string;
  maxAsesoresOverride: number | null;
}) {
  const { empresaId, planId, cycleStart, cycleEnd, maxAsesoresOverride } = params;

  const { data: current } = await supabaseAdmin
    .from("empresas_planes")
    .select("id, plan_id, fecha_inicio, fecha_fin, max_asesores_override")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  const desiredStart = cycleStart.slice(0, 10);
  const desiredEnd = cycleEnd.slice(0, 10);
  const alreadySynced =
    current &&
    String(current.plan_id) === planId &&
    String(current.fecha_inicio ?? "") === desiredStart &&
    String(current.fecha_fin ?? "") === desiredEnd &&
    Number(current.max_asesores_override ?? 0) ===
      Number(maxAsesoresOverride ?? 0);

  if (alreadySynced) return;

  await supabaseAdmin
    .from("empresas_planes")
    .update({ activo: false, updated_at: nowISO() })
    .eq("empresa_id", empresaId)
    .eq("activo", true);

  const { data: reusable } = await supabaseAdmin
    .from("empresas_planes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    fecha_inicio: desiredStart,
    fecha_fin: desiredEnd,
    activo: true,
    max_asesores_override: maxAsesoresOverride,
    updated_at: nowISO(),
  };

  if (reusable?.id) {
    await supabaseAdmin
      .from("empresas_planes")
      .update(payload)
      .eq("id", reusable.id);
  } else {
    await supabaseAdmin.from("empresas_planes").insert({
      empresa_id: empresaId,
      plan_id: planId,
      ...payload,
    });
  }
}

export async function GET(req: Request) {
  try {
    const server = supabaseServer();
    const actor = await assertAuthAndGetContext(server);
    const role = (actor.role ?? "") as Role;
    const url = new URL(req.url);
    const empresaIdParam = url.searchParams.get("empresaId") ?? undefined;

    const empresaId = await resolveEmpresaId({ role, actor, empresaIdParam });

    if (!empresaId) {
      return NextResponse.json(
        { error: "No se pudo resolver la empresa del usuario." },
        { status: 400 }
      );
    }

    const { data: empresa, error: empresaError } = await supabaseAdmin
      .from("empresas")
      .select(
        "id, nombre_comercial, razon_social, suspendida, suspendida_at, suspension_motivo"
      )
      .eq("id", empresaId)
      .maybeSingle();

    if (empresaError) {
      return NextResponse.json({ error: empresaError.message }, { status: 400 });
    }
    if (!empresa) {
      return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
    }

    const { data: operationalPlan } = await supabaseAdmin
      .from("empresas_planes")
      .select("id, plan_id, fecha_inicio, fecha_fin, activo, max_asesores_override")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .order("fecha_inicio", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentCycle = await getSuscripcionEstado(supabaseAdmin, empresaId);
    const latestSubscription = await getLatestSubscription(empresaId);
    const latestExpiredCycle = currentCycle
      ? null
      : await getLatestExpiredPaidCycle(empresaId);
    const activeAgreement = await getEmpresaAcuerdoComercialActivo(
      supabaseAdmin,
      empresaId
    );
    const latestAgreement = await getLatestAgreement(empresaId);

    const cycleMetadata = currentCycle?.metadata ?? {};
    const cycleSnapshot =
      cycleMetadata.snapshot && typeof cycleMetadata.snapshot === "object"
        ? (cycleMetadata.snapshot as Record<string, any>)
        : (cycleMetadata as Record<string, any>);

    const cyclePlanId = currentCycle?.plan_actual_id ?? null;
    const agreementPlanId = activeAgreement?.plan_id ?? null;
    const operationalPlanId = operationalPlan?.plan_id
      ? String(operationalPlan.plan_id)
      : null;
    const planIdForDisplay = cyclePlanId ?? agreementPlanId ?? operationalPlanId;

    let planRow: any = null;
    if (planIdForDisplay) {
      const { data, error } = await supabaseAdmin
        .from("planes")
        .select(
          "id, nombre, nombre_comercial, precio, duracion_dias, max_asesores, precio_extra_por_asesor, tipo_plan, tier_plan, incluye_valuador, incluye_tracker, es_trial, es_desarrollo"
        )
        .eq("id", planIdForDisplay)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      planRow = data;
    }

    let nextPaymentConfig: Awaited<ReturnType<typeof resolveEmpresaBillingConfig>> | null = null;
    const planIdForNextPayment = agreementPlanId ?? operationalPlanId ?? cyclePlanId;

    if (planIdForNextPayment) {
      nextPaymentConfig = await resolveEmpresaBillingConfig({
        supabase: supabaseAdmin,
        empresaId,
        planId: planIdForNextPayment,
        maxAsesoresOverride:
          operationalPlan?.max_asesores_override == null
            ? null
            : Number(operationalPlan.max_asesores_override),
      });
    }

    const today = todayUTC();
    const legacyStart = operationalPlan?.fecha_inicio
      ? String(operationalPlan.fecha_inicio)
      : null;
    const legacyEnd = operationalPlan?.fecha_fin
      ? String(operationalPlan.fecha_fin)
      : null;
    const legacyOperationalCoverage =
      !!operationalPlan &&
      !!planRow &&
      (planRow.es_trial === true || planRow.es_desarrollo === true) &&
      (!legacyStart || legacyStart <= today) &&
      (!legacyEnd || legacyEnd >= today);

    const hasPaidCycle = !!currentCycle;
    const accessByCoverage = hasPaidCycle || legacyOperationalCoverage;
    const manualSuspension =
      empresa.suspendida === true &&
      !isBillingSuspensionReason(empresa.suspension_motivo);
    const automaticSuspension = !accessByCoverage;
    const accessAllowed = !manualSuspension && !automaticSuspension;

    const lastCycleEnd =
      currentCycle?.ciclo_fin ??
      latestExpiredCycle?.ciclo_fin ??
      latestExpiredCycle?.fin ??
      null;

    const isTrial = planRow?.es_trial === true;
    const requiresPlanSelection = !accessByCoverage && isTrial;
    const requiresPayment = !accessByCoverage && !isTrial && !!planIdForNextPayment;
    const requiresAgreementPayment = requiresPayment && !!activeAgreement;

    let automaticReason: string | null = null;
    if (automaticSuspension) {
      if (requiresAgreementPayment) {
        automaticReason = "Acuerdo comercial pendiente de pago del ciclo mensual.";
      } else if (requiresPlanSelection) {
        automaticReason = "Trial vencido. Debe seleccionar un plan para continuar.";
      } else if (planIdForNextPayment) {
        automaticReason = "Cuenta suspendida por falta de pago: sin ciclo vigente.";
      } else {
        automaticReason = "Sin plan activo. Debe seleccionar un plan para continuar.";
      }
    }

    if (automaticSuspension && !manualSuspension) {
      if (
        empresa.suspendida !== true ||
        empresa.suspension_motivo !== automaticReason
      ) {
        await supabaseAdmin
          .from("empresas")
          .update({
            suspendida: true,
            suspendida_at: nowISO(),
            suspension_motivo: automaticReason,
            updated_at: nowISO(),
          })
          .eq("id", empresaId);
      }
    } else if (
      accessAllowed &&
      empresa.suspendida === true &&
      isBillingSuspensionReason(empresa.suspension_motivo)
    ) {
      await supabaseAdmin
        .from("empresas")
        .update({
          suspendida: false,
          suspendida_at: null,
          suspension_motivo: null,
          updated_at: nowISO(),
        })
        .eq("id", empresaId);
    }

    if (currentCycle?.plan_actual_id) {
      await syncOperationalPlanFromCurrentCycle({
        empresaId,
        planId: currentCycle.plan_actual_id,
        cycleStart: currentCycle.ciclo_inicio,
        cycleEnd: currentCycle.ciclo_fin,
        maxAsesoresOverride:
          cycleSnapshot.max_asesores_final == null
            ? null
            : Number(cycleSnapshot.max_asesores_final),
      });
    }

    const agreementStatus = activeAgreement
      ? "vigente"
      : latestAgreement
      ? "vencido"
      : "sin_acuerdo";

    const agreementForResponse = activeAgreement ?? latestAgreement;
    const agreementPricing = activeAgreement ? nextPaymentConfig : null;

    const planName = planRow
      ? String(planRow.nombre_comercial ?? planRow.nombre ?? "")
      : null;
    const currentCyclePrice =
      cycleSnapshot.precio_total_final ??
      cycleSnapshot.precio_neto_final ??
      null;

    return NextResponse.json(
      {
        acceso: {
          permitido: accessAllowed,
          origen: manualSuspension
            ? "suspension_manual"
            : hasPaidCycle
            ? "ciclo_pagado"
            : legacyOperationalCoverage
            ? isTrial
              ? "trial"
              : "desarrollo"
            : "sin_cobertura",
          motivo: manualSuspension
            ? empresa.suspension_motivo
            : automaticReason,
        },
        plan: planRow
          ? {
              id: String(planRow.id),
              nombre: planName,
              precioNeto:
                nextPaymentConfig?.precio_neto_final ?? Number(planRow.precio ?? 0),
              totalConIVA:
                nextPaymentConfig?.precio_total_final ?? Number(planRow.precio ?? 0),
              precioBaseNeto: nextPaymentConfig?.precio_base_neto ?? null,
              precioNetoFinal: nextPaymentConfig?.precio_neto_final ?? null,
              ivaModo: nextPaymentConfig?.modo_iva ?? null,
              ivaPct: nextPaymentConfig?.iva_pct ?? null,
              ivaImporte: nextPaymentConfig?.iva_importe ?? null,
              precioTotalFinal: nextPaymentConfig?.precio_total_final ?? null,
              pricingSource: nextPaymentConfig?.pricing_source ?? null,
              tipo_plan: planRow.tipo_plan ?? null,
              tier_plan: planRow.tier_plan ?? null,
              incluye_valuador: planRow.incluye_valuador === true,
              incluye_tracker: planRow.incluye_tracker === true,
              es_trial: planRow.es_trial === true,
              es_desarrollo: planRow.es_desarrollo === true,
              duracion_dias:
                planRow.duracion_dias == null ? null : Number(planRow.duracion_dias),
            }
          : null,
        ciclo: currentCycle
          ? {
              id: currentCycle.id,
              inicio: currentCycle.ciclo_inicio,
              fin: currentCycle.ciclo_fin,
              proximoCobro: currentCycle.ciclo_fin,
              vigente: true,
              precioPagado: currentCyclePrice,
            }
          : {
              id: null,
              inicio: null,
              fin: null,
              proximoCobro: null,
              vigente: false,
              ultimoVencimiento: lastCycleEnd,
            },
        suscripcion: currentCycle
          ? {
              id: currentCycle.id,
              estado: currentCycle.estado,
              externoCustomerId: currentCycle.externo_customer_id ?? null,
              externoSubscriptionId: currentCycle.externo_subscription_id ?? null,
            }
          : latestSubscription
          ? {
              id: latestSubscription.id,
              estado: latestSubscription.estado,
              externoCustomerId: latestSubscription.externo_customer_id ?? null,
              externoSubscriptionId: latestSubscription.externo_subscription_id ?? null,
            }
          : null,
        ultimaSuscripcionInformativa: latestSubscription
          ? {
              id: latestSubscription.id,
              estado: latestSubscription.estado,
              creadoEn: latestSubscription.created_at ?? null,
              externoCustomerId: latestSubscription.externo_customer_id ?? null,
              externoSubscriptionId: latestSubscription.externo_subscription_id ?? null,
            }
          : null,
        proximoPlan: currentCycle?.plan_proximo_id
          ? {
              id: currentCycle.plan_proximo_id,
              nombre: currentCycle.plan_proximo_nombre ?? "",
            }
          : null,
        cambioProgramadoPara: currentCycle?.cambio_programado_para ?? null,
        estado: {
          suspendida: !accessAllowed,
          suspendida_motivo: manualSuspension
            ? empresa.suspension_motivo
            : automaticReason,
          suspendida_at: !accessAllowed
            ? empresa.suspendida_at ?? nowISO()
            : null,
          plan_vencido: !accessByCoverage,
          estado_plan: accessByCoverage
            ? "vigente"
            : planIdForNextPayment
            ? "vencido"
            : "sin_plan",
          tipo_cobertura_actual: hasPaidCycle
            ? activeAgreement
              ? "acuerdo_comercial"
              : "plan"
            : legacyOperationalCoverage
            ? isTrial
              ? "trial"
              : "plan"
            : "sin_cobertura",
          dias_desde_vencimiento: accessByCoverage ? null : daysSince(lastCycleEnd),
          en_periodo_gracia: false,
          requiere_seleccion_plan: requiresPlanSelection || !planIdForNextPayment,
          requiere_pago: requiresPayment,
          requiere_pago_inicial_acuerdo: requiresAgreementPayment,
          suspension_manual: manualSuspension,
        },
        features: {
          tipo_plan: planRow?.tipo_plan ?? null,
          incluye_valuador: planRow?.incluye_valuador === true,
          incluye_tracker: planRow?.incluye_tracker === true,
        },
        pricing: nextPaymentConfig
          ? {
              precio_base_neto: nextPaymentConfig.precio_base_neto,
              precio_neto_final: nextPaymentConfig.precio_neto_final,
              modo_iva: nextPaymentConfig.modo_iva,
              iva_pct: nextPaymentConfig.iva_pct,
              iva_importe: nextPaymentConfig.iva_importe,
              precio_total_final: nextPaymentConfig.precio_total_final,
              pricing_source: nextPaymentConfig.pricing_source,
              suscripcion_override_applied:
                nextPaymentConfig.suscripcion_override_applied,
              suscripcion_precio_neto_override:
                nextPaymentConfig.suscripcion_precio_neto_override,
            }
          : null,
        cupos: nextPaymentConfig
          ? {
              max_asesores_plan: nextPaymentConfig.max_asesores_plan,
              max_asesores_final: nextPaymentConfig.max_asesores_final,
              precio_extra_por_asesor_plan:
                nextPaymentConfig.precio_extra_por_asesor_plan,
              precio_extra_por_asesor_final:
                nextPaymentConfig.precio_extra_por_asesor_final,
            }
          : null,
        acuerdoComercial: agreementForResponse
          ? {
              activo: agreementStatus === "vigente",
              estado: agreementStatus,
              id: String(agreementForResponse.id),
              tipo: agreementForResponse.tipo_acuerdo ?? null,
              plan_id: agreementForResponse.plan_id ?? null,
              fecha_inicio: agreementForResponse.fecha_inicio ?? null,
              fecha_fin: agreementForResponse.fecha_fin ?? null,
              modo_iva:
                agreementPricing?.modo_iva ?? agreementForResponse.modo_iva ?? null,
              iva_pct:
                agreementPricing?.iva_pct ?? agreementForResponse.iva_pct ?? null,
              precio_neto_final:
                agreementPricing?.precio_neto_final ??
                agreementForResponse.precio_neto_fijo ??
                null,
              precio_total_final:
                agreementPricing?.precio_total_final ??
                agreementForResponse.precio_neto_fijo ??
                null,
              max_asesores_final:
                agreementPricing?.max_asesores_final ??
                agreementForResponse.max_asesores_override ??
                null,
              precio_extra_por_asesor_final:
                agreementPricing?.precio_extra_por_asesor_final ??
                agreementForResponse.precio_extra_por_asesor_override ??
                null,
            }
          : {
              activo: false,
              estado: "sin_acuerdo",
              id: null,
              tipo: null,
              plan_id: null,
              fecha_inicio: null,
              fecha_fin: null,
            },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    console.error("billing/estado GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
