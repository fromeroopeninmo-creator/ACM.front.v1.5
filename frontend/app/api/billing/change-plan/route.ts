// app/api/billing/change-plan/route.ts 
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";
import {
  assertAuthAndGetContext,
  getEmpresaIdForActor,
  getSuscripcionEstado,
  getPlanPrecioNetoPreferido,
  calcularDeltaProrrateo,
  round2,
} from "#lib/billing/utils";

/**
 * POST /api/billing/change-plan
 * Body: {
 *   nuevo_plan_id: string,
 *   empresa_id?: string,
 *   max_asesores_override?: number   // usado para plan "Personalizado"
 * }
 *
 * - Upgrade: crea movimiento 'ajuste' con metadata.subtipo = 'upgrade_prorrateo' (pending).
 *   El proveedor de pago (cuando exista) debería marcarlo como paid vía webhook
 *   y ahí activar el nuevo plan.
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
      const { data: existing, error: exErr } = await supabase
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

      if (existing && existing.length > 0) {
        // Reutilizamos el movimiento pending ya creado
        return NextResponse.json(
          {
            accion: "upgrade",
            movimiento_id: existing[0].id,
            checkoutUrl: null, // integrar gateway real más adelante
            delta: {
              neto: round2(sim.deltaNeto),
              iva: round2(sim.iva),
              total: round2(sim.total),
              moneda: "ARS",
            },
            nota: "Movimiento pendiente existente reutilizado.",
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

      const { data: ins, error: insErr } = await supabase
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
          nota:
            "Al confirmar el pago vía pasarela se activará el nuevo plan en este ciclo.",
        },
        { status: 200 }
      );
    }

    // -------------------------
    // DOWNGRADE → programar cambio al fin del ciclo
    // -------------------------
    if (isDowngrade) {
      const { error: updErr } = await supabase
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
