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
  getPlanPrecioNetoPreferido,
  calcularDeltaProrrateo,
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

  // 👇 ESTO ES LO NUEVO
  payment_methods: {
    installments: 1, // máximo 1 cuota
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

    // Precio neto actual (plan activo)
    const precioActual = await getPlanPrecioNetoPreferido(
      supabase,
      plan_actual_id,
      empresaId
    );

    if (precioActual == null) {
      return NextResponse.json(
        { error: "No se pudo resolver el precio neto del plan actual." },
        { status: 409 }
      );
    }

    // --------------------------
    // Precio neto NUEVO, con caso especial para "Personalizado"
    // --------------------------
    // Base (lo que tengas en planes.precio o override actual si aplica)
    let precioNuevo = await getPlanPrecioNetoPreferido(
      supabase,
      nuevoPlanId,
      empresaId
    );

    if (precioNuevo == null) {
      return NextResponse.json(
        { error: "No se pudo resolver el precio neto del nuevo plan." },
        { status: 409 }
      );
    }

    // Si viene override y el nuevo plan es "Personalizado", recalculamos precioNuevo
    // usando la misma lógica que el frontend:
    //   premiumPrecio + (maxAsesoresOverride - 20) * precio_extra_por_asesor
    if (
      typeof maxAsesoresOverride === "number" &&
      Number.isFinite(maxAsesoresOverride)
    ) {
      // Primero vemos si el nuevo plan ES "Personalizado"
      const { data: nuevoPlanRow, error: nuevoPlanErr } = await supabase
        .from("planes")
        .select("id, nombre, precio, precio_extra_por_asesor")
        .eq("id", nuevoPlanId)
        .maybeSingle();

      if (nuevoPlanErr) {
        console.error("Error leyendo nuevo plan:", nuevoPlanErr.message);
      }

      if (
        nuevoPlanRow &&
        (nuevoPlanRow.nombre || "").toLowerCase() === "personalizado"
      ) {
        // Buscamos el plan Premium para tomar su precio base (igual que en el frontend)
        const { data: premiumPlan, error: premiumErr } = await supabase
          .from("planes")
          .select("id, precio")
          .eq("nombre", "Premium")
          .maybeSingle();

        if (premiumErr) {
          console.error("Error leyendo plan Premium:", premiumErr.message);
        }

        const basePremium = premiumPlan
          ? Number(premiumPlan.precio ?? 0)
          : Number(nuevoPlanRow.precio ?? 0); // fallback por las dudas

        const unitExtra = Number(nuevoPlanRow.precio_extra_por_asesor ?? 0);
        // Según tu UX, los primeros 20 asesores están cubiertos por Premium
        const extra = Math.max(0, maxAsesoresOverride - 20);
        const personalizadoPrecio = basePremium + extra * unitExtra;

        if (personalizadoPrecio > 0) {
          precioNuevo = personalizadoPrecio;
        }
      }
    }

    const isUpgrade = precioNuevo > precioActual;
    const isDowngrade = precioNuevo < precioActual;

    // -------------------------
    // UPGRADE → crear movimiento financiero 'ajuste' (subtipo upgrade_prorrateo)
    // -------------------------
    if (isUpgrade) {
      const sim = calcularDeltaProrrateo({
        cicloInicioISO: ciclo_inicio,
        cicloFinISO: ciclo_fin,
        precioActualNeto: precioActual,
        precioNuevoNeto: precioNuevo,
        alicuotaIVA: 0.21,
      });

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
            totalConIVA: sim.total,
          });
        }

        return NextResponse.json(
          {
            accion: "upgrade",
            movimiento_id: existingId,
            checkoutUrl,
            delta: {
              neto: round2(sim.deltaNeto),
              iva: round2(sim.iva),
              total: round2(sim.total),
              moneda: "ARS",
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
        dias_ciclo: sim.diasCiclo,
        dias_restantes: sim.diasRestantes,
        factor: round2(sim.factor),
        iva: round2(sim.iva),
        total: round2(sim.total),
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
            monto_neto: round2(sim.deltaNeto),
            iva: round2(sim.iva),
            total: round2(sim.total),
            descripcion: "Upgrade de plan prorrateado",
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
          totalConIVA: sim.total,
        });
      }

      return NextResponse.json(
        {
          accion: "upgrade",
          movimiento_id: ins?.id ?? null,
          checkoutUrl,
          delta: {
            neto: round2(sim.deltaNeto),
            iva: round2(sim.iva),
            total: round2(sim.total),
            moneda: "ARS",
          },
          nota: SIMULAR_PAGO_OK
            ? "Simulación: el pago se marcó como 'paid' y el nuevo plan ya está activo."
            : "Al completar el pago en Mercado Pago, el nuevo plan se activará vía webhook.",
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
