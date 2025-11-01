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
 * Body: { nuevo_plan_id: string, empresa_id?: string }
 *
 * - Upgrade: crea movimiento 'upgrade_prorrateo' (pending); el webhook de pago activará el plan.
 * - Downgrade: programa cambio al fin del ciclo (plan_proximo_id / cambio_programado_para).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const nuevoPlanId: string | undefined = body?.nuevo_plan_id;
    const empresaIdParam: string | undefined = body?.empresa_id;

    if (!nuevoPlanId) {
      return NextResponse.json({ error: "nuevo_plan_id es obligatorio" }, { status: 400 });
    }

    const supabase = supabaseServer();
    const ctx = await assertAuthAndGetContext(supabase);
    const empresaId = await getEmpresaIdForActor({ supabase, actor: ctx, empresaIdParam });

    if (!empresaId) {
      return NextResponse.json(
        { error: "No se pudo resolver empresa_id (ver permisos / profiles)." },
        { status: 403 }
      );
    }

    const sus = await getSuscripcionEstado(supabase, empresaId);
    if (!sus?.plan_actual_id) {
      return NextResponse.json(
        { error: "Empresa sin plan actual/ciclo vigente para cambiar." },
        { status: 409 }
      );
    }

    const { ciclo_inicio, ciclo_fin, plan_actual_id } = sus;

    const precioActual = await getPlanPrecioNetoPreferido(supabase, plan_actual_id, empresaId);
    const precioNuevo = await getPlanPrecioNetoPreferido(supabase, nuevoPlanId, empresaId);

    if (precioActual == null || precioNuevo == null) {
      return NextResponse.json(
        { error: "No se pudieron resolver los precios netos (planes/override)." },
        { status: 409 }
      );
    }

    const isUpgrade = precioNuevo > precioActual;
    const isDowngrade = precioNuevo < precioActual;

    if (isUpgrade) {
      const sim = calcularDeltaProrrateo({
        cicloInicioISO: ciclo_inicio,
        cicloFinISO: ciclo_fin,
        precioActualNeto: precioActual,
        precioNuevoNeto: precioNuevo,
        alicuotaIVA: 0.21,
      });

      // Idempotencia simple: reusar movimiento pending del ciclo si existe
      const { data: existing, error: exErr } = await supabase
        .from("movimientos_financieros")
        .select("id, estado, metadata")
        .eq("empresa_id", empresaId)
        .eq("tipo", "upgrade_prorrateo")
        .eq("estado", "pending")
        .gte("fecha", ciclo_inicio)
        .lte("fecha", ciclo_fin);

      if (exErr) {
        return NextResponse.json(
          { error: "Error buscando movimientos existentes", detail: exErr.message },
          { status: 500 }
        );
      }

      if (existing && existing.length > 0) {
        return NextResponse.json(
          {
            accion: "upgrade",
            movimiento_id: existing[0].id,
            checkoutUrl: null, // integrar gateway real
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

      // Crear movimiento pending (neto en BD; IVA/total quedan también en metadata para conciliación)
      const metadata = {
        tipo: "upgrade_prorrateo",
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

      const { data: ins, error: insErr } = await supabase
        .from("movimientos_financieros")
        .insert([
          {
            empresa_id: empresaId,
            tipo: "upgrade_prorrateo",
            estado: "pending",
            fecha: new Date().toISOString(),
            moneda: "ARS",
            monto_neto: round2(sim.deltaNeto),
            iva: round2(sim.iva),
            total: round2(sim.total),
            metadata,
          },
        ])
        .select("id")
        .single();

      if (insErr) {
        return NextResponse.json(
          { error: "No se pudo crear el movimiento de prorrateo", detail: insErr.message },
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
          nota: "Al confirmar pago vía webhook, se activará el nuevo plan.",
        },
        { status: 200 }
      );
    }

    if (isDowngrade) {
      // Programar cambio al fin del ciclo (sin créditos ni reembolsos)
      const { error: updErr } = await supabase
        .from("suscripciones")
        .update({
          plan_proximo_id: nuevoPlanId,
          cambio_programado_para: ciclo_fin,
        })
        .eq("empresa_id", empresaId);

      if (updErr) {
        return NextResponse.json(
          { error: "No se pudo programar el downgrade", detail: updErr.message },
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

    return NextResponse.json(
      { accion: "sin_cambio", mensaje: "El nuevo plan tiene el mismo precio que el actual." },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
