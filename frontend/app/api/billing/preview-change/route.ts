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
 * GET /api/billing/preview-change?nuevo_plan_id=...&empresa_id=...(opcional admin/root)&max_asesores_override=...(opcional)
 *
 * Devuelve EXACTAMENTE el shape que espera el front:
 *
 * type PreviewResult = {
 *   tipo: "upgrade" | "downgrade" | "sin_cambio";
 *   empresa_id: string;
 *   plan_actual?: { id: string; nombre: string; precio_neto?: number | null } | null;
 *   plan_nuevo?: { id: string; nombre: string; precio_neto?: number | null } | null;
 *   dias_ciclo?: number | null;
 *   dias_restantes?: number | null;
 *   delta_neto?: number;
 *   iva?: number;
 *   total?: number;
 *   aplicar_desde?: string | null;
 *   nota?: string | null;
 * };
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const nuevoPlanId = url.searchParams.get("nuevo_plan_id");
    const empresaIdParam = url.searchParams.get("empresa_id") || undefined;

    // opcional, usado para plan "Personalizado"
    const maxAsesoresOverrideParam = url.searchParams.get("max_asesores_override");
    const parsedOverride = maxAsesoresOverrideParam
      ? parseInt(maxAsesoresOverrideParam, 10)
      : NaN;
    const maxAsesoresOverride =
      Number.isFinite(parsedOverride) && parsedOverride > 0
        ? parsedOverride
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

    // Precios netos actuales/nuevo plan (con override si aplica)
    const precioActual = await getPlanPrecioNetoPreferido(
      supabase,
      plan_actual_id,
      empresaId
    );
    const precioNuevo = await getPlanPrecioNetoPreferido(
      supabase,
      nuevoPlanId,
      empresaId,
      maxAsesoresOverride
    );

    if (precioActual == null || precioNuevo == null) {
      return NextResponse.json(
        { error: "No se pudieron resolver los precios netos (planes)." },
        { status: 409 }
      );
    }

    // 👇 NUEVO: tratar trial/free o ciclo vencido como ciclo completo nuevo
    const isTrialOrFree = precioActual <= 0;

    const simBase = calcularDeltaProrrateo({
      cicloInicioISO: ciclo_inicio,
      cicloFinISO: ciclo_fin,
      precioActualNeto: precioActual,
      precioNuevoNeto: precioNuevo,
      alicuotaIVA: 0.21,
    });

    let sim = simBase;

    if (isTrialOrFree || simBase.diasRestantes <= 0) {
      const diasCiclo = simBase.diasCiclo ?? null;
      const deltaNeto = round2(precioNuevo);
      const iva = round2(deltaNeto * 0.21);
      const total = round2(deltaNeto + iva);

      sim = {
        ...simBase,
        diasCiclo,
        diasRestantes: diasCiclo,
        deltaNeto,
        iva,
        total,
      };
    }

    let tipo: "upgrade" | "downgrade" | "sin_cambio" = "sin_cambio";
    if (precioNuevo > precioActual) tipo = "upgrade";
    else if (precioNuevo < precioActual) tipo = "downgrade";

    // Nota para el modal
    let nota: string | null = null;
    let aplicar_desde: string | null = null;

    if (tipo === "upgrade") {
      if (isTrialOrFree || sim.diasRestantes <= 0) {
        nota =
          "Como tu plan actual es gratuito o ya venció, se cobrará el valor completo del nuevo ciclo.";
      } else {
        nota =
          "Se cobrará solo la diferencia prorrateada por los días restantes del ciclo actual.";
      }
      aplicar_desde = ciclo_inicio; // visual: se muestra desde el ciclo actual
    } else if (tipo === "downgrade") {
      nota =
        "El downgrade se aplicará desde el próximo ciclo; sin reembolsos ni créditos.";
      aplicar_desde = ciclo_fin;
    }

    return NextResponse.json(
      {
        tipo,
        empresa_id: empresaId,

        plan_actual: {
          id: plan_actual_id,
          nombre: plan_actual_nombre ?? "",
          precio_neto: round2(precioActual),
        },

        plan_nuevo: {
          id: nuevoPlanId,
          nombre: "", // la UI usa el nombre del card, acá no es obligatorio
          precio_neto: round2(precioNuevo),
        },

        dias_ciclo: sim.diasCiclo,
        dias_restantes: sim.diasRestantes,

        // Montos prorrateados o ciclo completo (según corresponda)
        delta_neto: round2(sim.deltaNeto),
        iva: round2(sim.iva),
        total: round2(sim.total),

        aplicar_desde,
        nota,

        // Info extra opcional que HOY la UI no usa, pero puede servir luego
        proximo_programado: plan_proximo_id
          ? {
              id: plan_proximo_id,
              nombre: plan_proximo_nombre ?? null,
              aplica_desde: ciclo_fin,
            }
          : null,
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
