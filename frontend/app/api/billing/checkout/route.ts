// app/api/billing/checkout/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

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

    if (!userId)
      return NextResponse.json(
        { error: "No autenticado." },
        { status: 401 }
      );

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
    const planId: string | undefined = body?.planId;
    const empresaIdParam: string | undefined = body?.empresaId; // solo admins pueden pasarla

    if (!planId) {
      return NextResponse.json(
        { error: "Falta 'planId'." },
        { status: 400 }
      );
    }

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

    // Validar plan
    const { data: planRow, error: planErr } = await supabaseAdmin
      .from("planes")
      .select(
        "id, nombre, precio, duracion_dias, max_asesores, precio_extra_por_asesor"
      )
      .eq("id", planId)
      .maybeSingle();
    if (planErr)
      return NextResponse.json(
        { error: planErr.message },
        { status: 400 }
      );
    if (!planRow)
      return NextResponse.json(
        { error: "Plan no encontrado." },
        { status: 404 }
      );

    // Crear registro de suscripción "pendiente"
    const { data: sus, error: susErr } = await supabaseAdmin
      .from("suscripciones")
      .insert({
        empresa_id: empresaId,
        plan_id: planId,
        estado: "pendiente",
        inicio: new Date().toISOString(),
        fin: null,
        externo_customer_id: null,
        externo_subscription_id: null,
        metadata: {
          initiated_by: userId,
          role,
          source: MP_ACCESS_TOKEN ? "checkout_mercadopago" : "checkout_sandbox",
        } as any,
      })
      .select("id")
      .maybeSingle();

    if (susErr)
      return NextResponse.json(
        { error: susErr.message },
        { status: 400 }
      );

    const suscripcionId = sus?.id as string | undefined;

    // =============================
    //  MODO MERCADO PAGO REAL
    // =============================
    if (MP_ACCESS_TOKEN) {
      const monto = Number(planRow.precio) || 0;
      const title = `Plan ${planRow.nombre}`;

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
            unit_price: monto,
            currency_id: "ARS",
          },
        ],
        payer: payerEmail ? { email: payerEmail } : undefined,
        external_reference: `${empresaId}:${planId}:${suscripcionId ?? ""}`,
        metadata: {
          empresaId,
          planId,
          suscripcionId: suscripcionId ?? null,
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

      return NextResponse.json({ checkoutUrl }, { status: 200 });
    }

    // =============================
    //  MODO SANDBOX (fallback)
    // =============================
    const checkoutUrl = `${SITE_URL}/checkout/sandbox?empresaId=${encodeURIComponent(
      empresaId
    )}&planId=${encodeURIComponent(
      planId
    )}&suscripcionId=${encodeURIComponent(suscripcionId ?? "")}`;

    return NextResponse.json({ checkoutUrl }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
