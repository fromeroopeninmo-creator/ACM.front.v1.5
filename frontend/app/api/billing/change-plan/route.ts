// app/api/billing/change-plan/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";
import {
  assertAuthAndGetContext,
  getEmpresaIdForActor,
  getPlanPrecioNetoPreferido,
  getSuscripcionEstado,
  calcularDeltaProrrateo,
  round2,
} from "#lib/billing/utils";

/**
 * POST /api/billing/change-plan
 * Body: { nuevo_plan_id: string, empresa_id?: string }
 * - Upgrade: crea movimiento 'upgrade_prorrateo' (pending) y devuelve checkoutUrl (placeholder).
 * - Downgrade: programa el cambio en suscripciones (plan_proximo_id / cambio_programado_para = ciclo_fin).
 */
export async function POST(req: Request) {
  const supabase = supabaseServer();
  const ctx = await assertAuthAndGetContext(supabase);

  let body: { nuevo_plan_id?: string; empresa_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { nuevo_plan_id: nuevoPlanId, empresa_id: empresaIdParam } = body;
  if (!nuevoPlanId) {
    return NextResponse.json(
      { error: "nuevo_plan_id es obligatorio" },
      { status: 400 }
    );
  }

  const empresaId = await getEmpresaIdForActor({
    supabase,
    actor: ctx,
    empresaIdParam,
  });
  if (!empresaId) {
    return NextResponse.json(
      { error: "No se pudo resolver empresa_id (ver permisos / profiles)" },
      { status: 403 }
    );
  }

  const sus = await getSuscripcionEstado(supabase, empresaId);
  if (!sus) {
    return NextResponse.json(
      {
        error:
          "La empresa no tiene suscripción/ciclo vigente. Debe tener un plan actual para cambiar.",
      },
      { status: 409 }
    );
  }

  const { ciclo_inicio, ciclo_fin, plan_actual_id } = sus;
  if (!plan_actual_id) {
    return NextResponse.json(
      { error: "No se pudo determinar el plan actual de la empresa." },
      { status: 409 }
    );
  }

  const precioActual = await getPlanPrecioNetoPreferido(
    supabase,
    plan_actual_id,
    empresaId
  );
  const precioNuevo = await getPlanPrecioNetoPreferido(
    supabase,
    nuevoPlanId,
    empresaId
  );

  if (precioActual == null || precioNuevo == null) {
    return NextResponse.json(
      { error: "No se pudieron resolver precios netos de los planes." },
      { status: 409 }
    );
  }

  // ¿Upgrade o downgrade?
  const isUpgrade = precioNuevo > precioActual;
  const isDowngrade = precioNuevo < precioActual;

  if (isUpgrade) {
    // Calcular delta prorrateado
    const sim = calcularDeltaProrrateo({
      cicloInicioISO: ciclo_inicio,
      cicloFinISO: ciclo_fin,
      precioActualNeto: precioActual,
      precioNuevoNeto: precioNuevo,
      alicuotaIVA: 0.21,
    });

    // Idempotencia básica: ¿ya hay un movimiento pending para este par en este ciclo?
    // NOTA: Ajusta los nombres de columnas de movimientos_financieros si difieren.
    const { data: existing, error: exErr } = await supabase
      .from("movimientos_financieros")
      .select("id, estado, metadata")
      .eq("empresa_id", empresaId)
      .eq("tipo", "upgrade_prorrateo")
      .eq("estado", "pending")
      .gte("fecha", ciclo_inicio) // en el ciclo actual
      .lte("fecha", ciclo_fin);

    if (exErr) {
      return NextResponse.json(
        { error: "Error buscando movimientos existentes", detail: exErr.message },
        { status: 500 }
      );
    }

    if (existing && existing.length > 0) {
      // Reusar checkout/intent si ya existiera (placeholder)
      return NextResponse.json(
        {
          accion: "upgrade",
          movimiento_id: existing[0].id,
          checkoutUrl: null, // integrar con gateway y devolver URL
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

    // Crear movimiento 'pending'
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
          fecha: new Date().toISOString(),
          estado: "pending",
          moneda: "ARS",
          monto_neto: round2(sim.deltaNeto),
          // Si tu tabla tiene columnas separadas de IVA/total, puedes incluirlas:
          // iva: round2(sim.iva),
          // total: round2(sim.total),
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

    // TODO: integrar gateway -> crear intent/checkout y devolver URL
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
        nota: "Al confirmar el pago (webhook OK), activar el nuevo plan en empresas_planes.",
      },
      { status: 200 }
    );
  }

  if (isDowngrade) {
    // Programar para fin de ciclo (sin crédito ni reembolso).
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

  // Mismo precio: sin cambio
  return NextResponse.json(
    { accion: "sin_cambio", mensaje: "El nuevo plan tiene el mismo precio." },
    { status: 200 }
  );
}
