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

// ⚙️ flag de simulación (podés apagarlo cuando tengas pasarela real)
const SIMULAR_PAGO_OK =
  process.env.NEXT_PUBLIC_BILLING_SIMULATE === "true" || true;

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

      // ⚠️ Caso: ya hay un movimiento pending en este ciclo (primera prueba que hiciste)
      if (existing && existing.length > 0) {
        const existingId = existing[0].id as string;

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
        }

        return NextResponse.json(
          {
            accion: "upgrade",
            movimiento_id: existingId,
            checkoutUrl: null, // integrar gateway real más adelante
            delta: {
              neto: round2(sim.deltaNeto),
              iva: round2(sim.iva),
              total: round2(sim.total),
              moneda: "ARS",
            },
            nota: SIMULAR_PAGO_OK
              ? "Simulación: se reutilizó el movimiento pendiente existente, se marcó como 'paid' y el nuevo plan ya está activo."
              : "Movimiento pendiente existente reutilizado.",
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
      }

      // Aquí iría la creación del intent/checkout del gateway (Stripe/MercadoPago)
      const checkoutUrl = null;

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
            : "Al confirmar el pago vía pasarela se activará el nuevo plan en este ciclo.",
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
