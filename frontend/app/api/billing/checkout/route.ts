// app/api/billing/checkout/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";
import { resolveEmpresaBillingConfig, round2 } from "#lib/billing/utils";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

// Token de Mercado Pago (backend)
const MP_ACCESS_TOKEN =
  process.env.MERCADOPAGO_ACCESS_TOKEN ||
  process.env.MP_ACCESS_TOKEN ||
  "";

type Role =
  | "empresa"
  | "asesor"
  | "soporte"
  | "super_admin"
  | "super_admin_root";

async function resolveUserRole(userId: string): Promise<Role | null> {
  const { data: p1 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (p1?.role) return p1.role as Role;

  const { data: p2 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (p2?.role as Role) ?? null;
}

async function resolveEmpresaIdForUser(
  userId: string
): Promise<string | null> {
  // 1) Dueño directo
  const { data: emp } = await supabaseAdmin
    .from("empresas")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (emp?.id) return emp.id as string;

  // 2) Perfil vinculado
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", userId)
    .maybeSingle();
  return (prof?.empresa_id as string) ?? null;
}

export async function POST(req: Request) {
  try {
    // Auth (desde cookie SSR)
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const user = auth?.user || null;
    const userId = user?.id ?? null;

    if (!userId) {
      return NextResponse.json(
        { error: "No autenticado." },
        { status: 401 }
      );
    }

    // Role
    const role = await resolveUserRole(userId);
    const allowed: Role[] = ["empresa", "super_admin", "super_admin_root"];
    if (!role || !allowed.includes(role)) {
      return NextResponse.json(
        { error: "Acceso denegado." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null as any);
    const planIdBody: string | undefined = body?.planId;
    const empresaIdParam: string | undefined = body?.empresaId; // solo admins pueden pasarla

    // Resolver empresaId según rol
    let empresaId: string | null = null;
    if (role === "empresa") {
      empresaId = await resolveEmpresaIdForUser(userId);
      if (!empresaId) {
        return NextResponse.json(
          { error: "No se pudo resolver la empresa del usuario." },
          { status: 400 }
        );
      }
    } else {
      // super_admin / root
      empresaId = empresaIdParam ?? (await resolveEmpresaIdForUser(userId));
      if (!empresaId) {
        return NextResponse.json(
          { error: "Falta 'empresaId' para crear checkout." },
          { status: 400 }
        );
      }
    }

    let effectivePlanId = planIdBody ?? null;

    // Si no viene planId, intentamos resolverlo desde acuerdo activo o plan operativo activo
    if (!effectivePlanId) {
      const hoy = new Date().toISOString().slice(0, 10);

      const { data: acuerdoActivo } = await supabaseAdmin
        .from("empresa_acuerdos_comerciales")
        .select("plan_id")
        .eq("empresa_id", empresaId)
        .eq("activo", true)
        .lte("fecha_inicio", hoy)
        .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (acuerdoActivo?.plan_id) {
        effectivePlanId = String(acuerdoActivo.plan_id);
      } else {
        const { data: planActivo } = await supabaseAdmin
          .from("empresas_planes")
          .select("plan_id")
          .eq("empresa_id", empresaId)
          .eq("activo", true)
          .order("fecha_inicio", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (planActivo?.plan_id) {
          effectivePlanId = String(planActivo.plan_id);
        }
      }
    }

    if (!effectivePlanId) {
      return NextResponse.json(
        { error: "Falta 'planId' y no se pudo resolver un plan para el checkout." },
        { status: 400 }
      );
    }

    // Validar plan
    const { data: planRow, error: planErr } = await supabaseAdmin
      .from("planes")
      .select(
        "id, nombre, precio, duracion_dias, max_asesores, precio_extra_por_asesor"
      )
      .eq("id", effectivePlanId)
      .maybeSingle();

    if (planErr) {
      return NextResponse.json(
        { error: planErr.message },
        { status: 400 }
      );
    }

    if (!planRow) {
      return NextResponse.json(
        { error: "Plan no encontrado." },
        { status: 404 }
      );
    }

    // Resolver pricing efectivo: si hay acuerdo comercial vigente, manda el acuerdo
    const billingConfig = await resolveEmpresaBillingConfig({
      supabase: supabaseAdmin,
      empresaId,
      planId: effectivePlanId,
    });

    const montoNeto = round2(Number(billingConfig.precio_neto_final ?? 0));
    const montoTotal = round2(Number(billingConfig.precio_total_final ?? montoNeto));
    const montoCobrar = montoTotal > 0 ? montoTotal : montoNeto;

    if (!Number.isFinite(montoCobrar) || montoCobrar <= 0) {
      return NextResponse.json(
        { error: "No se pudo resolver un monto válido para el checkout." },
        { status: 400 }
      );
    }

    const hayAcuerdo = !!billingConfig.agreement_applied;
    const title = hayAcuerdo
      ? `Acuerdo Comercial - ${billingConfig.plan_nombre ?? planRow.nombre}`
      : `Plan ${billingConfig.plan_nombre ?? planRow.nombre}`;

    // Crear registro de suscripción "pendiente"
    const { data: sus, error: susErr } = await supabaseAdmin
      .from("suscripciones")
      .insert({
        empresa_id: empresaId,
        plan_id: effectivePlanId,
        estado: "pendiente",
        inicio: new Date().toISOString(),
        fin: null,
        externo_customer_id: null,
        externo_subscription_id: null,
        metadata: {
          initiated_by: userId,
          role,
          source: MP_ACCESS_TOKEN ? "checkout_mercadopago" : "checkout_sandbox",
          pricing_source: billingConfig.pricing_source,
          agreement_applied: billingConfig.agreement_applied,
          agreement_id: billingConfig.agreement_id,
          agreement_tipo: billingConfig.agreement_tipo,
          precio_base_neto: billingConfig.precio_base_neto,
          precio_neto_final: billingConfig.precio_neto_final,
          iva_importe: billingConfig.iva_importe,
          precio_total_final: billingConfig.precio_total_final,
          modo_iva: billingConfig.modo_iva,
          iva_pct: billingConfig.iva_pct,
        } as any,
      })
      .select("id")
      .maybeSingle();

    if (susErr) {
      return NextResponse.json(
        { error: susErr.message },
        { status: 400 }
      );
    }

    const suscripcionId = sus?.id as string | undefined;

    // =============================
    //  MODO MERCADO PAGO REAL
    // =============================
    if (MP_ACCESS_TOKEN) {
      // email del usuario para el payer
      const payerEmail =
        (user as any)?.email ||
        (user as any)?.user_metadata?.email ||
        undefined;

      const prefBody = {
        items: [
          {
            title,
            quantity: 1,
            unit_price: montoCobrar,
            currency_id: "ARS",
          },
        ],
        payer: payerEmail ? { email: payerEmail } : undefined,
        external_reference: `${empresaId}:${effectivePlanId}:${suscripcionId ?? ""}`,
        metadata: {
          empresaId,
          planId: effectivePlanId,
          suscripcionId: suscripcionId ?? null,
          pricing_source: billingConfig.pricing_source,
          agreement_applied: billingConfig.agreement_applied,
          agreement_id: billingConfig.agreement_id,
          agreement_tipo: billingConfig.agreement_tipo,
          precio_base_neto: billingConfig.precio_base_neto,
          precio_neto_final: billingConfig.precio_neto_final,
          iva_importe: billingConfig.iva_importe,
          precio_total_final: billingConfig.precio_total_final,
          modo_iva: billingConfig.modo_iva,
          iva_pct: billingConfig.iva_pct,
        },
        notification_url: `${SITE_URL}/api/pagos/webhook`,
        back_urls: {
          success: `${SITE_URL}/dashboard/empresa?upgrade_status=success`,
          failure: `${SITE_URL}/dashboard/empresa?upgrade_status=failure`,
          pending: `${SITE_URL}/dashboard/empresa?upgrade_status=pending`,
        },
        auto_return: "approved" as const,
      };

      const mpRes = await fetch(
        "https://api.mercadopago.com/checkout/preferences",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          },
          body: JSON.stringify(prefBody),
        }
      );

      if (!mpRes.ok) {
        const errText = await mpRes.text().catch(() => "");
        console.error("Error creando preferencia MP:", errText);
        return NextResponse.json(
          { error: "No se pudo crear la preferencia de pago." },
          { status: 500 }
        );
      }

      const pref = await mpRes.json().catch(() => null as any);
      const checkoutUrl =
        pref?.init_point || pref?.sandbox_init_point || null;

      if (!checkoutUrl) {
        return NextResponse.json(
          { error: "Preferencia creada pero sin URL de checkout." },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          checkoutUrl,
          pricing: {
            source: billingConfig.pricing_source,
            agreement_applied: billingConfig.agreement_applied,
            agreement_id: billingConfig.agreement_id,
            precio_base_neto: billingConfig.precio_base_neto,
            precio_neto_final: billingConfig.precio_neto_final,
            iva_importe: billingConfig.iva_importe,
            precio_total_final: billingConfig.precio_total_final,
          },
        },
        { status: 200 }
      );
    }

    // =============================
    //  MODO SANDBOX (fallback)
    // =============================
    const checkoutUrl = `${SITE_URL}/checkout/sandbox?empresaId=${encodeURIComponent(
      empresaId
    )}&planId=${encodeURIComponent(
      effectivePlanId
    )}&suscripcionId=${encodeURIComponent(suscripcionId ?? "")}`;

    return NextResponse.json(
      {
        checkoutUrl,
        pricing: {
          source: billingConfig.pricing_source,
          agreement_applied: billingConfig.agreement_applied,
          agreement_id: billingConfig.agreement_id,
          precio_base_neto: billingConfig.precio_base_neto,
          precio_neto_final: billingConfig.precio_neto_final,
          iva_importe: billingConfig.iva_importe,
          precio_total_final: billingConfig.precio_total_final,
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
