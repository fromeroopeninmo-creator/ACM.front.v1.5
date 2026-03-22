// app/api/billing/change-plan/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import {
  assertAuthAndGetContext,
  getEmpresaIdForActor,
  getSuscripcionEstado,
  resolveEmpresaBillingConfig,
  round2,
} from "#lib/billing/utils";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

// Helper: base URL pública (para back_urls de Mercado Pago)
function getBaseUrl(): string | null {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;
  if (!envUrl) return null;
  return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
}

function calcularDiasCicloYRestantes(params: {
  cicloInicioISO: string;
  cicloFinISO: string;
}) {
  const inicio = new Date(params.cicloInicioISO).getTime();
  const fin = new Date(params.cicloFinISO).getTime();
  const ahora = Date.now();

  const msCiclo = Math.max(fin - inicio, 0);
  const msRest = Math.max(fin - ahora, 0);

  const diasCiclo = Math.max(Math.ceil(msCiclo / 86400000), 0);
  const diasRestantes = Math.max(Math.ceil(msRest / 86400000), 0);
  const factor = diasCiclo > 0 ? diasRestantes / diasCiclo : 0;

  return { diasCiclo, diasRestantes, factor };
}

function calcularImporteFiscalDesdeModo(params: {
  precioBase: number;
  modoIva: "sumar_al_neto" | "incluido_en_precio" | "no_aplica";
  ivaPct: number;
}) {
  const base = round2(Number(params.precioBase ?? 0));
  const modo = params.modoIva;
  const ivaPct = Number(params.ivaPct ?? 21);
  const tasa = ivaPct / 100;

  if (modo === "no_aplica") {
    return {
      neto: round2(base),
      iva: 0,
      total: round2(base),
    };
  }

  if (modo === "incluido_en_precio") {
    if (tasa <= 0) {
      return {
        neto: round2(base),
        iva: 0,
        total: round2(base),
      };
    }

    const neto = base / (1 + tasa);
    const iva = base - neto;

    return {
      neto: round2(neto),
      iva: round2(iva),
      total: round2(base),
    };
  }

  const iva = base * tasa;
  return {
    neto: round2(base),
    iva: round2(iva),
    total: round2(base + iva),
  };
}

/** Helper para crear preferencia de Mercado Pago y devolver checkoutUrl. */
async function crearPreferenciaMercadoPago(params: {
  movimientoId: string;
  empresaId: string;
  totalConIVA: number;
}): Promise<string | null> {
  const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!mpAccessToken) {
    console.warn(
      "MERCADOPAGO_ACCESS_TOKEN no configurado; no se genera checkout de MP."
    );
    return null;
  }

  const baseUrl = getBaseUrl();
  const amountTotal = round2(params.totalConIVA);

  const prefBody = {
    items: [
      {
        title: "Suscripción / cambio de plan VAI",
        quantity: 1,
        currency_id: "ARS",
        unit_price: amountTotal,
      },
    ],
    external_reference: params.movimientoId,
    back_urls: baseUrl
      ? {
          success: `${baseUrl}/dashboard/empresa/planes?mp_status=success`,
          failure: `${baseUrl}/dashboard/empresa/planes?mp_status=failure`,
          pending: `${baseUrl}/dashboard/empresa/planes?mp_status=pending`,
        }
      : undefined,
    auto_return: "approved",
    payment_methods: {
      installments: 1,
    },
    metadata: {
      movimiento_id: params.movimientoId,
      empresa_id: params.empresaId,
      tipo: "billing_plan",
    },
  };

  try {
    const mpRes = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mpAccessToken}`,
        },
        body: JSON.stringify(prefBody),
      }
    );

    if (!mpRes.ok) {
      const txt = await mpRes.text().catch(() => "");
      console.error(
        "Error creando preferencia de Mercado Pago:",
        mpRes.status,
        txt
      );
      return null;
    }

    const prefJson = (await mpRes.json()) as any;
    const url = prefJson.init_point || prefJson.sandbox_init_point || null;
    return typeof url === "string" ? url : null;
  } catch (err: any) {
    console.error("Excepción creando preferencia de MP:", err?.message);
    return null;
  }
}

/** Busca un movimiento pending reutilizable del ciclo actual. */
async function buscarMovimientoPending(params: {
  empresaId: string;
  cicloInicio: string;
  cicloFin: string;
  subtipo: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("movimientos_financieros")
    .select("id, estado, metadata, total, monto_neto, iva")
    .eq("empresa_id", params.empresaId)
    .eq("tipo", "ajuste")
    .eq("estado", "pending")
    .contains("metadata", { subtipo: params.subtipo })
    .gte("fecha", params.cicloInicio)
    .lte("fecha", params.cicloFin);

  if (error) {
    throw new Error(`Error buscando movimientos existentes: ${error.message}`);
  }

  return data && data.length > 0 ? data[0] : null;
}

/** Crea un movimiento pending para checkout. */
async function crearMovimientoPending(params: {
  empresaId: string;
  descripcion: string;
  cicloInicio: string;
  cicloFin: string;
  subtipo: string;
  planActualId: string;
  nuevoPlanId: string;
  deltaNeto: number;
  iva: number;
  total: number;
  diasCiclo: number;
  diasRestantes: number;
  factor: number;
  maxAsesoresOverride?: number;
  actualConfig: any;
  nuevoConfig: any;
}) {
  const metadata: any = {
    subtipo: params.subtipo,
    plan_actual_id: params.planActualId,
    nuevo_plan_id: params.nuevoPlanId,
    ciclo_inicio: params.cicloInicio,
    ciclo_fin: params.cicloFin,
    dias_ciclo: params.diasCiclo,
    dias_restantes: params.diasRestantes,
    factor: params.factor,
    iva: round2(params.iva),
    total: round2(params.total),
    pricing_actual: {
      precio_base_neto: params.actualConfig.precio_base_neto,
      precio_neto_final: params.actualConfig.precio_neto_final,
      modo_iva: params.actualConfig.modo_iva,
      iva_pct: params.actualConfig.iva_pct,
      iva_importe: params.actualConfig.iva_importe,
      precio_total_final: params.actualConfig.precio_total_final,
      pricing_source: params.actualConfig.pricing_source,
      agreement_applied: params.actualConfig.agreement_applied,
      agreement_id: params.actualConfig.agreement_id,
      agreement_tipo: params.actualConfig.agreement_tipo,
    },
    pricing_nuevo: {
      precio_base_neto: params.nuevoConfig.precio_base_neto,
      precio_neto_final: params.nuevoConfig.precio_neto_final,
      modo_iva: params.nuevoConfig.modo_iva,
      iva_pct: params.nuevoConfig.iva_pct,
      iva_importe: params.nuevoConfig.iva_importe,
      precio_total_final: params.nuevoConfig.precio_total_final,
      pricing_source: params.nuevoConfig.pricing_source,
      agreement_applied: params.nuevoConfig.agreement_applied,
      agreement_id: params.nuevoConfig.agreement_id,
      agreement_tipo: params.nuevoConfig.agreement_tipo,
    },
  };

  if (typeof params.maxAsesoresOverride === "number") {
    metadata.max_asesores_override = params.maxAsesoresOverride;
  }

  const { data, error } = await supabaseAdmin
    .from("movimientos_financieros")
    .insert([
      {
        empresa_id: params.empresaId,
        tipo: "ajuste",
        estado: "pending",
        fecha: new Date().toISOString(),
        moneda: "ARS",
        monto_neto: round2(params.deltaNeto),
        iva: round2(params.iva),
        total: round2(params.total),
        descripcion: params.descripcion,
        metadata,
      },
    ])
    .select("id")
    .single();

  if (error) {
    throw new Error(`No se pudo crear el movimiento de cobro: ${error.message}`);
  }

  return data?.id ?? null;
}

/**
 * POST /api/billing/change-plan
 * Body: {
 *   nuevo_plan_id: string,
 *   empresa_id?: string,
 *   max_asesores_override?: number
 * }
 *
 * Reglas:
 * - Nunca activa plan sin pago.
 * - Upgrade: checkout por diferencia o ciclo completo.
 * - Mismo plan vencido: checkout de renovación del ciclo completo.
 * - Downgrade: programa el cambio al próximo ciclo.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const nuevoPlanId: string | undefined = body?.nuevo_plan_id;
    const empresaIdParam: string | undefined = body?.empresa_id;
    const maxAsesoresOverrideRaw = body?.max_asesores_override;
    const maxAsesoresOverride =
      maxAsesoresOverrideRaw != null && !Number.isNaN(Number(maxAsesoresOverrideRaw))
        ? Number(maxAsesoresOverrideRaw)
        : undefined;

    if (!nuevoPlanId) {
      return NextResponse.json(
        { error: "nuevo_plan_id es obligatorio" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();
    const ctx = await assertAuthAndGetContext(supabase);
    const empresaId = await getEmpresaIdForActor({
      supabase,
      actor: ctx,
      empresaIdParam,
    });

    if (!empresaId) {
      return NextResponse.json(
        { error: "No se pudo resolver empresa_id (ver permisos / profiles)." },
        { status: 403 }
      );
    }

    const sus = await getSuscripcionEstado(supabase, empresaId);
    if (!sus?.plan_actual_id || !sus?.ciclo_inicio || !sus?.ciclo_fin) {
      return NextResponse.json(
        {
          error:
            "Empresa sin plan actual o sin ciclo vigente completo para cambiar.",
        },
        { status: 409 }
      );
    }

    const { ciclo_inicio, ciclo_fin, plan_actual_id } = sus;

    const actualConfig = await resolveEmpresaBillingConfig({
      supabase,
      empresaId,
      planId: plan_actual_id,
    });

    const nuevoConfig = await resolveEmpresaBillingConfig({
      supabase,
      empresaId,
      planId: nuevoPlanId,
      maxAsesoresOverride,
      forzarSinAcuerdo: true,
    });

    const precioActual = round2(actualConfig.precio_neto_final);
    const precioNuevo = round2(nuevoConfig.precio_neto_final);

    const dias = calcularDiasCicloYRestantes({
      cicloInicioISO: ciclo_inicio,
      cicloFinISO: ciclo_fin,
    });

    const cicloVencido = dias.diasRestantes <= 0;
    const isUpgrade = precioNuevo > precioActual;
    const isDowngrade = precioNuevo < precioActual;
    const isSamePlan = nuevoPlanId === plan_actual_id;
    const isTrialOrFree = precioActual <= 0;

    // -------------------------
    // MISMO PLAN VENCIDO → generar checkout de renovación
    // -------------------------
    if (isSamePlan && cicloVencido) {
      const existing = await buscarMovimientoPending({
        empresaId,
        cicloInicio: ciclo_inicio,
        cicloFin: ciclo_fin,
        subtipo: "renovacion_ciclo",
      });

      if (existing?.id) {
        const checkoutUrl = await crearPreferenciaMercadoPago({
          movimientoId: existing.id as string,
          empresaId,
          totalConIVA: Number(existing.total ?? actualConfig.precio_total_final ?? 0),
        });

        return NextResponse.json(
          {
            accion: "renovacion",
            movimiento_id: existing.id,
            checkoutUrl,
            delta: {
              neto: round2(Number(existing.monto_neto ?? actualConfig.precio_neto_final ?? 0)),
              iva: round2(Number(existing.iva ?? actualConfig.iva_importe ?? 0)),
              total: round2(Number(existing.total ?? actualConfig.precio_total_final ?? 0)),
              moneda: "ARS",
            },
            nota: "Se reutilizó un checkout pendiente de renovación.",
          },
          { status: 200 }
        );
      }

      const movimientoId = await crearMovimientoPending({
        empresaId,
        descripcion: "Renovación de plan (ciclo completo)",
        cicloInicio: ciclo_inicio,
        cicloFin: ciclo_fin,
        subtipo: "renovacion_ciclo",
        planActualId: plan_actual_id,
        nuevoPlanId,
        deltaNeto: round2(actualConfig.precio_neto_final),
        iva: round2(actualConfig.iva_importe),
        total: round2(actualConfig.precio_total_final),
        diasCiclo: dias.diasCiclo,
        diasRestantes: 0,
        factor: 1,
        maxAsesoresOverride,
        actualConfig,
        nuevoConfig: actualConfig,
      });

      const checkoutUrl = await crearPreferenciaMercadoPago({
        movimientoId: movimientoId as string,
        empresaId,
        totalConIVA: actualConfig.precio_total_final,
      });

      return NextResponse.json(
        {
          accion: "renovacion",
          movimiento_id: movimientoId,
          checkoutUrl,
          delta: {
            neto: round2(actualConfig.precio_neto_final),
            iva: round2(actualConfig.iva_importe),
            total: round2(actualConfig.precio_total_final),
            moneda: "ARS",
          },
          nota: "Se generó el checkout de renovación del plan actual.",
        },
        { status: 200 }
      );
    }

    // -------------------------
    // UPGRADE → checkout
    // -------------------------
    if (isUpgrade) {
      const needsFullCycle = isTrialOrFree || cicloVencido;

      let deltaNeto = 0;
      let iva = 0;
      let total = 0;
      let factor = dias.factor;

      if (needsFullCycle) {
        deltaNeto = round2(nuevoConfig.precio_neto_final);
        iva = round2(nuevoConfig.iva_importe);
        total = round2(nuevoConfig.precio_total_final);
        factor = 1;
      } else {
        const deltaBase = Math.max(precioNuevo - precioActual, 0);
        const deltaProrrateado = round2(deltaBase * dias.factor);

        const fiscal = calcularImporteFiscalDesdeModo({
          precioBase: deltaProrrateado,
          modoIva: nuevoConfig.modo_iva,
          ivaPct: nuevoConfig.iva_pct,
        });

        deltaNeto = round2(fiscal.neto);
        iva = round2(fiscal.iva);
        total = round2(fiscal.total);
      }

      const existing = await buscarMovimientoPending({
        empresaId,
        cicloInicio: ciclo_inicio,
        cicloFin: ciclo_fin,
        subtipo: "upgrade_prorrateo",
      });

      if (existing?.id) {
        const checkoutUrl = await crearPreferenciaMercadoPago({
          movimientoId: existing.id as string,
          empresaId,
          totalConIVA: total,
        });

        return NextResponse.json(
          {
            accion: "upgrade",
            movimiento_id: existing.id,
            checkoutUrl,
            delta: {
              neto: round2(deltaNeto),
              iva: round2(iva),
              total: round2(total),
              moneda: "ARS",
            },
            pricing_actual: {
              precio_base_neto: actualConfig.precio_base_neto,
              precio_neto_final: actualConfig.precio_neto_final,
              modo_iva: actualConfig.modo_iva,
              iva_pct: actualConfig.iva_pct,
              iva_importe: actualConfig.iva_importe,
              precio_total_final: actualConfig.precio_total_final,
              pricing_source: actualConfig.pricing_source,
              agreement_applied: actualConfig.agreement_applied,
              agreement_id: actualConfig.agreement_id,
              agreement_tipo: actualConfig.agreement_tipo,
            },
            pricing_nuevo: {
              precio_base_neto: nuevoConfig.precio_base_neto,
              precio_neto_final: nuevoConfig.precio_neto_final,
              modo_iva: nuevoConfig.modo_iva,
              iva_pct: nuevoConfig.iva_pct,
              iva_importe: nuevoConfig.iva_importe,
              precio_total_final: nuevoConfig.precio_total_final,
              pricing_source: nuevoConfig.pricing_source,
              agreement_applied: nuevoConfig.agreement_applied,
              agreement_id: nuevoConfig.agreement_id,
              agreement_tipo: nuevoConfig.agreement_tipo,
            },
            nota: "Movimiento pendiente existente reutilizado. Tras el pago en Mercado Pago, el plan se activará vía webhook.",
          },
          { status: 200 }
        );
      }

      const movimientoId = await crearMovimientoPending({
        empresaId,
        descripcion: needsFullCycle
          ? "Upgrade de plan (ciclo completo)"
          : "Upgrade de plan prorrateado",
        cicloInicio: ciclo_inicio,
        cicloFin: ciclo_fin,
        subtipo: "upgrade_prorrateo",
        planActualId: plan_actual_id,
        nuevoPlanId,
        deltaNeto,
        iva,
        total,
        diasCiclo: dias.diasCiclo,
        diasRestantes: needsFullCycle ? dias.diasCiclo : dias.diasRestantes,
        factor,
        maxAsesoresOverride,
        actualConfig,
        nuevoConfig,
      });

      const checkoutUrl = await crearPreferenciaMercadoPago({
        movimientoId: movimientoId as string,
        empresaId,
        totalConIVA: total,
      });

      return NextResponse.json(
        {
          accion: "upgrade",
          movimiento_id: movimientoId,
          checkoutUrl,
          delta: {
            neto: round2(deltaNeto),
            iva: round2(iva),
            total: round2(total),
            moneda: "ARS",
          },
          pricing_actual: {
            precio_base_neto: actualConfig.precio_base_neto,
            precio_neto_final: actualConfig.precio_neto_final,
            modo_iva: actualConfig.modo_iva,
            iva_pct: actualConfig.iva_pct,
            iva_importe: actualConfig.iva_importe,
            precio_total_final: actualConfig.precio_total_final,
            pricing_source: actualConfig.pricing_source,
            agreement_applied: actualConfig.agreement_applied,
            agreement_id: actualConfig.agreement_id,
            agreement_tipo: actualConfig.agreement_tipo,
          },
          pricing_nuevo: {
            precio_base_neto: nuevoConfig.precio_base_neto,
            precio_neto_final: nuevoConfig.precio_neto_final,
            modo_iva: nuevoConfig.modo_iva,
            iva_pct: nuevoConfig.iva_pct,
            iva_importe: nuevoConfig.iva_importe,
            precio_total_final: nuevoConfig.precio_total_final,
            pricing_source: nuevoConfig.pricing_source,
            agreement_applied: nuevoConfig.agreement_applied,
            agreement_id: nuevoConfig.agreement_id,
            agreement_tipo: nuevoConfig.agreement_tipo,
          },
          nota: needsFullCycle
            ? "Al completar el pago en Mercado Pago, el nuevo plan se activará por el valor completo del ciclo."
            : "Al completar el pago en Mercado Pago, el nuevo plan se activará con el prorrateo de la diferencia.",
        },
        { status: 200 }
      );
    }

    // -------------------------
    // DOWNGRADE → programar cambio al fin del ciclo
    // -------------------------
    if (isDowngrade) {
      const { error: updErr } = await supabaseAdmin
        .from("suscripciones")
        .update({
          plan_proximo_id: nuevoPlanId,
          cambio_programado_para: ciclo_fin,
        })
        .eq("empresa_id", empresaId);

      if (updErr) {
        return NextResponse.json(
          {
            error: "No se pudo programar el downgrade",
            detail: updErr.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          accion: "downgrade",
          scheduled: true,
          aplica_desde: ciclo_fin,
          proximo_plan_id: nuevoPlanId,
          pricing_actual: {
            precio_base_neto: actualConfig.precio_base_neto,
            precio_neto_final: actualConfig.precio_neto_final,
            modo_iva: actualConfig.modo_iva,
            iva_pct: actualConfig.iva_pct,
            iva_importe: actualConfig.iva_importe,
            precio_total_final: actualConfig.precio_total_final,
            pricing_source: actualConfig.pricing_source,
            agreement_applied: actualConfig.agreement_applied,
            agreement_id: actualConfig.agreement_id,
            agreement_tipo: actualConfig.agreement_tipo,
          },
          pricing_nuevo: {
            precio_base_neto: nuevoConfig.precio_base_neto,
            precio_neto_final: nuevoConfig.precio_neto_final,
            modo_iva: nuevoConfig.modo_iva,
            iva_pct: nuevoConfig.iva_pct,
            iva_importe: nuevoConfig.iva_importe,
            precio_total_final: nuevoConfig.precio_total_final,
            pricing_source: nuevoConfig.pricing_source,
            agreement_applied: nuevoConfig.agreement_applied,
            agreement_id: nuevoConfig.agreement_id,
            agreement_tipo: nuevoConfig.agreement_tipo,
          },
        },
        { status: 200 }
      );
    }

    // -------------------------
    // MISMO PRECIO Y NO VENCIDO → no hay cambio financiero
    // -------------------------
    return NextResponse.json(
      {
        accion: "sin_cambio",
        mensaje: "El nuevo plan tiene el mismo precio que el actual.",
        pricing_actual: {
          precio_base_neto: actualConfig.precio_base_neto,
          precio_neto_final: actualConfig.precio_neto_final,
          modo_iva: actualConfig.modo_iva,
          iva_pct: actualConfig.iva_pct,
          iva_importe: actualConfig.iva_importe,
          precio_total_final: actualConfig.precio_total_final,
          pricing_source: actualConfig.pricing_source,
          agreement_applied: actualConfig.agreement_applied,
          agreement_id: actualConfig.agreement_id,
          agreement_tipo: actualConfig.agreement_tipo,
        },
        pricing_nuevo: {
          precio_base_neto: nuevoConfig.precio_base_neto,
          precio_neto_final: nuevoConfig.precio_neto_final,
          modo_iva: nuevoConfig.modo_iva,
          iva_pct: nuevoConfig.iva_pct,
          iva_importe: nuevoConfig.iva_importe,
          precio_total_final: nuevoConfig.precio_total_final,
          pricing_source: nuevoConfig.pricing_source,
          agreement_applied: nuevoConfig.agreement_applied,
          agreement_id: nuevoConfig.agreement_id,
          agreement_tipo: nuevoConfig.agreement_tipo,
        },
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
