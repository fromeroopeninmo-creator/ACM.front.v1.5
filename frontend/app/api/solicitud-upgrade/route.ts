import { NextResponse } from "next/server";
import { supabase } from "#lib/supabaseClient";

/**
 * POST /api/solicitud-upgrade
 * 👉 Para pruebas: cambia el plan de la empresa **en el acto** (sin aprobación ni cobro).
 * Flujo:
 *  1) Valida empresaId y planId
 *  2) Lee el plan (duración y nombre)
 *  3) Desactiva todos los planes activos de esa empresa
 *  4) Inserta un nuevo registro en empresas_planes con activo=true y fechas recalculadas
 *  5) (Opcional) Registra una “solicitud” como aprobada automáticamente para histórico
 */
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

    // 1) Verificar que exista el plan y obtener duración
    const { data: plan, error: planError } = await supabase
      .from("planes")
      .select("id, nombre, duracion_dias")
      .eq("id", planId)
      .maybeSingle();

    if (planError) {
      console.error("Error leyendo plan:", planError);
      return NextResponse.json(
        { error: "No se pudo leer el plan solicitado." },
        { status: 500 }
      );
    }
    if (!plan) {
      return NextResponse.json({ error: "Plan inexistente." }, { status: 404 });
    }

    const hoy = new Date();
    const fecha_inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()); // trunc a date
    const duracion = Number.isFinite(plan.duracion_dias) ? plan.duracion_dias : 30;
    const fecha_fin = new Date(fecha_inicio);
    fecha_fin.setDate(fecha_fin.getDate() + duracion);

    const fechaInicioStr = fecha_inicio.toISOString().slice(0, 10); // YYYY-MM-DD
    const fechaFinStr = fecha_fin.toISOString().slice(0, 10);

    // 2) Desactivar cualquier plan activo anterior de la empresa
    const { error: deactivateErr } = await supabase
      .from("empresas_planes")
      .update({ activo: false })
      .eq("empresa_id", empresaId)
      .eq("activo", true);

    if (deactivateErr) {
      console.error("Error desactivando planes previos:", deactivateErr);
      return NextResponse.json(
        { error: "No se pudieron desactivar los planes anteriores." },
        { status: 500 }
      );
    }

    // 3) Insertar el nuevo plan activo
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
      console.error("Error insertando nuevo plan:", insertErr);
      return NextResponse.json(
        { error: "No se pudo activar el nuevo plan." },
        { status: 500 }
      );
    }

    // 4) (Opcional) Dejar registro en solicitudes_upgrade como “aprobada_auto” para auditoría
    //    Si la tabla no tiene RLS para INSERT habilitado, este paso puede omitirse.
    const { error: solicitudErr } = await supabase.from("solicitudes_upgrade").insert([
      {
        empresa_id: empresaId,
        plan_id: planId,
        estado: "aprobada_auto",
        comentario_admin:
          "Upgrade/Downgrade aplicado automáticamente para entorno de pruebas.",
        notificado: false,
        fecha_solicitud: new Date().toISOString(),
      },
    ]);
    if (solicitudErr) {
      // No frenamos el éxito por un fallo en el log
      console.warn("Aviso: no se pudo registrar la solicitud (log).", solicitudErr);
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
    console.error("Error general en /api/solicitud-upgrade:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
