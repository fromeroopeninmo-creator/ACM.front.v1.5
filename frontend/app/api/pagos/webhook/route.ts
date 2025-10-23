// app/api/pagos/webhook/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

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
  await supabaseAdmin
    .from("empresas_planes")
    .update({ activo: false, updated_at: nowISO() })
    .eq("empresa_id", empresaId)
    .eq("activo", true);

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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null as any);
    const provider = body?.provider as string | undefined;
    const externalEventId = body?.externalEventId as string | undefined;
    const eventType = body?.eventType as string | undefined;
    const data = body?.data ?? {};

    if (!provider || !externalEventId || !eventType) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: provider, externalEventId, eventType." },
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
        return NextResponse.json({ ok: true, idempotent: true }, { status: 200 });
        }
    }

    // Registrar evento crudo
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
        return NextResponse.json({ ok: true, idempotent: true }, { status: 200 });
      }
      return NextResponse.json({ error: whErr.message }, { status: 400 });
    }

    // Localizar suscripción
    const sus = await findSuscripcion(data);

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
        if (empresaId && planId) {
          await activatePlan(empresaId, planId);
        }
        newEstado = "activa";
        break;
      }
      case "subscription_paused":
      case "invoice_payment_failed": {
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
          { ok: true, note: `Evento ${eventType} registrado (sin efectos).` },
          { status: 200 }
        );
      }
    }

    // Actualizar suscripción si la tenemos
    if (sus?.id && newEstado) {
      const patch: any = { estado: newEstado };

      if (eventType === "subscription_active" || eventType === "payment_succeeded" || eventType === "subscription_resumed") {
        patch.inicio = sus.inicio ?? nowISO();
        if (data?.externoCustomerId) patch.externo_customer_id = data.externoCustomerId;
        if (data?.externoSubscriptionId) patch.externo_subscription_id = data.externoSubscriptionId;
        patch.fin = null;
      }
      if (eventType === "subscription_canceled") {
        patch.fin = nowISO();
      }

      await supabaseAdmin.from("suscripciones").update(patch).eq("id", sus.id);
    }

    await supabaseAdmin
      .from("webhook_events")
      .update({ processed_at: nowISO() })
      .eq("id", whInserted?.id ?? "");

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
