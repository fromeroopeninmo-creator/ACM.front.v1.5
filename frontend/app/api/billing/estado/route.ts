// app/api/billing/estado/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role =
  | "empresa"
  | "asesor"
  | "soporte"
  | "super_admin"
  | "super_admin_root"
  | string;

function toNum(x: any): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === "number") return x;
  if (typeof x === "string") return parseFloat(x) || 0;
  return Number(x) || 0;
}

export async function GET(req: Request) {
  try {
    // 1) Auth + contexto (unificado)
    const server = supabaseServer();
    const actor = await assertAuthAndGetContext(server);
    const role = (actor.role ?? "") as Role;

    // 2) Resolver empresa objetivo
    const url = new URL(req.url);
    const empresaIdParam = url.searchParams.get("empresaId") || undefined;

    // Admin/soporte puede pasar empresaIdParam; empresa/asesor usa su empresa
    const empresaId = await getEmpresaIdForActor({
      supabase: supabaseAdmin,
      actor,
      empresaIdParam,
    });

    if (!empresaId) {
      const needsParam =
        role === "super_admin_root" ||
        role === "super_admin" ||
        role === "soporte";
      return NextResponse.json(
        {
          error: needsParam
            ? "Falta 'empresaId' para consulta como admin/soporte."
            : "No se pudo resolver la empresa del usuario.",
        },
        { status: needsParam ? 400 : 400 }
      );
    }

    // 3) Verificar empresa existente (incluye suspensión)
    const { data: empRow, error: empErr } = await supabaseAdmin
      .from("empresas")
      .select(
        "id, nombre_comercial, razon_social, suspendida, suspendida_at, suspension_motivo"
      )
      .eq("id", empresaId)
      .maybeSingle();

    if (empErr) {
      return NextResponse.json({ error: empErr.message }, { status: 400 });
    }
    if (!empRow) {
      return NextResponse.json(
        { error: "Empresa no encontrada." },
        { status: 404 }
      );
    }

    // 4) Plan activo o último por fecha_inicio
    const { data: activo } = await supabaseAdmin
      .from("empresas_planes")
      .select(
        "id, plan_id, fecha_inicio, fecha_fin, activo, max_asesores_override"
      )
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .maybeSingle();

    let planEP = activo;
    if (!planEP) {
      const { data: ultimo } = await supabaseAdmin
        .from("empresas_planes")
        .select(
          "id, plan_id, fecha_inicio, fecha_fin, activo, max_asesores_override"
        )
        .eq("empresa_id", empresaId)
        .order("fecha_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      planEP = ultimo ?? null;
    }

    // Vista de suscripción/“próximo plan”
    const { data: vEstado } = await supabaseAdmin
      .from("v_suscripcion_estado")
      .select("plan_proximo_id, plan_proximo_nombre, cambio_programado_para")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    // 5) Flags de ciclo / vencimiento
    const now = new Date();
    let plan_vencido = false;
    let dias_desde_vencimiento: number | null = null;
    let en_periodo_gracia = false;
    let proximoCobro: string | null = null;

    if (planEP?.fecha_fin) {
      const fin = new Date(planEP.fecha_fin as string);
      if (!Number.isNaN(fin.getTime())) {
        proximoCobro = fin.toISOString();
        const diffMs = now.getTime() - fin.getTime(); // >0 si ya venció
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        dias_desde_vencimiento = diffDays;

        if (diffDays >= 0) {
          plan_vencido = true;
          en_periodo_gracia = diffDays <= 2;
        }
      }
    } else if (planEP?.fecha_inicio) {
      // Estimar fecha_fin con duracion_dias si no existe
      const { data: planRowDur, error: planErrDur } = await supabaseAdmin
        .from("planes")
        .select("duracion_dias")
        .eq("id", planEP.plan_id)
        .maybeSingle();

      if (!planErrDur && planRowDur?.duracion_dias) {
        try {
          const base = new Date(planEP.fecha_inicio as string);
          const d = new Date(base.getTime());
          d.setDate(d.getDate() + Number(planRowDur.duracion_dias));
          proximoCobro = d.toISOString();
        } catch {
          proximoCobro = null;
        }
      }
    }

    if (!planEP) {
      // No hay registro en empresas_planes → todo null salvo estado de suspensión
      return NextResponse.json(
        {
          plan: null,
          ciclo: { inicio: null, fin: null, proximoCobro: null },
          suscripcion: null,
          proximoPlan: vEstado?.plan_proximo_id
            ? {
                id: vEstado.plan_proximo_id,
                nombre: vEstado.plan_proximo_nombre ?? "",
              }
            : null,
          cambioProgramadoPara: vEstado?.cambio_programado_para ?? null,
          estado: {
            suspendida: !!empRow.suspendida,
            suspendida_motivo: empRow.suspension_motivo ?? null,
            suspendida_at: empRow.suspendida_at ?? null,
            plan_vencido: false,
            dias_desde_vencimiento: null,
            en_periodo_gracia: false,
          },
          // Nuevo bloque: features por defecto cuando no hay plan
          features: {
            tipo_plan: null,
            incluye_valuador: false,
            incluye_tracker: false,
          },
        },
        { status: 200 }
      );
    }

    // 6) Datos del plan (precio + tipo_plan / features)
    const { data: planRow, error: planErr } = await supabaseAdmin
      .from("planes")
      .select(
        "id, nombre, precio, duracion_dias, max_asesores, precio_extra_por_asesor, tipo_plan, incluye_valuador, incluye_tracker, es_trial"
      )
      .eq("id", planEP.plan_id)
      .maybeSingle();

    if (planErr) {
      return NextResponse.json({ error: planErr.message }, { status: 400 });
    }

    const precioNeto = toNum(planRow?.precio ?? 0);
    const iva = Math.round(precioNeto * 0.21 * 100) / 100;
    const totalConIVA = Math.round((precioNeto + iva) * 100) / 100;

    // 7) Última suscripción si existe
    const { data: susRow } = await supabaseAdmin
      .from("suscripciones")
      .select(
        "estado, inicio, fin, externo_customer_id, externo_subscription_id"
      )
      .eq("empresa_id", empresaId)
      .order("inicio", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 8) Si no se calculó proximoCobro arriba, intentar de nuevo
    if (!proximoCobro) {
      if (planEP.fecha_fin) {
        proximoCobro = new Date(planEP.fecha_fin as string).toISOString();
      } else if (planEP.fecha_inicio && planRow?.duracion_dias) {
        try {
          const base = new Date(planEP.fecha_inicio as string);
          const d = new Date(base.getTime());
          d.setDate(d.getDate() + Number(planRow.duracion_dias));
          proximoCobro = d.toISOString();
        } catch {
          proximoCobro = null;
        }
      }
    }

    // Normalizamos flags de features para que siempre haya algo consistente
    const tipoPlan = planRow?.tipo_plan ?? null;
    const incluyeValuador = !!planRow?.incluye_valuador;
    const incluyeTracker = !!planRow?.incluye_tracker;

    return NextResponse.json(
      {
        plan: planRow
          ? {
              id: planRow.id,
              nombre: planRow.nombre,
              precioNeto,
              totalConIVA,
              // NUEVO: info del tipo de plan / features
              tipo_plan: tipoPlan, // "core" | "combo" | "tracker_only" | "trial"
              incluye_valuador: incluyeValuador,
              incluye_tracker: incluyeTracker,
              es_trial: !!planRow.es_trial,
            }
          : null,
        ciclo: {
          inicio: planEP.fecha_inicio,
          fin: planEP.fecha_fin,
          proximoCobro,
        },
        suscripcion: susRow
          ? {
              estado: susRow.estado, // activa | suspendida | cancelada | pendiente
              externoCustomerId: susRow.externo_customer_id ?? null,
              externoSubscriptionId: susRow.externo_subscription_id ?? null,
            }
          : null,
        proximoPlan: vEstado?.plan_proximo_id
          ? {
              id: vEstado.plan_proximo_id,
              nombre: vEstado.plan_proximo_nombre ?? "",
            }
          : null,
        cambioProgramadoPara: vEstado?.cambio_programado_para ?? null,
        estado: {
          suspendida: !!empRow.suspendida,
          suspendida_motivo: empRow.suspension_motivo ?? null,
          suspendida_at: empRow.suspendida_at ?? null,
          plan_vencido,
          dias_desde_vencimiento,
          en_periodo_gracia,
        },
        // NUEVO: bloque explícito de features del plan actual
        features: {
          tipo_plan: tipoPlan,
          incluye_valuador: incluyeValuador,
          incluye_tracker: incluyeTracker,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("billing/estado GET error:", e?.message || e);
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

// IMPORTS que este archivo ya usaba desde utils (se mantienen igual)
import {
  assertAuthAndGetContext,
  getEmpresaIdForActor,
} from "#lib/billing/utils";
