// frontend/app/api/pagos/webhook/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MP_ACCESS_TOKEN =
  process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type NormalizedEvent = {
  provider: "mercadopago";
  externalEventId: string;
  eventType: "payment_succeeded" | "invoice_payment_failed";
  data: {
    empresaId: string | null;
    planId: string | null;
    suscripcionId: string | null;
    movimientoId: string | null;
    paymentStatus: string | null;
    paymentStatusDetail: string | null;
    externoPaymentId: string;
    externoCustomerId: string | null;
    approvedAt: string | null;
    rawPayment: Record<string, unknown>;
  };
};

function nowISO(): string {
  return new Date().toISOString();
}

function safeISO(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Suma un mes calendario y conserva el día cuando existe; si no, usa el último día. */
function addOneCalendarMonth(iso: string): string {
  const source = new Date(iso);
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth();
  const day = source.getUTCDate();
  const hour = source.getUTCHours();
  const minute = source.getUTCMinutes();
  const second = source.getUTCSeconds();
  const ms = source.getUTCMilliseconds();

  const lastDayNextMonth = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month + 1,
      Math.min(day, lastDayNextMonth),
      hour,
      minute,
      second,
      ms
    )
  ).toISOString();
}

function isBillingSuspensionReason(reason?: string | null): boolean {
  if (!reason) return false;
  const normalized = reason.toLowerCase();
  return [
    "falta de pago",
    "pago no acreditado",
    "suscripción vencida",
    "suscripcion vencida",
    "plan vencido",
    "trial vencido",
    "acuerdo comercial pendiente de pago",
    "sin ciclo vigente",
  ].some((token) => normalized.includes(token));
}

async function clearBillingSuspension(empresaId: string) {
  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("suspendida, suspension_motivo")
    .eq("id", empresaId)
    .maybeSingle();

  if (!empresa?.suspendida) return;
  if (!isBillingSuspensionReason(empresa.suspension_motivo)) return;

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

async function normalizeMercadoPagoEvent(body: unknown): Promise<NormalizedEvent | null> {
  if (!MP_ACCESS_TOKEN || !body || typeof body !== "object") return null;
  const raw = body as Record<string, any>;

  const paymentId =
    raw?.data?.id ?? raw?.data?.payment?.id ?? raw?.id ?? null;
  const type = raw?.type;
  const action = raw?.action;
  const topic = raw?.topic;

  const isPayment =
    type === "payment" ||
    topic === "payment" ||
    (typeof action === "string" && action.toLowerCase().startsWith("payment."));

  if (!isPayment || !paymentId) return null;

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(paymentId))}`,
    { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } }
  );

  if (!response.ok) {
    console.error("Webhook: no se pudo consultar el pago MP", response.status);
    return null;
  }

  const payment = await response.json().catch(() => null);
  if (!payment) return null;

  const status = String(payment.status ?? "");
  let eventType: NormalizedEvent["eventType"];

  if (status === "approved") eventType = "payment_succeeded";
  else if (status === "rejected" || status === "cancelled") {
    eventType = "invoice_payment_failed";
  } else {
    return null;
  }

  const metadata = payment.metadata ?? {};
  const externalReference =
    typeof payment.external_reference === "string"
      ? payment.external_reference
      : null;

  const suscripcionId =
    metadata.suscripcion_id ?? metadata.suscripcionId ?? externalReference ?? null;
  const movimientoId =
    metadata.movimiento_id ?? metadata.movimientoId ?? null;

  return {
    provider: "mercadopago",
    externalEventId: String(payment.id),
    eventType,
    data: {
      empresaId: metadata.empresa_id ?? metadata.empresaId ?? null,
      planId: metadata.plan_id ?? metadata.planId ?? null,
      suscripcionId: suscripcionId ? String(suscripcionId) : null,
      movimientoId: movimientoId ? String(movimientoId) : null,
      paymentStatus: status || null,
      paymentStatusDetail: payment.status_detail ?? null,
      externoPaymentId: String(payment.id),
      externoCustomerId:
        payment?.payer?.id != null ? String(payment.payer.id) : null,
      approvedAt:
        safeISO(payment.date_approved) ?? safeISO(payment.date_created),
      rawPayment: payment as Record<string, unknown>,
    },
  };
}

async function resolvePendingSubscription(event: NormalizedEvent) {
  const id = event.data.suscripcionId;
  if (!id) return null;

  const { data } = await supabaseAdmin
    .from("suscripciones")
    .select(
      "id, empresa_id, plan_id, plan_actual_id, estado, metadata, precio_neto_override"
    )
    .eq("id", id)
    .maybeSingle();

  return data ?? null;
}

async function getCurrentCycleEnd(empresaId: string, excludeId?: string | null) {
  const now = nowISO();
  let query = supabaseAdmin
    .from("suscripciones")
    .select("id, ciclo_inicio, ciclo_fin, inicio, fin")
    .eq("empresa_id", empresaId)
    .eq("estado", "activa")
    .order("ciclo_fin", { ascending: false, nullsFirst: false })
    .order("fin", { ascending: false, nullsFirst: false })
    .limit(25);

  if (excludeId) query = query.neq("id", excludeId);

  const { data } = await query;
  const cycles = (data ?? [])
    .map((row: any) => {
      const start = safeISO(row.ciclo_inicio ?? row.inicio);
      const end = safeISO(row.ciclo_fin ?? row.fin);
      return { start, end };
    })
    .filter((row) => row.start && row.end && row.start <= now && row.end > now)
    .sort((a, b) => b.end!.localeCompare(a.end!));

  return cycles[0]?.end ?? null;
}


async function closeExpiredHistoricalCycles(empresaId: string, keepId: string) {
  const now = nowISO();
  const { data } = await supabaseAdmin
    .from("suscripciones")
    .select("id, ciclo_fin, fin, estado")
    .eq("empresa_id", empresaId)
    .eq("estado", "activa")
    .neq("id", keepId)
    .limit(100);

  const expiredIds = (data ?? [])
    .filter((row: any) => {
      const end = safeISO(row.ciclo_fin ?? row.fin);
      return end != null && end <= now;
    })
    .map((row: any) => String(row.id));

  if (expiredIds.length === 0) return;

  await supabaseAdmin
    .from("suscripciones")
    .update({
      estado: "cancelada",
      updated_at: now,
    })
    .in("id", expiredIds);
}

async function syncOperationalPlan(params: {
  empresaId: string;
  planId: string;
  cycleStart: string;
  cycleEnd: string;
  maxAsesoresOverride: number | null;
}) {
  const { empresaId, planId, cycleStart, cycleEnd, maxAsesoresOverride } = params;
  const today = nowISO().slice(0, 10);

  if (cycleStart > nowISO()) return;

  await supabaseAdmin
    .from("empresas_planes")
    .update({ activo: false, updated_at: nowISO() })
    .eq("empresa_id", empresaId)
    .eq("activo", true);

  const { data: existing } = await supabaseAdmin
    .from("empresas_planes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    fecha_inicio: cycleStart.slice(0, 10) || today,
    fecha_fin: cycleEnd.slice(0, 10),
    activo: true,
    max_asesores_override: maxAsesoresOverride,
    updated_at: nowISO(),
  };

  if (existing?.id) {
    await supabaseAdmin
      .from("empresas_planes")
      .update(payload)
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("empresas_planes").insert({
      empresa_id: empresaId,
      plan_id: planId,
      ...payload,
    });
  }
}

async function settleFinancialMovement(event: NormalizedEvent) {
  const movementId = event.data.movimientoId;
  if (!movementId) return false;

  const { data: movement } = await supabaseAdmin
    .from("movimientos_financieros")
    .select("id, empresa_id, metadata")
    .eq("id", movementId)
    .maybeSingle();

  if (!movement?.id) return false;

  const paid = event.eventType === "payment_succeeded";
  const metadata = {
    ...(movement.metadata ?? {}),
    webhook_ref: event.data.externoPaymentId,
    payment_status: event.data.paymentStatus,
    payment_status_detail: event.data.paymentStatusDetail,
    settled_at: nowISO(),
  };

  await supabaseAdmin
    .from("movimientos_financieros")
    .update({
      estado: paid ? "paid" : "failed",
      referencia_pasarela: event.data.externoPaymentId,
      metadata,
      updated_at: nowISO(),
    })
    .eq("id", movement.id);

  if (paid && movement.empresa_id && metadata.nuevo_plan_id) {
    const start = event.data.approvedAt ?? nowISO();
    const end = addOneCalendarMonth(start);
    await syncOperationalPlan({
      empresaId: String(movement.empresa_id),
      planId: String(metadata.nuevo_plan_id),
      cycleStart: start,
      cycleEnd: end,
      maxAsesoresOverride:
        metadata.max_asesores_override == null
          ? null
          : Number(metadata.max_asesores_override),
    });
    await clearBillingSuspension(String(movement.empresa_id));
  }

  return true;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => null);
    const event = await normalizeMercadoPagoEvent(rawBody);

    if (!event) {
      return NextResponse.json(
        { ok: false, error: "Evento no verificable o no soportado." },
        { status: 401 }
      );
    }

    const { data: existingEvent } = await supabaseAdmin
      .from("webhook_events")
      .select("id, processed_at")
      .eq("provider", event.provider)
      .eq("external_event_id", event.externalEventId)
      .maybeSingle();

    if (existingEvent?.processed_at) {
      return NextResponse.json({ ok: true, idempotent: true });
    }

    let webhookEventId = existingEvent?.id ? String(existingEvent.id) : null;

    if (!webhookEventId) {
      const { data: inserted, error } = await supabaseAdmin
        .from("webhook_events")
        .insert({
          provider: event.provider,
          external_event_id: event.externalEventId,
          event_type: event.eventType,
          payload: { raw: rawBody, normalized: event.data },
          processed_at: null,
        })
        .select("id")
        .single();

      if (error) {
        const duplicate = /duplicate|unique/i.test(error.message ?? "");
        if (duplicate) {
          return NextResponse.json({ ok: true, idempotent: true });
        }
        throw new Error(`No se pudo registrar webhook_events: ${error.message}`);
      }

      webhookEventId = String(inserted.id);
    }

    const handledMovement = await settleFinancialMovement(event);
    const pending = await resolvePendingSubscription(event);

    if (pending?.id) {
      const currentMetadata =
        pending.metadata && typeof pending.metadata === "object"
          ? pending.metadata
          : {};
      const snapshot =
        (currentMetadata as any).snapshot &&
        typeof (currentMetadata as any).snapshot === "object"
          ? (currentMetadata as any).snapshot
          : currentMetadata;

      if (event.eventType === "payment_succeeded") {
        const empresaId = String(pending.empresa_id);
        const planId = String(pending.plan_actual_id ?? pending.plan_id);
        const approvedAt = event.data.approvedAt ?? nowISO();
        const currentEnd = await getCurrentCycleEnd(empresaId, String(pending.id));
        const cycleStart = currentEnd && currentEnd > approvedAt ? currentEnd : approvedAt;
        const cycleEnd = addOneCalendarMonth(cycleStart);

        const finalMetadata = {
          ...currentMetadata,
          cycle_status: "paid",
          payment_status: event.data.paymentStatus,
          payment_status_detail: event.data.paymentStatusDetail,
          externo_payment_id: event.data.externoPaymentId,
          approved_at: approvedAt,
          cycle_start: cycleStart,
          cycle_end: cycleEnd,
          synced_by_webhook: true,
          raw_payment: event.data.rawPayment,
        };

        await supabaseAdmin
          .from("suscripciones")
          .update({
            estado: "activa",
            inicio: cycleStart,
            fin: cycleEnd,
            ciclo_inicio: cycleStart,
            ciclo_fin: cycleEnd,
            plan_actual_id: planId,
            moneda: "ARS",
            externo_customer_id: event.data.externoCustomerId,
            externo_subscription_id: event.data.externoPaymentId,
            metadata: finalMetadata,
            updated_at: nowISO(),
          })
          .eq("id", pending.id);

        await supabaseAdmin
          .from("suscripciones")
          .update({
            estado: "cancelada",
            updated_at: nowISO(),
          })
          .eq("empresa_id", empresaId)
          .eq("estado", "pendiente")
          .neq("id", pending.id);

        await closeExpiredHistoricalCycles(empresaId, String(pending.id));

        await syncOperationalPlan({
          empresaId,
          planId,
          cycleStart,
          cycleEnd,
          maxAsesoresOverride:
            (snapshot as any).max_asesores_final == null
              ? null
              : Number((snapshot as any).max_asesores_final),
        });

        await clearBillingSuspension(empresaId);
      } else {
        await supabaseAdmin
          .from("suscripciones")
          .update({
            estado: "cancelada",
            metadata: {
              ...currentMetadata,
              cycle_status: "payment_failed",
              payment_status: event.data.paymentStatus,
              payment_status_detail: event.data.paymentStatusDetail,
              externo_payment_id: event.data.externoPaymentId,
              synced_by_webhook: true,
            },
            updated_at: nowISO(),
          })
          .eq("id", pending.id);
      }
    } else if (!handledMovement) {
      console.warn(
        "Webhook procesado sin suscripción ni movimiento identificable:",
        event.externalEventId
      );
    }

    await supabaseAdmin
      .from("webhook_events")
      .update({ processed_at: nowISO() })
      .eq("id", webhookEventId);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("Error en /api/pagos/webhook:", message);
    return NextResponse.json(
      { ok: false, error: "Error interno procesando webhook." },
      { status: 500 }
    );
  }
}
