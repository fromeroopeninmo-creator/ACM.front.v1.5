import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase SOLO para servidor (API routes).
 * Requiere:
 *  - NEXT_PUBLIC_SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY  (Service Role, NO la anon)
 */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Resuelve el ID real de la empresa (empresas.id) a partir de:
 *  - un empresas.id válido, o
 *  - un empresas.user_id (id de usuario autenticado) como viene hoy desde el frontend.
 */
async function resolverEmpresaId(empresaIdOUserId: string): Promise<string | null> {
  // 1) Intentar como empresas.id
  const { data: empPorId } = await supabase
    .from("empresas")
    .select("id")
    .eq("id", empresaIdOUserId)
    .maybeSingle();

  if (empPorId?.id) return empPorId.id;

  // 2) Intentar como empresas.user_id (flujo actual del front)
  const { data: empPorUser } = await supabase
    .from("empresas")
    .select("id")
    .eq("user_id", empresaIdOUserId)
    .maybeSingle();

  return empPorUser?.id ?? null;
}

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

    // 🔎 Resolver empresas.id real (aceptamos empresaId como id de empresa o como user_id)
    const empresaIdReal = await resolverEmpresaId(empresaId);
    if (!empresaIdReal) {
      return NextResponse.json(
        { error: "Empresa no encontrada para el identificador provisto." },
        { status: 404 }
      );
    }

    // 🔎 Traer plan destino
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

    // 🔎 Si ya está en ese plan y activo, devolvemos OK sin tocar nada
    const { data: planActual } = await supabase
      .from("empresas_planes")
      .select("plan_id, activo")
      .eq("empresa_id", empresaIdReal)
      .eq("activo", true)
      .maybeSingle();

    if (planActual?.plan_id === plan.id) {
      return NextResponse.json({
        success: true,
        message: `✅ Ya estás en el plan "${plan.nombre}".`,
      });
    }

    // 📅 Fechas (UTC trunc a date)
    const hoy = new Date();
    const fecha_inicio = hoy.toISOString().slice(0, 10);
    const fecha_fin = new Date(
      hoy.getTime() + (Number(plan.duracion_dias) || 30) * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .slice(0, 10);

    // 🔧 Desactivar planes previos activos
    const { error: deactivateErr } = await supabase
      .from("empresas_planes")
      .update({ activo: false })
      .eq("empresa_id", empresaIdReal)
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
          empresa_id: empresaIdReal,
          plan_id: plan.id,
          fecha_inicio,
          fecha_fin,
          activo: true,
        },
      ])
      .select("empresa_id, plan_id, fecha_inicio, fecha_fin, activo")
      .maybeSingle();

    if (insertErr) {
      console.error("❌ Error al insertar nuevo plan:", insertErr);
      return NextResponse.json(
        { error: "No se pudo activar el nuevo plan." },
        { status: 500 }
      );
    }

    // 🪵 Log histórico (no crítico)
    const { error: logErr } = await supabase.from("solicitudes_upgrade").insert([
      {
        empresa_id: empresaIdReal,
        plan_id: plan.id,
        estado: "aprobada_auto",
        comentario_admin: "Cambio automático (modo pruebas)",
        notificado: false,
        fecha_solicitud: new Date().toISOString(),
      },
    ]);
    if (logErr) {
      console.warn("⚠️ No se pudo registrar el log de solicitud:", logErr?.message);
    }

    return NextResponse.json({
      success: true,
      message: `✅ Plan "${plan.nombre}" activado correctamente.`,
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
