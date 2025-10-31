// app/api/billing/preview-change/route.ts
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
 * GET /api/billing/preview-change?nuevo_plan_id=...&empresa_id=...(opcional admin/root)
 * - Simula cambio de plan para la empresa.
 * - Upgrade: muestra delta prorrateado (neto + IVA).
 * - Downgrade: 0 ahora; se programa a fin de ciclo.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const nuevoPlanId = searchParams.get("nuevo_plan_id");
  const empresaIdParam = searchParams.get("empresa_id") || undefined;

  if (!nuevoPlanId) {
    return NextResponse.json(
      { error: "nuevo_plan_id es obligatorio" },
      { status: 400 }
    );
  }

  const supabase = supabaseServer();
  const ctx = await assertAuthAndGetContext(supabase); // { userId, role, empresaId (si aplica) }

  // Determinar empresa objetivo (si admin/root, puede pasar empresa_id)
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

  // Obtener estado de suscripción (ciclo y plan actual)
  const sus = await getSuscripcionEstado(supabase, empresaId);
  if (!sus) {
    return NextResponse.json(
      {
        error:
          "La empresa no tiene suscripción/ciclo vigente. Debe tener un plan actual para simular cambios.",
      },
      { status: 409 }
    );
  }

  const {
    ciclo_inicio,
    ciclo_fin,
    plan_actual_id,
    plan_actual_nombre,
    plan_proximo_id,
    plan_proximo_nombre,
  } = sus;

  if (!plan_actual_id) {
    return NextResponse.json(
      { error: "No se pudo determinar el plan actual de la empresa." },
      { status: 409 }
    );
  }

  // Precios netos (preferir override si aplica para plan_actual; para nuevo plan, precio de planes)
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

  // Cálculo de prorrateo
  const sim = calcularDeltaProrrateo({
    cicloInicioISO: ciclo_inicio,
    cicloFinISO: ciclo_fin,
    precioActualNeto: precioActual,
    precioNuevoNeto: precioNuevo,
    alicuotaIVA: 0.21, // AR
  });

  // Determinar acción (upgrade / downgrade / sin_cambio)
  let accion: "upgrade" | "downgrade" | "sin_cambio" = "sin_cambio";
  if (precioNuevo > precioActual) accion = "upgrade";
  else if (precioNuevo < precioActual) accion = "downgrade";

  const resp = {
    accion,
    empresa_id: empresaId,
    ciclo: {
      inicio: ciclo_inicio,
      fin: ciclo_fin,
      dias_ciclo: sim.diasCiclo,
      dias_restantes: sim.diasRestantes,
      factor: round2(sim.factor),
    },
    actual: {
      plan_id: plan_actual_id,
      nombre: plan_actual_nombre ?? null,
      precio_neto: round2(precioActual),
    },
    nuevo: {
      plan_id: nuevoPlanId,
      nombre: null, // opcional: podríamos traerlo, pero no es imprescindible para el cálculo
      precio_neto: round2(precioNuevo),
    },
    delta: {
      neto: round2(sim.deltaNeto),
      iva: round2(sim.iva),
      total: round2(sim.total),
      moneda: "ARS",
    },
    politica_downgrade:
      "El downgrade se aplica desde el próximo ciclo; sin reembolsos.",
    proximo_programado: plan_proximo_id
      ? {
          plan_id: plan_proximo_id,
          nombre: plan_proximo_nombre ?? null,
          aplica_desde: ciclo_fin,
        }
      : null,
  };

  return NextResponse.json(resp, { status: 200 });
}
