import { NextResponse } from "next/server";
import { supabase } from "#lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { empresaId, planId } = body || {};

    console.log("📨 solicitud-upgrade body:", body);

    if (!empresaId || !planId) {
      console.error("❌ Faltan datos obligatorios:", { empresaId, planId });
      return NextResponse.json(
        { error: "Faltan datos obligatorios (empresaId, planId)." },
        { status: 400 }
      );
    }

    // 🔹 Buscar plan
    const { data: plan, error: planError } = await supabase
      .from("planes")
      .select("id, nombre, duracion_dias")
      .eq("id", planId)
      .maybeSingle();

    console.log("📘 plan:", plan);

    if (planError) {
      console.error("❌ planError:", planError);
      return NextResponse.json({ error: planError.message }, { status: 500 });
    }

    if (!plan) {
      return NextResponse.json({ error: "Plan inexistente." }, { status: 404 });
    }

    const hoy = new Date();
    const fecha_inicio = hoy.toISOString().slice(0, 10);
    const fecha_fin = new Date(
      hoy.getTime() + plan.duracion_dias * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .slice(0, 10);

    // 🔹 Desactivar planes anteriores
    const { error: deactivateErr } = await supabase
      .from("empresas_planes")
      .update({ activo: false })
      .eq("empresa_id", empresaId)
      .eq("activo", true);

    if (deactivateErr) {
      console.error("❌ deactivateErr:", deactivateErr);
      return NextResponse.json(
        { error: "Fallo al desactivar planes previos.", details: deactivateErr },
        { status: 500 }
      );
    }

    // 🔹 Insertar nuevo plan
    const { data: insertData, error: insertErr } = await supabase
      .from("empresas_planes")
      .insert([
        {
          empresa_id: empresaId,
          plan_id: planId,
          fecha_inicio,
          fecha_fin,
          activo: true,
        },
      ])
      .select("*")
      .maybeSingle();

    if (insertErr) {
      console.error("❌ insertErr:", insertErr);
      return NextResponse.json(
        { error: "Fallo al insertar nuevo plan.", details: insertErr },
        { status: 500 }
      );
    }

    console.log("✅ Nuevo plan insertado:", insertData);

    // 🔹 Log histórico (no crítico)
    const { error: solicitudErr } = await supabase.from("solicitudes_upgrade").insert([
      {
        empresa_id: empresaId,
        plan_id: planId,
        estado: "aprobada_auto",
        comentario_admin: "Cambio automático (modo test)",
        notificado: false,
        fecha_solicitud: new Date().toISOString(),
      },
    ]);

    if (solicitudErr) {
      console.warn("⚠️ solicitudErr:", solicitudErr);
    }

    return NextResponse.json({
      success: true,
      message: `✅ Plan "${plan.nombre}" activado correctamente.`,
      data: insertData,
    });
  } catch (err) {
    console.error("💥 Error general en route:", err);
    return NextResponse.json({ error: "Error interno del servidor.", err }, { status: 500 });
  }
}
