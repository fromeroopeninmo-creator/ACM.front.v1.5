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

  // (alias por si en algún momento llega como suscripcion_id)
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

  // 3) Fallback: por empresaId + planId (última)
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

async function activatePlan(empresaId: string, planId: string) {
  // 1) Desactivar cualquier plan activo actual
  await supabaseAdmin
    .from("empresas_planes")
    .update({ activo: false, updated_at: nowISO() })
    .eq("empresa_id", empresaId)
    .eq("activo", true);

  // 2) Reactivar si ya existía ese plan
  const { data: existente } = await supabaseAdmin
    .from("empresas_planes")
    .select("id, fecha_inicio")
    .eq("empresa_id", empresaId)
    .eq("plan_id", planId)
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente?.id) {
    await supabaseAdmin
      .from("empresas_planes")
      .update({ activo: true, fecha_fin: null, updated_at: nowISO() })
      .eq("id", existente.id);
    return existente.id as string;
  } else {
    // 3) Insertar nuevo plan activo
    const { data: inserted } = await supabaseAdmin
      .from("empresas_planes")
      .insert({
        empresa_id: empresaId,
        plan_id: planId,
        fecha_inicio: new Date().toISOString().slice(0, 10),
        activo: true,
      })
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
    .update({ activo: false, fecha_fin: today, updated_at: nowISO() })
    .eq("empresa_id", empresaId)
    .eq("activo", true);
}

/**
 * Marca como 'paid'/'failed' el movimiento de upgrade prorrateado pendiente.
 * Empareja por empresa y (si se conoce) por nuevo_plan_id dentro de metadata.
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

  // Intentamos matchear por metadata.nuevo_plan_id si está disponible
  let query = supabaseAdmin
    .from("movimientos_financieros")
    .select("id, metadata")
    .eq("empresa_id", empresaId)
    .eq("tipo", "upgrade_prorrateo")
    .eq("estado", "pending")
    .order("fecha", { ascending: false })
    .limit(1);

  // Si conocemos el plan nuevo, filtramos por metadata
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
 * Dado un body “nativo” de Mercado Pago (webhook v1),
 * si corresponde a un pago, va a buscar el pago completo
 * y lo traduce a nuestro formato interno:
 *
 *  { provider, externalEventId, eventType, data }
 *
 * Si no reconoce el evento como de MP o no hay token, devuelve null.
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

  // Distintos formatos que manda MP para pagos
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
    console.error("Error obteniendo pago de MP:", txt);
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
    // podés ajustar si querés tratar pending como otro tipo
    eventType = "invoice_payment_failed";
  }

  // Metadata (forma preferida)
  let empresaId =
    payment?.metadata?.empresaId ||
    payment?.metadata?.empresa_id ||
    null;
  let planId =
    payment?.metadata?.planId || payment?.metadata?.plan_id || null;
  let suscripcionId =
    payment?.metadata?.suscripcionId ||
    payment?.metadata?.suscripcion_id ||
    null;

  // Fallback: external_reference "empresaId:planId:suscripcionId"
  if (
    (!empresaId || !planId) &&
    typeof payment.external_reference === "string"
  ) {
    const parts = payment.external_reference.split(":");
    if (!empresaId && parts[0]) empresaId = parts[0];
    if (!planId && parts[1]) planId = parts[1];
    if (!suscripcionId && parts[2]) suscripcionId = parts[2];
  }

  return {
    provider: "mercadopago",
    externalEventId: String(payment.id),
    eventType,
    data: {
      empresaId,
      planId,
      suscripcionId,
      paymentStatus: payment.status,
      paymentStatusDetail: payment.status_detail,
      externoPaymentId: payment.id,
      raw_payment: payment,
    },
  };
}

export async function POST(req: Request) {
  try {
    // Leemos body una sola vez
    const rawBody = await req.json().catch(() => null as any);

    let provider: string | undefined = rawBody?.provider;
    let externalEventId: string | undefined = rawBody?.externalEventId;
    let eventType: string | undefined = rawBody?.eventType;
    let data: any = rawBody?.data ?? {};

    // 1) Si NO viene en formato normalizado, intentamos reconocerlo como MP nativo
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

    // Si todavía no tenemos la info básica → request mal formado
    if (!provider || !externalEventId || !eventType) {
      return NextResponse.json(
        {
          error:
            "Faltan campos obligatorios: provider, externalEventId, eventType.",
        },
        { status: 400 }
      );
    }

    // =====================
    // Idempotencia
    // =====================
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

    // Registrar evento crudo (payload = data “procesada”)
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

    // Localizar suscripción
    const sus = await findSuscripcion(data);

    // Si no hay suscripción ni empresa/plan, no hacemos nada “de negocio”
    if (!sus && !(data?.empresaId && data?.planId)) {
      await supabaseAdmin
        .from("webhook_events")
        .update({ processed_at: nowISO() })
        .eq("id", whInserted?.id ?? "");
      return NextResponse.json(
        { ok: true, note: "Evento registrado (sin suscripción vinculada)." },
        { status: 200 }
      );
    }

    const empresaId: string = sus?.empresa_id ?? data.empresaId;
    const planId: string = sus?.plan_id ?? data.planId;

    let newEstado: SuscripcionEstado | null = null;

    switch (eventType) {
      case "subscription_active":
      case "payment_succeeded":
      case "subscription_resumed": {
        // 1) Marcar movimiento pendiente de upgrade como 'paid'
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

        // 2) Activar plan en empresas_planes
        if (empresaId && planId) {
          await activatePlan(empresaId, planId);
        }
        newEstado = "activa";
        break;
      }
      case "subscription_paused":
      case "invoice_payment_failed": {
        // Si hubo fallo, marcar (si existe) el movimiento como 'failed'
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

    // Actualizar suscripción si la tenemos
    if (sus?.id && newEstado) {
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
