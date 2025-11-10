// app/api/pagos/webhook/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

// Token de Mercado Pago (backend)
const MP_ACCESS_TOKEN =
  process.env.MERCADOPAGO_ACCESS_TOKEN ||
  process.env.MP_ACCESS_TOKEN ||
  "";

type SuscripcionEstado = "activa" | "suspendida" | "cancelada" | "pendiente";

type SuscripcionRow = {
  id: string;
  empresa_id: string;
  plan_id: string;
  estado: SuscripcionEstado;
  inicio: string | null;
};

function nowISO() {
  return new Date().toISOString();
}

// -----------------------------
// Helpers de suscripciones (por si en el futuro tenés suscripciones reales)
// -----------------------------
async function findSuscripcion(data: any): Promise<SuscripcionRow | null> {
  // 1) Por id propio
  if (data?.suscripcionId) {
    const { data: row } = await supabaseAdmin
      .from("suscripciones")
      .select("id, empresa_id, plan_id, estado, inicio")
      .eq("id", data.suscripcionId)
      .maybeSingle();
    if (row) return row as SuscripcionRow;
  }

  if (data?.suscripcion_id) {
    const { data: row } = await supabaseAdmin
      .from("suscripciones")
      .select("id, empresa_id, plan_id, estado, inicio")
      .eq("id", data.suscripcion_id)
      .maybeSingle();
    if (row) return row as SuscripcionRow;
  }

  // 2) Por externo_subscription_id
  if (data?.externoSubscriptionId) {
    const { data: row } = await supabaseAdmin
      .from("suscripciones")
      .select("id, empresa_id, plan_id, estado, inicio")
      .eq("externo_subscription_id", data.externoSubscriptionId)
      .order("inicio", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (row) return row as SuscripcionRow;
  }

  // 3) Fallback: por empresaId + planId
  if (data?.empresaId && data?.planId) {
    const { data: row } = await supabaseAdmin
      .from("suscripciones")
      .select("id, empresa_id, plan_id, estado, inicio")
      .eq("empresa_id", data.empresaId)
      .eq("plan_id", data.planId)
      .order("inicio", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (row) return row as SuscripcionRow;
  }

  return null;
}

// -----------------------------
// Helpers de planes en empresas_planes
// -----------------------------
async function activatePlan(
  empresaId: string,
  planId: string,
  maxAsesoresOverride?: number
) {
  const nowIso = nowISO();
  const today = nowIso.slice(0, 10);

  // 1) Desactivar cualquier plan activo actual
  await supabaseAdmin
    .from("empresas_planes")
    .update({ activo: false, updated_at: nowIso })
    .eq("empresa_id", empresaId)
    .eq("activo", true);

  // 2) Reactivar si ya existía ese plan
  const { data: existente } = await supabaseAdmin
    .from("empresas_planes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("plan_id", planId)
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente?.id) {
    const patch: any = {
      activo: true,
      fecha_fin: null,
      updated_at: nowIso,
    };
    if (typeof maxAsesoresOverride === "number") {
      patch.max_asesores_override = maxAsesoresOverride;
    }

    await supabaseAdmin
      .from("empresas_planes")
      .update(patch)
      .eq("id", existente.id);
    return existente.id as string;
  } else {
    const insert: any = {
      empresa_id: empresaId,
      plan_id: planId,
      fecha_inicio: today,
      activo: true,
      updated_at: nowIso,
    };
    if (typeof maxAsesoresOverride === "number") {
      insert.max_asesores_override = maxAsesoresOverride;
    }

    const { data: inserted } = await supabaseAdmin
      .from("empresas_planes")
      .insert(insert)
      .select("id")
      .maybeSingle();
    return inserted?.id ?? null;
  }
}

async function suspendPlan(empresaId: string) {
  await supabaseAdmin
    .from("empresas_planes")
    .update({ activo: false, updated_at: nowISO() })
    .eq("empresa_id", empresaId)
    .eq("activo", true);
}

async function cancelPlan(empresaId: string) {
  const today = new Date().toISOString().slice(0, 10);
  await supabaseAdmin
    .from("empresas_planes")
    .update({
      activo: false,
      fecha_fin: today,
      updated_at: nowISO(),
    })
    .eq("empresa_id", empresaId)
    .eq("activo", true);
}

// -----------------------------
// Movimientos financieros
// -----------------------------

/**
 * Marca como 'paid' o 'failed' un movimiento de upgrade_prorrateo,
 * ubicándolo por empresa + (opcional) nuevo_plan_id.
 * (Esto lo dejamos como helper genérico por si en el futuro lo usás así).
 */
async function settleUpgradeMovimiento(params: {
  empresaId: string;
  nuevoPlanId?: string | null;
  estado: "paid" | "failed";
  referenciaPasarela?: string | null;
  payload?: any;
}) {
  const { empresaId, nuevoPlanId, estado, referenciaPasarela, payload } =
    params;

  let query = supabaseAdmin
    .from("movimientos_financieros")
    .select("id, metadata")
    .eq("empresa_id", empresaId)
    .eq("tipo", "ajuste")
    .eq("estado", "pending")
    .contains("metadata", { subtipo: "upgrade_prorrateo" })
    .order("fecha", { ascending: false })
    .limit(1);

  if (nuevoPlanId) {
    query = query.contains("metadata", { nuevo_plan_id: nuevoPlanId });
  }

  const { data: mov } = await query.maybeSingle();
  if (!mov?.id) return null;

  const newMeta = {
    ...(mov.metadata ?? {}),
    webhook_ref: referenciaPasarela ?? null,
    webhook_payload: payload ?? null,
    settled_at: nowISO(),
  };

  await supabaseAdmin
    .from("movimientos_financieros")
    .update({
      estado,
      referencia_pasarela: referenciaPasarela ?? null,
      metadata: newMeta as any,
      updated_at: nowISO(),
    })
    .eq("id", mov.id);

  return mov.id as string;
}

/**
 * Caso principal para tu flujo actual:
 * tenés movimiento_id en payment.metadata.movimiento_id (o external_reference).
 * Lo buscamos, marcamos paid/failed y activamos el plan nuevo.
 */
async function settleMovimientoPorIdYActivarPlan(params: {
  movimientoId: string;
  estado: "paid" | "failed";
  referenciaPasarela?: string | null;
  payload?: any;
}) {
  const { movimientoId, estado, referenciaPasarela, payload } = params;

  const { data: mov } = await supabaseAdmin
    .from("movimientos_financieros")
    .select("id, empresa_id, estado, metadata")
    .eq("id", movimientoId)
    .maybeSingle();

  if (!mov?.id) {
    console.warn("Movimiento no encontrado para webhook:", movimientoId);
    return null;
  }

  const empresaId = mov.empresa_id as string | undefined;
  const meta = (mov.metadata || {}) as any;
  const nuevoPlanId: string | undefined = meta.nuevo_plan_id;
  const maxAsesoresOverride: number | undefined = meta.max_asesores_override;

  const newMeta = {
    ...meta,
    webhook_ref: referenciaPasarela ?? null,
    webhook_payload: payload ?? null,
    settled_at: nowISO(),
  };

  await supabaseAdmin
    .from("movimientos_financieros")
    .update({
      estado,
      referencia_pasarela: referenciaPasarela ?? null,
      metadata: newMeta as any,
      updated_at: nowISO(),
    })
    .eq("id", mov.id);

  if (estado === "paid" && empresaId && nuevoPlanId) {
    await activatePlan(empresaId, nuevoPlanId, maxAsesoresOverride);
  }

  return mov.id as string;
}

// -----------------------------
// Normalizador Mercado Pago
// -----------------------------

/**
 * Dado un body “nativo” de Mercado Pago (webhook v1),
 * si corresponde a un pago, va a buscar el pago completo
 * y lo traduce a nuestro formato interno:
 *
 *  { provider, externalEventId, eventType, data }
 */
async function normalizeMercadoPagoEvent(
  body: any
): Promise<{
  provider: string;
  externalEventId: string;
  eventType: string;
  data: any;
} | null> {
  if (!MP_ACCESS_TOKEN) return null;
  if (!body) return null;

  const mpType = body?.type;
  const mpAction = body?.action;
  const topic = body?.topic;
  const mpDataId =
    body?.data?.id ??
    body?.data?.payment?.id ??
    body?.id ??
    null;

  const isPaymentEvent =
    mpType === "payment" ||
    (typeof mpAction === "string" &&
      mpAction.toLowerCase().startsWith("payment.")) ||
    topic === "payment";

  if (!isPaymentEvent || !mpDataId) {
    return null;
  }

  // Traer info completa del pago
  const paymentRes = await fetch(
    `https://api.mercadopago.com/v1/payments/${mpDataId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
    }
  );

  if (!paymentRes.ok) {
    const txt = await paymentRes.text().catch(() => "");
    console.error("Error obteniendo pago de MP:", paymentRes.status, txt);
    return null;
  }

  const payment = (await paymentRes.json().catch(() => null)) as any;
  if (!payment) return null;

  const status = payment.status as string | undefined;
  let eventType: string;

  if (status === "approved") {
    eventType = "payment_succeeded";
  } else if (status === "rejected" || status === "cancelled") {
    eventType = "invoice_payment_failed";
  } else {
    // Podés diferenciar pending si querés
    eventType = "invoice_payment_failed";
  }

  // Metadata (forma preferida)
  let empresaId =
    payment?.metadata?.empresa_id ||
    payment?.metadata?.empresaId ||
    null;
  let planId =
    payment?.metadata?.plan_id || payment?.metadata?.planId || null;
  let suscripcionId =
    payment?.metadata?.suscripcion_id ||
    payment?.metadata?.suscripcionId ||
    null;
  let movimientoId =
    payment?.metadata?.movimiento_id ||
    payment?.metadata?.movimientoId ||
    null;

  // Fallback: external_reference (en tu caso es el movimiento_id)
  if (!movimientoId && typeof payment.external_reference === "string") {
    movimientoId = payment.external_reference;
  }

  return {
    provider: "mercadopago",
    externalEventId: String(payment.id),
    eventType,
    data: {
      empresaId,
      planId,
      suscripcionId,
      movimientoId,
      paymentStatus: payment.status,
      paymentStatusDetail: payment.status_detail,
      externoPaymentId: payment.id,
      raw_payment: payment,
    },
  };
}

// -----------------------------
// Handler principal
// -----------------------------
export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => null as any);

    let provider: string | undefined = rawBody?.provider;
    let externalEventId: string | undefined = rawBody?.externalEventId;
    let eventType: string | undefined = rawBody?.eventType;
    let data: any = rawBody?.data ?? {};

    // Si no viene en formato “normalizado”, intentamos Mercado Pago nativo
    const isNormalized =
      !!provider && !!externalEventId && !!eventType;

    if (!isNormalized) {
      const mpNormalized = await normalizeMercadoPagoEvent(rawBody);
      if (mpNormalized) {
        provider = mpNormalized.provider;
        externalEventId = mpNormalized.externalEventId;
        eventType = mpNormalized.eventType;
        data = mpNormalized.data;
      }
    }

    if (!provider || !externalEventId || !eventType) {
      return NextResponse.json(
        {
          error:
            "Faltan campos obligatorios: provider, externalEventId, eventType.",
        },
        { status: 400 }
      );
    }

    // Idempotencia
    {
      const { data: exists } = await supabaseAdmin
        .from("webhook_events")
        .select("id")
        .eq("provider", provider)
        .eq("external_event_id", externalEventId)
        .maybeSingle();
      if (exists?.id) {
        return NextResponse.json(
          { ok: true, idempotent: true },
          { status: 200 }
        );
      }
    }

    // Registrar evento (guardamos data procesada como payload)
    const { data: whInserted, error: whErr } = await supabaseAdmin
      .from("webhook_events")
      .insert({
        provider,
        external_event_id: externalEventId,
        event_type: eventType,
        payload: data,
        processed_at: null,
      })
      .select("id")
      .maybeSingle();

    if (whErr) {
      const msg = whErr.message?.toLowerCase() ?? "";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        return NextResponse.json(
          { ok: true, idempotent: true },
          { status: 200 }
        );
      }
      return NextResponse.json(
        { error: whErr.message },
        { status: 400 }
      );
    }

    // -------------------
    // Lógica principal según tipo de evento
    // -------------------

    const empresaId: string | undefined = data?.empresaId ?? undefined;
    const planId: string | undefined = data?.planId ?? undefined;
    const movimientoId: string | undefined = data?.movimientoId ?? undefined;

    let newEstado: SuscripcionEstado | null = null;

    switch (eventType) {
      case "subscription_active":
      case "payment_succeeded":
      case "subscription_resumed": {
        // 1) Caso principal: tenemos movimiento_id → liquidamos movimiento y activamos plan
        if (movimientoId) {
          await settleMovimientoPorIdYActivarPlan({
            movimientoId,
            estado: "paid",
            referenciaPasarela:
              data?.externoPaymentId ||
              data?.paymentId ||
              data?.chargeId ||
              null,
            payload: data,
          });
        } else if (empresaId) {
          // 2) Fallback por empresa/plan (si existiera suscripciones clásicas)
          await settleUpgradeMovimiento({
            empresaId,
            nuevoPlanId: planId,
            estado: "paid",
            referenciaPasarela:
              data?.externoPaymentId ||
              data?.paymentId ||
              data?.chargeId ||
              null,
            payload: data,
          });

          if (empresaId && planId) {
            await activatePlan(empresaId, planId);
          }
        }

        newEstado = "activa";
        break;
      }

      case "subscription_paused":
      case "invoice_payment_failed": {
        if (movimientoId) {
          await settleMovimientoPorIdYActivarPlan({
            movimientoId,
            estado: "failed",
            referenciaPasarela:
              data?.externoPaymentId ||
              data?.paymentId ||
              data?.chargeId ||
              null,
            payload: data,
          });
        } else if (empresaId) {
          await settleUpgradeMovimiento({
            empresaId,
            nuevoPlanId: planId,
            estado: "failed",
            referenciaPasarela:
              data?.externoPaymentId ||
              data?.paymentId ||
              data?.chargeId ||
              null,
            payload: data,
          });

          if (empresaId) {
            await suspendPlan(empresaId);
          }
        }

        newEstado = "suspendida";
        break;
      }

      case "subscription_canceled": {
        if (empresaId) {
          await cancelPlan(empresaId);
        }
        newEstado = "cancelada";
        break;
      }

      default: {
        await supabaseAdmin
          .from("webhook_events")
          .update({ processed_at: nowISO() })
          .eq("id", whInserted?.id ?? "");
        return NextResponse.json(
          {
            ok: true,
            note: `Evento ${eventType} registrado (sin efectos).`,
          },
          { status: 200 }
        );
      }
    }

    // -------------------
    // Actualizar suscripciones si es que se usaran
    // -------------------
    if (newEstado) {
      const sus = await findSuscripcion(data);
      if (sus?.id) {
        const patch: any = { estado: newEstado };

        if (
          eventType === "subscription_active" ||
          eventType === "payment_succeeded" ||
          eventType === "subscription_resumed"
        ) {
          patch.inicio = sus.inicio ?? nowISO();
          if (data?.externoCustomerId)
            patch.externo_customer_id = data.externoCustomerId;
          if (data?.externoSubscriptionId)
            patch.externo_subscription_id = data.externoSubscriptionId;
          patch.fin = null;
        }
        if (eventType === "subscription_canceled") {
          patch.fin = nowISO();
        }

        await supabaseAdmin
          .from("suscripciones")
          .update(patch)
          .eq("id", sus.id);
      }
    }

    await supabaseAdmin
      .from("webhook_events")
      .update({ processed_at: nowISO() })
      .eq("id", whInserted?.id ?? "");

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error("Error en /api/pagos/webhook:", e?.message || e);
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
