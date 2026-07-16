// frontend/app/api/billing/checkout/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";
import {
  getEmpresaAcuerdoComercialActivo,
  getSuscripcionEstado,
  resolveEmpresaBillingConfig,
  round2,
} from "#lib/billing/utils";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const MP_ACCESS_TOKEN =
  process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role =
  | "empresa"
  | "asesor"
  | "soporte"
  | "super_admin"
  | "super_admin_root";

async function resolveUserRole(userId: string): Promise<Role | null> {
  const { data: byUserId } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (byUserId?.role) return byUserId.role as Role;

  const { data: byId } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return (byId?.role as Role) ?? null;
}

async function resolveEmpresaIdForUser(userId: string): Promise<string | null> {
  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (empresa?.id) return String(empresa.id);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", userId)
    .maybeSingle();

  return profile?.empresa_id ? String(profile.empresa_id) : null;
}


function addOneCalendarMonth(iso: string): string {
  const source = new Date(iso);
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth();
  const day = source.getUTCDate();
  const lastDayNextMonth = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      year,
      month + 1,
      Math.min(day, lastDayNextMonth),
      source.getUTCHours(),
      source.getUTCMinutes(),
      source.getUTCSeconds(),
      source.getUTCMilliseconds()
    )
  ).toISOString();
}

function formatDateAR(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Cordoba",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

async function findAlreadyPaidTargetCycle(params: {
  empresaId: string;
  targetStart: string | null;
}) {
  if (!params.targetStart) return null;

  const { data } = await supabaseAdmin
    .from("suscripciones")
    .select("id, estado, inicio, fin, ciclo_inicio, ciclo_fin, plan_id, created_at")
    .eq("empresa_id", params.empresaId)
    .eq("estado", "activa")
    .limit(50);

  return (data ?? []).find((row: any) => {
    const startRaw = row.ciclo_inicio ?? row.inicio ?? null;
    const endRaw = row.ciclo_fin ?? row.fin ?? null;
    if (!startRaw || !endRaw) return false;
    const start = new Date(String(startRaw)).toISOString();
    return start >= params.targetStart!;
  }) ?? null;
}

async function findReusablePendingCheckout(params: {
  empresaId: string;
  planId: string;
  agreementId: string | null;
  targetStart: string | null;
}) {
  const { data } = await supabaseAdmin
    .from("suscripciones")
    .select("id, plan_id, metadata, created_at, externo_subscription_id")
    .eq("empresa_id", params.empresaId)
    .eq("estado", "pendiente")
    .eq("plan_id", params.planId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []).find((row: any) => {
    const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const sameAgreement =
      String(metadata.agreement_id ?? metadata.acuerdo_id ?? "") ===
      String(params.agreementId ?? "");
    const pendingTarget = metadata.cycle_target_start ?? null;
    const sameTarget = pendingTarget === params.targetStart;
    return sameAgreement && sameTarget;
  }) ?? null;
}

function buildSnapshot(config: Awaited<ReturnType<typeof resolveEmpresaBillingConfig>>) {
  return {
    pricing_source: config.pricing_source,
    agreement_applied: config.agreement_applied,
    agreement_id: config.agreement_id,
    agreement_tipo: config.agreement_tipo,
    agreement_plan_id: config.agreement_plan_id,
    agreement_fecha_inicio: config.agreement_fecha_inicio,
    agreement_fecha_fin: config.agreement_fecha_fin,
    precio_base_neto: config.precio_base_neto,
    precio_neto_final: config.precio_neto_final,
    iva_importe: config.iva_importe,
    precio_total_final: config.precio_total_final,
    modo_iva: config.modo_iva,
    iva_pct: config.iva_pct,
    max_asesores_plan: config.max_asesores_plan,
    max_asesores_final: config.max_asesores_final,
    precio_extra_por_asesor_plan: config.precio_extra_por_asesor_plan,
    precio_extra_por_asesor_final: config.precio_extra_por_asesor_final,
    plan_nombre: config.plan_nombre,
    plan_duracion_dias: config.plan_duracion_dias,
  };
}

export async function POST(req: Request) {
  try {
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const user = auth?.user ?? null;

    if (!user?.id) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const role = await resolveUserRole(user.id);
    const allowed: Role[] = ["empresa", "super_admin", "super_admin_root"];

    if (!role || !allowed.includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const requestedPlanId =
      typeof body?.planId === "string" && body.planId.trim()
        ? body.planId.trim()
        : null;
    const empresaIdParam =
      typeof body?.empresaId === "string" && body.empresaId.trim()
        ? body.empresaId.trim()
        : null;

    let empresaId: string | null = null;

    if (role === "empresa") {
      empresaId = await resolveEmpresaIdForUser(user.id);
    } else {
      empresaId = empresaIdParam ?? (await resolveEmpresaIdForUser(user.id));
    }

    if (!empresaId) {
      return NextResponse.json(
        { error: "No se pudo resolver la empresa para el checkout." },
        { status: 400 }
      );
    }

    const acuerdoVigente = await getEmpresaAcuerdoComercialActivo(
      supabaseAdmin,
      empresaId
    );

    let effectivePlanId = requestedPlanId;

    if (acuerdoVigente) {
      if (acuerdoVigente.plan_id) {
        if (requestedPlanId && requestedPlanId !== acuerdoVigente.plan_id) {
          return NextResponse.json(
            {
              error:
                "La cuenta posee un acuerdo comercial vigente. Solo puede abonarse el plan definido en el acuerdo.",
            },
            { status: 409 }
          );
        }
        effectivePlanId = acuerdoVigente.plan_id;
      }
    }

    if (!effectivePlanId) {
      const cicloActual = await getSuscripcionEstado(supabaseAdmin, empresaId);
      effectivePlanId = cicloActual?.plan_actual_id ?? null;
    }

    if (!effectivePlanId) {
      const { data: planOperativo } = await supabaseAdmin
        .from("empresas_planes")
        .select("plan_id")
        .eq("empresa_id", empresaId)
        .eq("activo", true)
        .order("fecha_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();

      effectivePlanId = planOperativo?.plan_id
        ? String(planOperativo.plan_id)
        : null;
    }

    if (!effectivePlanId) {
      return NextResponse.json(
        { error: "No se pudo resolver el plan a abonar." },
        { status: 400 }
      );
    }

    const { data: planRow, error: planError } = await supabaseAdmin
      .from("planes")
      .select("id, nombre, nombre_comercial, es_trial")
      .eq("id", effectivePlanId)
      .maybeSingle();

    if (planError) {
      return NextResponse.json({ error: planError.message }, { status: 400 });
    }

    if (!planRow) {
      return NextResponse.json({ error: "Plan no encontrado." }, { status: 404 });
    }

    if (planRow.es_trial === true) {
      return NextResponse.json(
        { error: "El plan Trial no puede abonarse mediante checkout." },
        { status: 409 }
      );
    }

    const config = await resolveEmpresaBillingConfig({
      supabase: supabaseAdmin,
      empresaId,
      planId: effectivePlanId,
    });

    const currentCycle = await getSuscripcionEstado(supabaseAdmin, empresaId);
    const now = new Date();
    const renewalWindowMs = 2 * 24 * 60 * 60 * 1000;
    const cycleEnd = currentCycle?.ciclo_fin ?? null;

    if (cycleEnd) {
      const remainingMs = new Date(cycleEnd).getTime() - now.getTime();
      if (remainingMs > renewalWindowMs) {
        return NextResponse.json(
          {
            error: `Tu suscripción está vigente hasta el ${formatDateAR(cycleEnd)}. Podrás renovar cuando falten 2 días para el vencimiento.`,
            code: "CYCLE_STILL_ACTIVE",
            cicloFin: cycleEnd,
            renovacionDisponibleDesde: new Date(
              new Date(cycleEnd).getTime() - renewalWindowMs
            ).toISOString(),
          },
          { status: 409 }
        );
      }
    }

    const targetStart = cycleEnd && new Date(cycleEnd).getTime() > now.getTime()
      ? cycleEnd
      : null;
    const targetEnd = targetStart ? addOneCalendarMonth(targetStart) : null;

    const alreadyPaidTarget = await findAlreadyPaidTargetCycle({
      empresaId,
      targetStart,
    });

    if (alreadyPaidTarget) {
      const paidEnd =
        alreadyPaidTarget.ciclo_fin ?? alreadyPaidTarget.fin ?? null;
      return NextResponse.json(
        {
          error: paidEnd
            ? `El próximo ciclo ya se encuentra abonado y estará vigente hasta el ${formatDateAR(String(paidEnd))}.`
            : "El próximo ciclo ya se encuentra abonado.",
          code: "NEXT_CYCLE_ALREADY_PAID",
          suscripcionId: String(alreadyPaidTarget.id),
          cicloFin: paidEnd,
        },
        { status: 409 }
      );
    }

    const reusablePending = await findReusablePendingCheckout({
      empresaId,
      planId: effectivePlanId,
      agreementId: config.agreement_id,
      targetStart,
    });

    if (reusablePending) {
      const pendingMetadata =
        reusablePending.metadata && typeof reusablePending.metadata === "object"
          ? (reusablePending.metadata as Record<string, any>)
          : {};
      const existingCheckoutUrl =
        typeof pendingMetadata.checkout_url === "string"
          ? pendingMetadata.checkout_url
          : null;

      return NextResponse.json(
        {
          ok: true,
          reused: true,
          checkoutUrl: existingCheckoutUrl,
          suscripcionId: String(reusablePending.id),
          planId: effectivePlanId,
          agreementApplied: config.agreement_applied,
          message: existingCheckoutUrl
            ? "Ya existe un checkout pendiente para este ciclo. Se reutilizó el enlace existente."
            : "Ya existe un pago pendiente para este ciclo. Esperá su acreditación antes de generar otro.",
          code: "PENDING_CHECKOUT_EXISTS",
          cicloObjetivoInicio: targetStart,
          cicloObjetivoFin: targetEnd,
        },
        { status: existingCheckoutUrl ? 200 : 409 }
      );
    }

    const montoNeto = round2(Number(config.precio_neto_final ?? 0));
    const montoTotal = round2(Number(config.precio_total_final ?? montoNeto));
    const montoCobrar = montoTotal > 0 ? montoTotal : montoNeto;

    if (!Number.isFinite(montoCobrar) || montoCobrar <= 0) {
      return NextResponse.json(
        { error: "No se pudo resolver un monto válido para el checkout." },
        { status: 400 }
      );
    }

    const snapshot = buildSnapshot(config);
    const createdAt = new Date().toISOString();

    const { data: pending, error: pendingError } = await supabaseAdmin
      .from("suscripciones")
      .insert({
        empresa_id: empresaId,
        plan_id: effectivePlanId,
        plan_actual_id: effectivePlanId,
        estado: "pendiente",
        inicio: createdAt,
        fin: null,
        ciclo_inicio: null,
        ciclo_fin: null,
        moneda: "ARS",
        precio_neto_override: config.suscripcion_override_applied
          ? config.suscripcion_precio_neto_override
          : null,
        externo_customer_id: null,
        externo_subscription_id: null,
        metadata: {
          initiated_by: user.id,
          initiated_role: role,
          source: MP_ACCESS_TOKEN
            ? "checkout_mercadopago"
            : "checkout_sandbox",
          cycle_status: "awaiting_payment",
          cycle_target_start: targetStart,
          cycle_target_end: targetEnd,
          snapshot,
          ...snapshot,
        },
      })
      .select("id")
      .single();

    if (pendingError || !pending?.id) {
      return NextResponse.json(
        { error: pendingError?.message ?? "No se pudo crear el checkout." },
        { status: 400 }
      );
    }

    const suscripcionId = String(pending.id);
    const planNombre = String(
      planRow.nombre_comercial ?? planRow.nombre ?? "VAI Prop"
    );
    const title = config.agreement_applied
      ? `Acuerdo Comercial - ${planNombre}`
      : `Plan ${planNombre}`;

    if (!MP_ACCESS_TOKEN) {
      return NextResponse.json(
        {
          error:
            "Mercado Pago no está configurado. No se generó un checkout real.",
          suscripcionId,
        },
        { status: 503 }
      );
    }

    const payerEmail = user.email ?? user.user_metadata?.email ?? undefined;

    const preference = {
      items: [
        {
          title,
          quantity: 1,
          unit_price: montoCobrar,
          currency_id: "ARS",
        },
      ],
      payer: payerEmail ? { email: payerEmail } : undefined,
      external_reference: suscripcionId,
      metadata: {
        empresa_id: empresaId,
        empresaId,
        plan_id: effectivePlanId,
        planId: effectivePlanId,
        suscripcion_id: suscripcionId,
        suscripcionId,
        acuerdo_id: config.agreement_id,
        agreement_id: config.agreement_id,
        precio_total_final: config.precio_total_final,
      },
      notification_url: `${SITE_URL}/api/pagos/webhook`,
      back_urls: {
        success: `${SITE_URL}/dashboard/empresa?upgrade_status=success`,
        failure: `${SITE_URL}/dashboard/empresa?upgrade_status=failure`,
        pending: `${SITE_URL}/dashboard/empresa?upgrade_status=pending`,
      },
      auto_return: "approved" as const,
      payment_methods: { installments: 1 },
    };

    const mpResponse = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(preference),
      }
    );

    const mpJson = await mpResponse.json().catch(() => null);

    if (!mpResponse.ok || !mpJson) {
      await supabaseAdmin
        .from("suscripciones")
        .update({
          estado: "cancelada",
          updated_at: new Date().toISOString(),
          metadata: {
            initiated_by: user.id,
            initiated_role: role,
            source: "checkout_mercadopago",
            cycle_status: "preference_creation_failed",
            snapshot,
            ...snapshot,
            provider_error: mpJson,
          },
        })
        .eq("id", suscripcionId);

      return NextResponse.json(
        { error: "Mercado Pago no pudo generar el checkout." },
        { status: 502 }
      );
    }

    const checkoutUrl = mpJson.init_point ?? mpJson.sandbox_init_point ?? null;

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: "Mercado Pago no devolvió una URL de checkout." },
        { status: 502 }
      );
    }

    const checkoutCreatedAt = new Date().toISOString();
    await supabaseAdmin
      .from("suscripciones")
      .update({
        externo_subscription_id: String(mpJson.id ?? "") || null,
        updated_at: checkoutCreatedAt,
        metadata: {
          initiated_by: user.id,
          initiated_role: role,
          source: "checkout_mercadopago",
          cycle_status: "awaiting_payment",
          cycle_target_start: targetStart,
          cycle_target_end: targetEnd,
          checkout_preference_id: String(mpJson.id ?? "") || null,
          checkout_url: checkoutUrl,
          checkout_created_at: checkoutCreatedAt,
          snapshot,
          ...snapshot,
        },
      })
      .eq("id", suscripcionId);

    return NextResponse.json(
      {
        ok: true,
        checkoutUrl,
        suscripcionId,
        planId: effectivePlanId,
        agreementApplied: config.agreement_applied,
        amount: montoCobrar,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    console.error("billing/checkout POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
