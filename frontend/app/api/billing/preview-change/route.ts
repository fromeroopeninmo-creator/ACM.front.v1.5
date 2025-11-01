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
 * - Simula cambio de plan para la empresa.
 * - Upgrade: calcula delta prorrateado (neto/iva/total).
 * - Downgrade: delta 0 y se informa que aplica al próximo ciclo.
 *
 * Respuesta ADAPTADA al tipo PreviewResult del frontend:
 * {
 *   tipo: "upgrade" | "downgrade" | "sin_cambio",
 *   empresa_id: string,
 *   plan_actual?: { id, nombre, precio_neto? } | null,
 *   plan_nuevo?: { id, nombre, precio_neto? } | null,
 *   dias_ciclo?: number | null,
 *   dias_restantes?: number | null,
 *   delta_neto?: number,
 *   iva?: number,
 *   total?: number,
 *   aplicar_desde?: string | null,
 *   nota?: string | null
 * }
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const nuevoPlanId = url.searchParams.get("nuevo_plan_id");
    const empresaIdParam = url.searchParams.get("empresa_id") || undefined;
    // opcional desde UI (para Personalizado). Hoy no altera cálculo en utils; lo exponemos como nota informativa.
    const overrideStr = url.searchParams.get("max_asesores_override");
    const maxAsesoresOverride =
      overrideStr && !isNaN(Number(overrideStr)) ? Number(overrideStr) : undefined;

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

    let tipo: "upgrade" | "downgrade" | "sin_cambio" = "sin_cambio";
    if (precioNuevo > precioActual) tipo = "upgrade";
    else if (precioNuevo < precioActual) tipo = "downgrade";

    // (opcional) Traer nombre del nuevo plan para mostrar en el modal si querés
    let nuevoPlanNombre: string | null = null;
    {
      const { data: p } = await supabase
        .from("planes")
        .select("nombre")
        .eq("id", nuevoPlanId)
        .maybeSingle();
      nuevoPlanNombre = (p?.nombre as string) ?? null;
    }

    // Estructura EXACTA esperada por el frontend (PreviewResult)
    const resp: any = {
      tipo,
      empresa_id: empresaId,
      plan_actual: {
        id: plan_actual_id,
        nombre: plan_actual_nombre ?? null,
        precio_neto: round2(precioActual),
      },
      plan_nuevo: {
        id: nuevoPlanId,
        nombre: nuevoPlanNombre,
        precio_neto: round2(precioNuevo),
      },
      dias_ciclo: sim.diasCiclo,
      dias_restantes: sim.diasRestantes,
      delta_neto: round2(sim.deltaNeto),
      iva: round2(sim.iva),
      total: round2(sim.total),
      aplicar_desde: tipo === "downgrade" ? ciclo_fin : null,
      nota:
        tipo === "downgrade"
          ? "El downgrade se aplicará al próximo ciclo; sin reembolsos ni créditos."
          : maxAsesoresOverride
          ? `Simulación con ${maxAsesoresOverride} asesores (Personalizado).`
          : null,
    };

    return NextResponse.json(resp, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
