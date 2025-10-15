import { NextResponse } from "next/server";
import { supabase } from "#lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { empresaId, planId } = body || {};

    if (!empresaId || !planId) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios (empresaId, planId)." },
        { status: 400 }
      );
    }

    // obtener plan con duración
    const { data: plan, error: planError } = await supabase
      .from("planes")
      .select("id, nombre, duracion_dias")
      .eq("id", planId)
      .maybeSingle();

    if (planError) {
      console.error("planError:", planError);
      return NextResponse.json(
        { error: "No se pudo leer el plan solicitado." },
        { status: 500 }
      );
    }
    if (!plan) {
      return NextResponse.json({ error: "Plan inexistente." }, { status: 404 });
    }

    const hoy = new Date();
    const fecha_inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const fecha_fin = new Date(fecha_inicio);
    fecha_fin.setDate(fecha_fin.getDate() + plan.duracion_dias);

    const fechaInicioStr = fecha_inicio.toISOString().slice(0, 10);
    const fechaFinStr = fecha_fin.toISOString().slice(0, 10);

    // Desactivar planes previos
    const { error: deactivateErr } = await supabase
      .from("empresas_planes")
      .update({ activo: false })
      .eq("empresa_id", empresaId)
      .eq("activo", true);

    if (deactivateErr) {
      console.error("deactivateErr:", deactivateErr);
      return NextResponse.json(
        { error: "No se pudieron desactivar los planes anteriores." },
        { status: 500 }
      );
    }

    // Insertar nuevo plan
    const { data: inserted, error: insertErr } = await supabase
      .from("empresas_planes")
      .insert([
        {
          empresa_id: empresaId,
          plan_id: planId,
          fecha_inicio: fechaInicioStr,
          fecha_fin: fechaFinStr,
          activo: true,
        },
      ])
      .select("empresa_id, plan_id, fecha_inicio, fecha_fin, activo")
      .maybeSingle();

    if (insertErr) {
      console.error("insertErr:", insertErr);
      return NextResponse.json(
        { error: "No se pudo activar el nuevo plan." },
        { status: 500 }
      );
    }

    // Registrar solicitud histórica
    const { error: solicitudErr } = await supabase.from("solicitudes_upgrade").insert([
      {
        empresa_id: empresaId,
        plan_id: planId,
        estado: "aprobada_auto",
        comentario_admin: "Cambio automático para entorno de pruebas",
        notificado: false,
        fecha_solicitud: new Date().toISOString(),
      },
    ]);
    if (solicitudErr) {
      console.warn("solicitudErr (log):", solicitudErr);
    }

    return NextResponse.json({
      success: true,
      message: `Plan "${plan.nombre}" activado correctamente.`,
      plan: {
        id: plan.id,
        nombre: plan.nombre,
        fecha_inicio: inserted?.fecha_inicio ?? fechaInicioStr,
        fecha_fin: inserted?.fecha_fin ?? fechaFinStr,
      },
    });
  } catch (err) {
    console.error("Error general en route:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
