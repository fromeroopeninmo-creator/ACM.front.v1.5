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

export async function GET(req: Request) {
  try {
    // 1) Auth + contexto
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

    // 2) Admin / soporte: pueden pasar empresaId por querystring
    if (isAdminLike && empresaIdParam) {
      empresaId = empresaIdParam;
    }

    // 3) Empresa / Asesor: resolver empresa propia ignorando empresaIdParam
    if (!isAdminLike) {
      const a: any = actor;

      const actorUserId = a.userId ?? a.id ?? a.sub ?? null;

      // 3.1: intentar siempre primero desde profiles.empresa_id
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

      // 3.2: fallback para EMPRESA → tabla empresas.user_id
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

      // 3.3: fallback para ASESOR → tabla asesores.email
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

    // 4) Verificar empresa existente (incluye suspensión)
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

    // 5) Plan activo o último por fecha_inicio
    const { data: activo } = await supabaseAdmin
      .from("empresas_planes")
      .select(
        "id, plan_id, fecha_inicio, fecha_fin, activo, max_asesores_override"
      )
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .maybeSingle();

    let planEP = activo;
    if (!planEP) {
      const { data: ultimo } = await supabaseAdmin
        .from("empresas_planes")
        .select(
          "id, plan_id, fecha_inicio, fecha_fin, activo, max_asesores_override"
        )
        .eq("empresa_id", empresaId)
        .order("fecha_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      planEP = ultimo ?? null;
    }

    // Vista de suscripción/“próximo plan”
    const { data: vEstado } = await supabaseAdmin
      .from("v_suscripcion_estado")
      .select("plan_proximo_id, plan_proximo_nombre, cambio_programado_para")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    // 6) Flags de ciclo / vencimiento
    const now = new Date();
    let plan_vencido = false;
    let dias_desde_vencimiento: number | null = null;
    let en_periodo_gracia = false;
    let proximoCobro: string | null = null;

    if (planEP?.fecha_fin) {
      const fin = new Date(planEP.fecha_fin as string);
      if (!Number.isNaN(fin.getTime())) {
        proximoCobro = fin.toISOString();
        const diffMs = now.getTime() - fin.getTime(); // >0 si ya venció
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        dias_desde_vencimiento = diffDays;

        if (diffDays >= 0) {
          plan_vencido = true;
          en_periodo_gracia = diffDays <= 2;
        }
      }
    } else if (planEP?.fecha_inicio) {
      // Estimar fecha_fin con duracion_dias si no existe
      const { data: planRowDur, error: planErrDur } = await supabaseAdmin
        .from("planes")
        .select("duracion_dias")
        .eq("id", planEP.plan_id)
        .maybeSingle();

      if (!planErrDur && planRowDur?.duracion_dias) {
        try {
          const base = new Date(planEP.fecha_inicio as string);
          const d = new Date(base.getTime());
          d.setDate(d.getDate() + Number(planRowDur.duracion_dias));
          proximoCobro = d.toISOString();
        } catch {
          proximoCobro = null;
        }
      }
    }

    if (!planEP) {
      const suspendidaSinPlan = true;
      const suspensionMotivoSinPlan =
        empRow.suspension_motivo ??
        "Sin plan activo. Debe seleccionar un plan para continuar.";

      // No hay registro en empresas_planes → empresa sin cobertura
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
          },
          // Nuevo bloque: features por defecto cuando no hay plan
          features: {
            tipo_plan: null,
            incluye_valuador: false,
            incluye_tracker: false,
          },
          // Nuevo bloque: pricing / acuerdo comercial cuando no hay plan
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

    // 7) Datos del plan (precio + tipo_plan / features)
    const { data: planRow, error: planErr } = await supabaseAdmin
      .from("planes")
      .select(
        "id, nombre, precio, duracion_dias, max_asesores, precio_extra_por_asesor, tipo_plan, incluye_valuador, incluye_tracker, es_trial"
      )
      .eq("id", planEP.plan_id)
      .maybeSingle();

    if (planErr) {
      return NextResponse.json({ error: planErr.message }, { status: 400 });
    }

    // 7.1) Resolución central de billing (precio/cupo/IVA/acuerdo)
    const billingConfig = await resolveEmpresaBillingConfig({
      supabase: supabaseAdmin,
      empresaId,
      planId: planEP.plan_id,
      maxAsesoresOverride:
        planEP.max_asesores_override == null
          ? null
          : Number(planEP.max_asesores_override),
    });

    // Compatibilidad con payload previo
    const precioNeto = toNum(billingConfig.precio_neto_final);
    const iva = toNum(billingConfig.iva_importe);
    const totalConIVA = toNum(billingConfig.precio_total_final);

    // 8) Última suscripción si existe
    const { data: susRow } = await supabaseAdmin
      .from("suscripciones")
      .select(
        "estado, inicio, fin, externo_customer_id, externo_subscription_id"
      )
      .eq("empresa_id", empresaId)
      .order("inicio", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 9) Si billingConfig ya resolvió ciclo, priorizarlo.
    // Si no, usar el cálculo / fallback actual.
    const cicloInicio = billingConfig.ciclo_inicio ?? planEP.fecha_inicio ?? null;
    const cicloFin = billingConfig.ciclo_fin ?? planEP.fecha_fin ?? null;

    if (!proximoCobro) {
      if (cicloFin) {
        try {
          proximoCobro = new Date(cicloFin as string).toISOString();
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
    }

    // Normalizamos flags de features para que siempre haya algo consistente
    const tipoPlan = planRow?.tipo_plan ?? null;
    const incluyeValuador = !!planRow?.incluye_valuador;
    const incluyeTracker = !!planRow?.incluye_tracker;

    return NextResponse.json(
      {
        plan: planRow
          ? {
              id: planRow.id,
              nombre: planRow.nombre,

              // Compatibilidad payload anterior
              precioNeto,
              totalConIVA,

              // Nuevo detalle de pricing
              precioBaseNeto: billingConfig.precio_base_neto,
              precioNetoFinal: billingConfig.precio_neto_final,
              ivaModo: billingConfig.modo_iva,
              ivaPct: billingConfig.iva_pct,
              ivaImporte: billingConfig.iva_importe,
              precioTotalFinal: billingConfig.precio_total_final,
              pricingSource: billingConfig.pricing_source,

              // info del tipo de plan / features
              tipo_plan: tipoPlan, // "core" | "combo" | "tracker_only" | "trial"
              incluye_valuador: incluyeValuador,
              incluye_tracker: incluyeTracker,
              es_trial: billingConfig.plan_es_trial ?? !!planRow.es_trial,
              duracion_dias:
                billingConfig.plan_duracion_dias ??
                (planRow?.duracion_dias == null ? null : Number(planRow.duracion_dias)),
            }
          : null,
        ciclo: {
          inicio: cicloInicio,
          fin: cicloFin,
          proximoCobro,
        },
        suscripcion: susRow
          ? {
              estado: susRow.estado, // activa | suspendida | cancelada | pendiente
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
          suspendida: !!empRow.suspendida,
          suspendida_motivo: empRow.suspension_motivo ?? null,
          suspendida_at: empRow.suspendida_at ?? null,
          plan_vencido,
          dias_desde_vencimiento,
          en_periodo_gracia,
          requiere_seleccion_plan: false,
        },
        // bloque explícito de features del plan actual
        features: {
          tipo_plan: tipoPlan,
          incluye_valuador: incluyeValuador,
          incluye_tracker: incluyeTracker,
        },
        // Nuevo bloque explícito de pricing
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
        // Nuevo bloque explícito de cupos
        cupos: {
          max_asesores_plan: billingConfig.max_asesores_plan,
          max_asesores_final: billingConfig.max_asesores_final,
          precio_extra_por_asesor_plan:
            billingConfig.precio_extra_por_asesor_plan,
          precio_extra_por_asesor_final:
            billingConfig.precio_extra_por_asesor_final,
        },
        // Nuevo bloque explícito de acuerdo comercial
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
