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

function todayDateOnlyUTC() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysToDateOnly(dateOnly: string, days: number): string {
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addDaysToISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

async function getPlanDuracionDias(planId: string | null | undefined): Promise<number> {
  if (!planId) return 30;

  const { data, error } = await supabaseAdmin
    .from("planes")
    .select("duracion_dias")
    .eq("id", planId)
    .maybeSingle();

  if (error) {
    console.warn("getPlanDuracionDias error:", error.message);
    return 30;
  }

  const dur =
    typeof data?.duracion_dias === "number" && data.duracion_dias > 0
      ? data.duracion_dias
      : 30;

  return dur;
}

async function clearEmpresaSuspension(empresaId: string) {
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

async function markEmpresaSuspended(
  empresaId: string,
  motivo = "Pago no acreditado o suscripción suspendida."
) {
  await supabaseAdmin
    .from("empresas")
    .update({
      suspendida: true,
      suspendida_at: nowISO(),
      suspension_motivo: motivo,
      updated_at: nowISO(),
    })
    .eq("id", empresaId);
}

// -----------------------------
// Helpers de suscripciones
// -----------------------------
async function findSuscripcion(data: any): Promise<SuscripcionRow | null> {
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
  const today = todayDateOnlyUTC();
  const duracionDias = await getPlanDuracionDias(planId);
  const fechaFin = addDaysToDateOnly(today, duracionDias);

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
      fecha_inicio: today,
      fecha_fin: fechaFin,
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
  }

  const insert: any = {
    empresa_id: empresaId,
    plan_id: planId,
    fecha_inicio: today,
    fecha_fin: fechaFin,
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

async function suspendPlan(empresaId: string) {
  await supabaseAdmin
    .from("empresas_planes")
    .update({ activo: false, updated_at: nowISO() })
    .eq("empresa_id", empresaId)
    .eq("activo", true);
}

async function cancelPlan(empresaId: string) {
  const today = todayDateOnlyUTC();

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

  if (empresaId) {
    if (estado === "paid" && nuevoPlanId) {
      await activatePlan(empresaId, nuevoPlanId, maxAsesoresOverride);
      await clearEmpresaSuspension(empresaId);
    }

    if (estado === "failed") {
      await markEmpresaSuspended(
        empresaId,
        "Pago no acreditado o cambio de plan pendiente."
      );
    }
  }

  return mov.id as string;
}

// -----------------------------
// Normalizador Mercado Pago
// -----------------------------
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
    eventType = "invoice_payment_failed";
  }

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

    const looksLikeMP =
      !!rawBody &&
      (
        rawBody?.type === "payment" ||
        rawBody?.topic === "payment" ||
        (typeof rawBody?.action === "string" &&
          rawBody.action.toLowerCase().startsWith("payment.")) ||
        (rawBody?.data && (rawBody?.data?.id || rawBody?.data?.payment?.id))
      );

    const fallbackProvider: string =
      rawBody?.provider ??
      (looksLikeMP ? "mercadopago" : "unknown");

    const fallbackExternalEventId: string | undefined =
      rawBody?.externalEventId ??
      rawBody?.external_event_id ??
      (rawBody?.data?.id != null ? String(rawBody.data.id) : undefined) ??
      (rawBody?.data?.payment?.id != null ? String(rawBody.data.payment.id) : undefined) ??
      (rawBody?.id != null ? String(rawBody.id) : undefined);

    const fallbackEventType: string | undefined =
      rawBody?.eventType ??
      rawBody?.event_type ??
      (typeof rawBody?.action === "string" ? rawBody.action : undefined) ??
      (typeof rawBody?.type === "string" ? rawBody.type : undefined) ??
      (typeof rawBody?.topic === "string" ? rawBody.topic : undefined);

    let provider: string | undefined = rawBody?.provider;
    let externalEventId: string | undefined = rawBody?.externalEventId;
    let eventType: string | undefined = rawBody?.eventType;
    let data: any = rawBody?.data ?? {};

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

    provider = provider ?? fallbackProvider;
    externalEventId =
      externalEventId ??
      fallbackExternalEventId ??
      `fallback_${Date.now()}`;
    eventType = eventType ?? fallbackEventType ?? "unknown_event";

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

    const payloadToStore = {
      raw: rawBody,
      data,
    };

    const { data: whInserted, error: whErr } = await supabaseAdmin
      .from("webhook_events")
      .insert({
        provider,
        external_event_id: externalEventId,
        event_type: eventType,
        payload: payloadToStore as any,
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

      console.error("No se pudo registrar webhook_events:", whErr.message);
      return NextResponse.json(
        { ok: true, warning: "No se pudo registrar webhook_events" },
        { status: 200 }
      );
    }

    const empresaId: string | undefined = data?.empresaId ?? undefined;
    const planId: string | undefined = data?.planId ?? undefined;
    const movimientoId: string | undefined = data?.movimientoId ?? undefined;

    let newEstado: SuscripcionEstado | null = null;

    switch (eventType) {
      case "subscription_active":
      case "payment_succeeded":
      case "subscription_resumed": {
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

          if (empresaId) {
            await clearEmpresaSuspension(empresaId);
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
            await markEmpresaSuspended(
              empresaId,
              "Pago no acreditado o suscripción suspendida."
            );
          }
        }

        newEstado = "suspendida";
        break;
      }

      case "subscription_canceled": {
        if (empresaId) {
          await cancelPlan(empresaId);
          await markEmpresaSuspended(
            empresaId,
            "Suscripción cancelada."
          );
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

    if (newEstado) {
      const sus = await findSuscripcion(data);

      if (sus?.id) {
        const patch: any = { estado: newEstado };

        if (
          eventType === "subscription_active" ||
          eventType === "payment_succeeded" ||
          eventType === "subscription_resumed"
        ) {
          const inicio = sus.inicio ?? nowISO();
          const duracionDias = await getPlanDuracionDias(
            sus.plan_id ?? data?.planId ?? null
          );

          patch.inicio = inicio;
          patch.fin = addDaysToISO(inicio, duracionDias);

          if (data?.externoCustomerId) {
            patch.externo_customer_id = data.externoCustomerId;
          }
          if (data?.externoSubscriptionId) {
            patch.externo_subscription_id = data.externoSubscriptionId;
          }
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
      { ok: true, warning: e?.message || "Error inesperado" },
      { status: 200 }
    );
  }
}
