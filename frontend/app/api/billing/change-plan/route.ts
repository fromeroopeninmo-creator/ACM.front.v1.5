// app/api/billing/change-plan/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";
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

// Cliente ADMIN (bypassa RLS, solo usar en backend con checks propios)
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

/**
 * POST /api/billing/change-plan
 * Body: { nuevo_plan_id: string, empresa_id?: string }
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
    // max_asesores_override podría venir en body, pero de momento
    // no lo usamos aquí (queda para una iteración futura).

    if (!nuevoPlanId) {
      return NextResponse.json(
        { error: "nuevo_plan_id es obligatorio" },
        { status: 400 }
      );
    }

    // 1) Autenticación con cliente "user" (respeta cookies / sesión)
    const supabaseUser = supabaseServer();
    const ctx = await assertAuthAndGetContext(supabaseUser);

    // 2) Resolver empresa según rol (empresa/asesor vs admin/root)
    const empresaId = await getEmpresaIdForActor({
      supabase: supabaseUser,
      actor: ctx,
      empresaIdParam,
    });

    if (!empresaId) {
      return NextResponse.json(
        { error: "No se pudo resolver empresa_id (ver permisos / profiles)." },
        { status: 403 }
      );
    }

    // 3) Leer estado de suscripción/ciclo usando cliente ADMIN
    const sus = await getSuscripcionEstado(supabaseAdmin, empresaId);
    if (!sus?.plan_actual_id) {
      return NextResponse.json(
        { error: "Empresa sin plan actual/ciclo vigente para cambiar." },
        { status: 409 }
      );
    }

    const { ciclo_inicio, ciclo_fin, plan_actual_id } = sus;

    // 4) Precios netos de ambos planes (con overrides si aplica), usando ADMIN
    const precioActual = await getPlanPrecioNetoPreferido(
      supabaseAdmin,
      plan_actual_id,
      empresaId
    );
    const precioNuevo = await getPlanPrecioNetoPreferido(
      supabaseAdmin,
      nuevoPlanId,
      empresaId
    );

    if (precioActual == null || precioNuevo == null) {
      return NextResponse.json(
        { error: "No se pudieron resolver los precios netos (planes)." },
        { status: 409 }
      );
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

      // Crear nuevo movimiento pending (ADMIN, sin RLS)
      const metadata = {
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
      const { error: updErr } = await supabaseAdmin
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
