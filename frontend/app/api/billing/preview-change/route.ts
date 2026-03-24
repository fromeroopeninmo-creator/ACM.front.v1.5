// app/api/billing/preview-change/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";
import {
  assertAuthAndGetContext,
  getEmpresaIdForActor,
  getSuscripcionEstado,
  resolveEmpresaBillingConfig,
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

function calcularDiasCicloYRestantes(params: {
  cicloInicioISO: string;
  cicloFinISO: string;
}) {
  const inicio = new Date(params.cicloInicioISO).getTime();
  const fin = new Date(params.cicloFinISO).getTime();
  const ahora = Date.now();

  const msCiclo = Math.max(fin - inicio, 0);
  const msRest = Math.max(fin - ahora, 0);

  const diasCiclo = Math.max(Math.ceil(msCiclo / 86400000), 0);
  const diasRestantes = Math.max(Math.ceil(msRest / 86400000), 0);
  const factor = diasCiclo > 0 ? diasRestantes / diasCiclo : 0;

  return { diasCiclo, diasRestantes, factor };
}

function addDaysToDateOnly(dateOnly: string, days: number): string {
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getTodayISODateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const nuevoPlanId = url.searchParams.get("nuevo_plan_id");
    const empresaIdParam = url.searchParams.get("empresa_id") || undefined;

    // opcional, usado para plan "Personalizado"
    const maxAsesoresOverrideParam = url.searchParams.get(
      "max_asesores_override"
    );
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

    // Escenario nuevo / reactivación:
    // Si la empresa no tiene plan actual o no tiene ciclo vigente completo,
    // no debe devolver 409. Debe simular alta/reactivación cobrando ciclo completo.
    if (!sus?.plan_actual_id || !sus?.ciclo_inicio || !sus?.ciclo_fin) {
      const nuevoConfig = await resolveEmpresaBillingConfig({
        supabase,
        empresaId,
        planId: nuevoPlanId,
        maxAsesoresOverride,
        forzarSinAcuerdo: true,
      });

      const hoy = getTodayISODateOnly();
      const duracionDias =
        typeof nuevoConfig.plan_duracion_dias === "number" &&
        nuevoConfig.plan_duracion_dias > 0
          ? nuevoConfig.plan_duracion_dias
          : 30;

      const cicloFinEstimado = addDaysToDateOnly(hoy, duracionDias);

      return NextResponse.json(
        {
          tipo: "upgrade",
          empresa_id: empresaId,

          plan_actual: null,

          plan_nuevo: {
            id: nuevoPlanId,
            nombre: nuevoConfig.plan_nombre ?? "",
            precio_neto: round2(nuevoConfig.precio_neto_final),
          },

          dias_ciclo: duracionDias,
          dias_restantes: duracionDias,

          // Alta / reactivación = cobro ciclo completo
          delta_neto: round2(nuevoConfig.precio_neto_final),
          iva: round2(nuevoConfig.iva_importe),
          total: round2(nuevoConfig.precio_total_final),

          aplicar_desde: hoy,
          nota:
            "No tenés un plan activo. Se cobrará el valor completo del nuevo ciclo para reactivar la cuenta.",

          proximo_programado: null,

          pricing_actual: null,

          pricing_nuevo: {
            precio_base_neto: nuevoConfig.precio_base_neto,
            precio_neto_final: nuevoConfig.precio_neto_final,
            modo_iva: nuevoConfig.modo_iva,
            iva_pct: nuevoConfig.iva_pct,
            iva_importe: nuevoConfig.iva_importe,
            precio_total_final: nuevoConfig.precio_total_final,
            pricing_source: nuevoConfig.pricing_source,
            agreement_applied: nuevoConfig.agreement_applied,
            agreement_id: nuevoConfig.agreement_id,
            agreement_tipo: nuevoConfig.agreement_tipo,
          },

          // Extras útiles para debugging / futura UI
          ciclo_estimado: {
            inicio: hoy,
            fin: cicloFinEstimado,
          },
        },
        { status: 200 }
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

    // Escenario actual:
    // - Sí considera acuerdo comercial activo si existe
    const actualConfig = await resolveEmpresaBillingConfig({
      supabase,
      empresaId,
      planId: plan_actual_id,
    });

    // Escenario nuevo:
    // - NO hereda automáticamente el acuerdo comercial actual
    // - Sí usa override de max asesores si el admin lo está simulando
    const nuevoConfig = await resolveEmpresaBillingConfig({
      supabase,
      empresaId,
      planId: nuevoPlanId,
      maxAsesoresOverride,
      forzarSinAcuerdo: true,
    });

    const precioActualNeto = round2(actualConfig.precio_neto_final);
    const precioNuevoNeto = round2(nuevoConfig.precio_neto_final);

    const dias = calcularDiasCicloYRestantes({
      cicloInicioISO: ciclo_inicio,
      cicloFinISO: ciclo_fin,
    });

    // Trial/free o ciclo vencido => cobrar ciclo completo del nuevo escenario
    const isTrialOrFree = precioActualNeto <= 0;
    const cicloVencido = dias.diasRestantes <= 0;

    let deltaNeto = 0;
    let iva = 0;
    let total = 0;

    if (isTrialOrFree || cicloVencido) {
      deltaNeto = round2(nuevoConfig.precio_neto_final);
      iva = round2(nuevoConfig.iva_importe);
      total = round2(nuevoConfig.precio_total_final);
    } else {
      // Para upgrades prorrateamos la diferencia.
      // Para downgrades no hay cobro inmediato.
      const deltaBase = Math.max(precioNuevoNeto - precioActualNeto, 0);
      const factor = dias.factor ?? 0;
      deltaNeto = round2(deltaBase * factor);

      if (deltaNeto > 0) {
        // Reutilizamos el modo fiscal del escenario nuevo para el importe a cobrar.
        // Si el nuevo plan no aplica IVA, el cobro prorrateado tampoco lo aplica.
        // Si lo incluye, el monto se interpreta como total pactado con IVA incluido.
        if (nuevoConfig.modo_iva === "no_aplica") {
          iva = 0;
          total = round2(deltaNeto);
        } else if (nuevoConfig.modo_iva === "incluido_en_precio") {
          const tasa = (nuevoConfig.iva_pct ?? 21) / 100;
          if (tasa > 0) {
            const neto = deltaNeto / (1 + tasa);
            const ivaIncluido = deltaNeto - neto;
            deltaNeto = round2(neto);
            iva = round2(ivaIncluido);
            total = round2(deltaNeto + iva);
          } else {
            iva = 0;
            total = round2(deltaNeto);
          }
        } else {
          iva = round2(deltaNeto * ((nuevoConfig.iva_pct ?? 21) / 100));
          total = round2(deltaNeto + iva);
        }
      } else {
        iva = 0;
        total = 0;
      }
    }

    let tipo: "upgrade" | "downgrade" | "sin_cambio" = "sin_cambio";
    if (precioNuevoNeto > precioActualNeto) tipo = "upgrade";
    else if (precioNuevoNeto < precioActualNeto) tipo = "downgrade";

    // Nota para el modal
    let nota: string | null = null;
    let aplicar_desde: string | null = null;

    if (tipo === "upgrade") {
      if (isTrialOrFree || cicloVencido) {
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
          nombre: actualConfig.plan_nombre ?? plan_actual_nombre ?? "",
          precio_neto: round2(precioActualNeto),
        },

        plan_nuevo: {
          id: nuevoPlanId,
          nombre: nuevoConfig.plan_nombre ?? "",
          precio_neto: round2(precioNuevoNeto),
        },

        dias_ciclo: dias.diasCiclo,
        dias_restantes:
          isTrialOrFree || cicloVencido ? dias.diasCiclo : dias.diasRestantes,

        // Montos prorrateados o ciclo completo (según corresponda)
        delta_neto: round2(deltaNeto),
        iva: round2(iva),
        total: round2(total),

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

        // Extras útiles para futura UI/admin
        pricing_actual: {
          precio_base_neto: actualConfig.precio_base_neto,
          precio_neto_final: actualConfig.precio_neto_final,
          modo_iva: actualConfig.modo_iva,
          iva_pct: actualConfig.iva_pct,
          iva_importe: actualConfig.iva_importe,
          precio_total_final: actualConfig.precio_total_final,
          pricing_source: actualConfig.pricing_source,
          agreement_applied: actualConfig.agreement_applied,
          agreement_id: actualConfig.agreement_id,
          agreement_tipo: actualConfig.agreement_tipo,
        },

        pricing_nuevo: {
          precio_base_neto: nuevoConfig.precio_base_neto,
          precio_neto_final: nuevoConfig.precio_neto_final,
          modo_iva: nuevoConfig.modo_iva,
          iva_pct: nuevoConfig.iva_pct,
          iva_importe: nuevoConfig.iva_importe,
          precio_total_final: nuevoConfig.precio_total_final,
          pricing_source: nuevoConfig.pricing_source,
          agreement_applied: nuevoConfig.agreement_applied,
          agreement_id: nuevoConfig.agreement_id,
          agreement_tipo: nuevoConfig.agreement_tipo,
        },
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
