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
    const nuevoPlanId = url.searchParams.get("nuevo_plan_id") ?? undefined;
    const empresaIdParam = url.searchParams.get("empresa_id") || undefined;

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

    const { ciclo_inicio, ciclo_fin, plan_actual_id } = sus;

    // Precios netos (ambos desde planes.precio)
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
        { error: "No se pudieron resolver los precios netos de los planes." },
        { status: 409 }
      );
    }

    // Nombres de los planes
    const { data: planActualRow } = await supabase
      .from("planes")
      .select("id, nombre")
      .eq("id", plan_actual_id)
      .maybeSingle();

    const { data: planNuevoRow } = await supabase
      .from("planes")
      .select("id, nombre")
      .eq("id", nuevoPlanId)
      .maybeSingle();

    // Simulación prorrateo
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

    // Base de respuesta
    const base = {
      tipo,
      empresa_id: empresaId,
      plan_actual: {
        id: plan_actual_id,
        nombre: planActualRow?.nombre ?? "Plan actual",
        precio_neto: round2(precioActual),
      },
      plan_nuevo: {
        id: nuevoPlanId,
        nombre: planNuevoRow?.nombre ?? "Nuevo plan",
        precio_neto: round2(precioNuevo),
      },
      dias_ciclo: sim.diasCiclo,
      dias_restantes: sim.diasRestantes,
    } as any;

    if (tipo === "upgrade") {
      return NextResponse.json(
        {
          ...base,
          delta_neto: round2(sim.deltaNeto),
          iva: round2(sim.iva),
          total: round2(sim.total),
          aplicar_desde: null,
          nota:
            "Al confirmar el pago se aplicará el nuevo plan en este ciclo de facturación.",
        },
        { status: 200 }
      );
    }

    if (tipo === "downgrade") {
      return NextResponse.json(
        {
          ...base,
          delta_neto: 0,
          iva: 0,
          total: 0,
          aplicar_desde: ciclo_fin,
          nota:
            "El downgrade se aplicará desde el próximo ciclo. No se generan reembolsos ni créditos.",
        },
        { status: 200 }
      );
    }

    // Sin cambio de precio
    return NextResponse.json(
      {
        ...base,
        delta_neto: 0,
        iva: 0,
        total: 0,
        aplicar_desde: null,
        nota: "El nuevo plan tiene el mismo precio que el actual.",
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
