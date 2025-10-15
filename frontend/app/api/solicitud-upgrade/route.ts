import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ⚙️ Crear cliente del lado del servidor
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 🔑 clave de servicio, no la anon
);

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

    // 🔍 Buscar plan
    const { data: plan, error: planError } = await supabase
      .from("planes")
      .select("id, nombre, duracion_dias")
      .eq("id", planId)
      .maybeSingle();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "No se encontró el plan solicitado." },
        { status: 404 }
      );
    }

    const hoy = new Date();
    const fecha_inicio = hoy.toISOString().slice(0, 10);
    const fecha_fin = new Date(
      hoy.getTime() + plan.duracion_dias * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .slice(0, 10);

    // 🧩 Desactivar planes previos
    const { error: deactivateErr } = await supabase
      .from("empresas_planes")
      .update({ activo: false })
      .eq("empresa_id", empresaId)
      .eq("activo", true);

    if (deactivateErr) {
      console.error("❌ Error al desactivar plan previo:", deactivateErr);
      return NextResponse.json(
        { error: "No se pudo desactivar el plan anterior." },
        { status: 500 }
      );
    }

    // ✅ Insertar nuevo plan activo
    const { data: nuevoPlan, error: insertErr } = await supabase
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
      console.error("❌ Error al insertar nuevo plan:", insertErr);
      return NextResponse.json(
        { error: "No se pudo activar el nuevo plan." },
        { status: 500 }
      );
    }

    // 🪵 Registrar solicitud (opcional, para histórico)
    await supabase.from("solicitudes_upgrade").insert([
      {
        empresa_id: empresaId,
        plan_id: planId,
        estado: "aprobada_auto",
        comentario_admin: "Cambio automático (modo test)",
        notificado: false,
        fecha_solicitud: new Date().toISOString(),
      },
    ]);

    return NextResponse.json({
      success: true,
      message: `✅ Plan "${plan.nombre}" activado correctamente.`,
      data: nuevoPlan,
    });
  } catch (err) {
    console.error("💥 Error general en route:", err);
    return NextResponse.json(
      { error: "Error interno del servidor.", details: err },
      { status: 500 }
    );
  }
}
