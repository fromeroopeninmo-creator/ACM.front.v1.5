// app/api/solicitud-upgrade/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

/** ───────────────── helpers ───────────────── **/

// Acepta empresas.id o empresas.user_id y devuelve empresas.id real
async function resolverEmpresaId(empresaIdOUserId: string): Promise<string | null> {
  // 1) probar como empresas.id
  const { data: empPorId } = await supabase
    .from("empresas")
    .select("id")
    .eq("id", empresaIdOUserId)
    .maybeSingle();
  if (empPorId?.id) return empPorId.id;

  // 2) probar como empresas.user_id
  const { data: empPorUser } = await supabase
    .from("empresas")
    .select("id")
    .eq("user_id", empresaIdOUserId)
    .maybeSingle();
  return empPorUser?.id ?? null;
}

function addDaysISO(dateISO: string, days: number) {
  const d = new Date(dateISO);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** ───────────────── endpoint ───────────────── **/

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { empresaId, planId, maxAsesoresOverride } = body || {};

    if (!empresaId || !planId) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios (empresaId, planId)." },
        { status: 400 }
      );
    }

    // Resolver empresas.id real
    const empresaIdReal = await resolverEmpresaId(empresaId);
    if (!empresaIdReal) {
      return NextResponse.json(
        { error: "Empresa no encontrada para el identificador provisto." },
        { status: 404 }
      );
    }

    // Traer plan destino
    const { data: plan, error: planError } = await supabase
      .from("planes")
      .select("id, nombre, duracion_dias, max_asesores")
      .eq("id", planId)
      .maybeSingle();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "No se encontró el plan solicitado." },
        { status: 404 }
      );
    }

    const nombrePlan = (plan.nombre || "").toLowerCase();
    let override: number | null = null;

    // Validación para Personalizado (override 21..50)
    if (nombrePlan === "personalizado") {
      const ov = Number(maxAsesoresOverride);
      if (!Number.isFinite(ov) || ov < 21 || ov > 50) {
        return NextResponse.json(
          { error: "Para el plan Personalizado, maxAsesoresOverride debe estar entre 21 y 50." },
          { status: 400 }
        );
      }
      override = ov;
    }

    // Si el plan actual es el mismo y (no es personalizado) => no hacemos nada.
    // Si es personalizado, solo “no hacemos nada” si el override también coincide.
    const { data: planActual } = await supabase
      .from("empresas_planes")
      .select("plan_id, activo, max_asesores_override")
      .eq("empresa_id", empresaIdReal)
      .eq("activo", true)
      .maybeSingle();

    if (planActual?.plan_id === plan.id) {
      const mismoOverride =
        nombrePlan !== "personalizado" ||
        Number(planActual.max_asesores_override ?? null) === override;

      if (mismoOverride) {
        return NextResponse.json({
          success: true,
          message:
            nombrePlan === "personalizado"
              ? `✅ Ya estás en "${plan.nombre}" con ${override} asesores.`
              : `✅ Ya estás en el plan "${plan.nombre}".`,
        });
      }
      // Si el plan es el mismo pero cambió el override (personalizado), seguimos para actualizar.
    }

    // Fechas
    const hoy = new Date();
    const fecha_inicio = hoy.toISOString().slice(0, 10);
    const dur = Number(plan.duracion_dias) || 30;
    const fecha_fin = addDaysISO(fecha_inicio, dur);

    // Desactivar planes previos activos
    const { error: deactivateErr } = await supabase
      .from("empresas_planes")
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq("empresa_id", empresaIdReal)
      .eq("activo", true);

    if (deactivateErr) {
      console.error("❌ Error al desactivar plan previo:", deactivateErr);
      return NextResponse.json(
        { error: "No se pudo desactivar el plan anterior." },
        { status: 500 }
      );
    }

    // Insertar nuevo plan activo (con override si corresponde)
    const insertPayload: any = {
      empresa_id: empresaIdReal,
      plan_id: plan.id,
      fecha_inicio,
      fecha_fin,
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (override !== null) insertPayload.max_asesores_override = override;

    const { data: nuevoPlan, error: insertErr } = await supabase
      .from("empresas_planes")
      .insert([insertPayload])
      .select("id, empresa_id, plan_id, fecha_inicio, fecha_fin, activo, max_asesores_override")
      .maybeSingle();

    if (insertErr || !nuevoPlan) {
      console.error("❌ Error al insertar nuevo plan:", insertErr);
      return NextResponse.json(
        { error: "No se pudo activar el nuevo plan." },
        { status: 500 }
      );
    }

    // Actualizar empresas.plan_activo_id (para lecturas rápidas)
    const { error: updEmpErr } = await supabase
      .from("empresas")
      .update({ plan_activo_id: plan.id, updated_at: new Date().toISOString() })
      .eq("id", empresaIdReal);

    if (updEmpErr) {
      console.warn("⚠️ No se pudo actualizar empresas.plan_activo_id:", updEmpErr?.message);
    }

    // Log histórico (no crítico)
    const { error: logErr } = await supabase.from("solicitudes_upgrade").insert([
      {
        empresa_id: empresaIdReal,
        plan_id: plan.id,
        estado: "aprobada_auto",
        comentario_admin:
          override !== null
            ? `Cambio automático con override (${override} asesores).`
            : "Cambio automático (sin override).",
        notificado: false,
        fecha_solicitud: new Date().toISOString(),
      },
    ]);
    if (logErr) {
      console.warn("⚠️ No se pudo registrar el log de solicitud:", logErr?.message);
    }

    return NextResponse.json({
      success: true,
      message:
        override !== null
          ? `✅ Plan "${plan.nombre}" activado correctamente. Cupo: ${override} asesores.`
          : `✅ Plan "${plan.nombre}" activado correctamente.`,
      data: nuevoPlan,
    });
  } catch (err) {
    console.error("💥 Error interno en /api/solicitud-upgrade:", err);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
