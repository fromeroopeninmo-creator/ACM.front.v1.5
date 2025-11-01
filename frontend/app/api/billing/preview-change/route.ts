// app/api/billing/preview-change/route.ts
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
 * GET /api/billing/preview-change?nuevo_plan_id=...&empresa_id=...(opcional admin/root)
 * - Simula cambio de plan para la empresa.
 * - Upgrade: calcula delta prorrateado (neto/iva/total).
 * - Downgrade: delta 0 y se informa que aplica al próximo ciclo.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const nuevoPlanId = url.searchParams.get("nuevo_plan_id");
    const empresaIdParam = url.searchParams.get("empresa_id") || undefined;

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
        { error: "Empresa sin plan actual/ciclo vigente para simular." },
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

    // Precios netos (override actual si aplica; para nuevo plan, precio de planes)
    const precioActual = await getPlanPrecioNetoPreferido(supabase, plan_actual_id, empresaId);
    const precioNuevo = await getPlanPrecioNetoPreferido(supabase, nuevoPlanId, empresaId);

    if (precioActual == null || precioNuevo == null) {
      return NextResponse.json(
        { error: "No se pudieron resolver los precios netos (planes/override)." },
        { status: 409 }
      );
    }

    const sim = calcularDeltaProrrateo({
      cicloInicioISO: ciclo_inicio,
      cicloFinISO: ciclo_fin,
      precioActualNeto: precioActual,
      precioNuevoNeto: precioNuevo,
      alicuotaIVA: 0.21,
    });

    let accion: "upgrade" | "downgrade" | "sin_cambio" = "sin_cambio";
    if (precioNuevo > precioActual) accion = "upgrade";
    else if (precioNuevo < precioActual) accion = "downgrade";

    return NextResponse.json(
      {
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
          nombre: null, // opcional (no requerido para el cálculo)
          precio_neto: round2(precioNuevo),
        },
        delta: {
          neto: round2(sim.deltaNeto),
          iva: round2(sim.iva),
          total: round2(sim.total),
          moneda: "ARS",
        },
        politica_downgrade:
          "El downgrade se aplicará desde el próximo ciclo; sin reembolsos ni créditos.",
        proximo_programado: plan_proximo_id
          ? {
              plan_id: plan_proximo_id,
              nombre: plan_proximo_nombre ?? null,
              aplica_desde: ciclo_fin,
            }
          : null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
