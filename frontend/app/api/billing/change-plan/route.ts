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

// ⚙️ flag de simulación: si es "true", marcamos el pago como OK y activamos el plan sin pasar por MP
const SIMULAR_PAGO_OK =
  process.env.NEXT_PUBLIC_BILLING_SIMULATE === "true";

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

/** Helper para activar inmediatamente el nuevo plan (simulando que el pago fue OK). */
async function simularActivarPlanInmediato(
  empresaId: string,
  nuevoPlanId: string,
  maxAsesoresOverride?: number
) {
  const nowISO = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);

  // 1) Desactivar el plan actual
  await supabaseAdmin
    .from("empresas_planes")
    .update({ activo: false, updated_at: nowISO })
    .eq("empresa_id", empresaId)
    .eq("activo", true);

  // 2) Ver si ya hay un registro para ese plan
  const { data: existente } = await supabaseAdmin
    .from("empresas_planes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("plan_id", nuevoPlanId)
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente?.id) {
    const patch: any = {
      activo: true,
      fecha_fin: null,
      updated_at: nowISO,
    };
    if (typeof maxAsesoresOverride === "number") {
      patch.max_asesores_override = maxAsesoresOverride;
    }

    await supabaseAdmin
      .from("empresas_planes")
      .update(patch)
      .eq("id", existente.id);
  } else {
    const insert: any = {
      empresa_id: empresaId,
      plan_id: nuevoPlanId,
      fecha_inicio: today,
      activo: true,
      updated_at: nowISO,
    };
    if (typeof maxAsesoresOverride === "number") {
      insert.max_asesores_override = maxAsesoresOverride;
    }

    await supabaseAdmin.from("empresas_planes").insert(insert);
  }
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
        title: "Upgrade de plan VAI",
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

    // 👇 máximo 1 cuota
    payment_methods: {
      installments: 1,
    },

    metadata: {
      movimiento_id: params.movimientoId,
      empresa_id: params.empresaId,
      tipo: "upgrade_plan",
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
    const url =
      prefJson.init_point ||
      prefJson.sandbox_init_point ||
      null;
    return typeof url === "string" ? url : null;
  } catch (err: any) {
    console.error("Excepción creando preferencia de MP:", err?.message);
    return null;
  }
}

/**
 * POST /api/billing/change-plan
 * Body: {
 *   nuevo_plan_id: string,
 *   empresa_id?: string,
 *   max_asesores_override?: number   // usado para plan "Personalizado"
 * }
 *
 * - Upgrade: crea movimiento 'ajuste' con metadata.subtipo = 'upgrade_prorrateo' (pending).
 *   En modo simulación también marca el movimiento como paid y activa el plan.
 *   En modo real crea un checkout de Mercado Pago y NO activa el plan (lo hará el webhook).
 *
 * - Downgrade: programa cambio al fin del ciclo en `suscripciones`
 *   (plan_proximo_id / cambio_programado_para).
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

    // Cliente con contexto del usuario (RLS ON) → auth + lecturas seguras
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

    // Estado actual (basado en empresas_planes + planes)
    const sus = await getSuscripcionEstado(supabase, empresaId);
    if (!sus?.plan_actual_id) {
      return NextResponse.json(
        { error: "Empresa sin plan actual/ciclo vigente para cambiar." },
        { status: 409 }
      );
    }

    const { ciclo_inicio, ciclo_fin, plan_actual_id } = sus;

    // Configuración ACTUAL:
    // - Sí considera acuerdo comercial vigente si existe
    const actualConfig = await resolveEmpresaBillingConfig({
      supabase,
      empresaId,
      planId: plan_actual_id,
    });

    // Configuración NUEVA:
    // - NO hereda automáticamente el acuerdo comercial actual
    // - Sí permite simular override de max asesores para "Personalizado"
    const nuevoConfig = await resolveEmpresaBillingConfig({
      supabase,
      empresaId,
      planId: nuevoPlanId,
      maxAsesoresOverride,
      forzarSinAcuerdo: true,
    });

    const precioActual = round2(actualConfig.precio_neto_final);
    const precioNuevo = round2(nuevoConfig.precio_neto_final);

    const isUpgrade = precioNuevo > precioActual;
    const isDowngrade = precioNuevo < precioActual;
    const isTrialOrFree = precioActual <= 0;

    // -------------------------
    // UPGRADE → crear movimiento financiero 'ajuste' (subtipo upgrade_prorrateo)
    // -------------------------
    if (isUpgrade) {
      const dias = calcularDiasCicloYRestantes({
        cicloInicioISO: ciclo_inicio,
        cicloFinISO: ciclo_fin,
      });

      const needsFullCycle = isTrialOrFree || dias.diasRestantes <= 0;

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

      // Idempotencia: buscamos un movimiento pending del ciclo con este subtipo
      // ⚠️ Usamos supabaseAdmin para evitar RLS en movimientos_financieros
      const { data: existing, error: exErr } = await supabaseAdmin
        .from("movimientos_financieros")
        .select("id, estado, metadata")
        .eq("empresa_id", empresaId)
        .eq("tipo", "ajuste")
        .eq("estado", "pending")
        .contains("metadata", { subtipo: "upgrade_prorrateo" })
        .gte("fecha", ciclo_inicio)
        .lte("fecha", ciclo_fin);

      if (exErr) {
        return NextResponse.json(
          {
            error: "Error buscando movimientos existentes",
            detail: exErr.message,
          },
          { status: 500 }
        );
      }

      // ⚠️ Caso: ya hay un movimiento pending en este ciclo
      if (existing && existing.length > 0) {
        const existingId = existing[0].id as string;
        let checkoutUrl: string | null = null;

        if (SIMULAR_PAGO_OK && existingId) {
          const nowISO = new Date().toISOString();

          // Marcar ese movimiento como paid
          await supabaseAdmin
            .from("movimientos_financieros")
            .update({ estado: "paid", updated_at: nowISO })
            .eq("id", existingId);

          // Activar inmediatamente el nuevo plan
          await simularActivarPlanInmediato(
            empresaId,
            nuevoPlanId,
            maxAsesoresOverride
          );
        } else if (existingId) {
          // Modo REAL → crear preferencia de MP
          checkoutUrl = await crearPreferenciaMercadoPago({
            movimientoId: existingId,
            empresaId,
            totalConIVA: total,
          });
        }

        return NextResponse.json(
          {
            accion: "upgrade",
            movimiento_id: existingId,
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
            nota: SIMULAR_PAGO_OK
              ? "Simulación: se reutilizó el movimiento pendiente existente, se marcó como 'paid' y el nuevo plan ya está activo."
              : "Movimiento pendiente existente reutilizado. Tras el pago en Mercado Pago, el plan se activará vía webhook.",
          },
          { status: 200 }
        );
      }

      // Crear nuevo movimiento pending
      const metadata: any = {
        subtipo: "upgrade_prorrateo",
        plan_actual_id,
        nuevo_plan_id: nuevoPlanId,
        ciclo_inicio,
        ciclo_fin,
        dias_ciclo: dias.diasCiclo,
        dias_restantes: needsFullCycle ? dias.diasCiclo : dias.diasRestantes,
        factor,
        iva: round2(iva),
        total: round2(total),
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
      };

      if (typeof maxAsesoresOverride === "number") {
        metadata.max_asesores_override = maxAsesoresOverride;
      }

      const { data: ins, error: insErr } = await supabaseAdmin
        .from("movimientos_financieros")
        .insert([
          {
            empresa_id: empresaId,
            tipo: "ajuste", // ✅ permitido por el CHECK
            estado: "pending",
            fecha: new Date().toISOString(),
            moneda: "ARS",
            monto_neto: round2(deltaNeto),
            iva: round2(iva),
            total: round2(total),
            descripcion: needsFullCycle
              ? "Upgrade de plan (ciclo completo)"
              : "Upgrade de plan prorrateado",
            metadata,
          },
        ])
        .select("id")
        .single();

      if (insErr) {
        return NextResponse.json(
          {
            error: "No se pudo crear el movimiento de prorrateo",
            detail: insErr.message,
          },
          { status: 500 }
        );
      }

      let checkoutUrl: string | null = null;

      // 🔧 SIMULACIÓN DE PAGO OK: marcamos el movimiento como paid
      // y activamos el nuevo plan inmediatamente.
      if (SIMULAR_PAGO_OK && ins?.id) {
        const nowISO = new Date().toISOString();

        await supabaseAdmin
          .from("movimientos_financieros")
          .update({ estado: "paid", updated_at: nowISO })
          .eq("id", ins.id);

        await simularActivarPlanInmediato(
          empresaId,
          nuevoPlanId,
          maxAsesoresOverride
        );
      } else if (ins?.id) {
        // Modo REAL → crear preferencia de MP
        checkoutUrl = await crearPreferenciaMercadoPago({
          movimientoId: ins.id,
          empresaId,
          totalConIVA: total,
        });
      }

      return NextResponse.json(
        {
          accion: "upgrade",
          movimiento_id: ins?.id ?? null,
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
          nota: SIMULAR_PAGO_OK
            ? "Simulación: el pago se marcó como 'paid' y el nuevo plan ya está activo."
            : needsFullCycle
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
      // ⚠️ Usamos supabaseAdmin para evitar RLS en suscripciones
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
    // Mismo precio → no hay cambio financiero
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
