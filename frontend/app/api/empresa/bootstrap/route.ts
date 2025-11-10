// app/api/empresa/bootstrap/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client (service_role) para operar sin RLS en tablas de negocio
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Cambiá si tu plan Trial tiene otro nombre
const TRIAL_NAME = "Trial";

/**
 * Bootstrap de empresa + plan Trial
 * Se llama SOLO cuando el usuario ya tiene sesión (después de confirmar email).
 */
export async function POST() {
  try {
    // 1) Usuario autenticado desde cookies (SSR)
    const server = supabaseServer();
    const {
      data: { user },
      error: authErr,
    } = await server.auth.getUser();

    if (authErr) {
      return NextResponse.json(
        { ok: false, error: `Auth error: ${authErr.message}` },
        { status: 401 }
      );
    }
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const userId = user.id;
    const email = user.email ?? "";

    // 2) ¿Ya existe empresa para este user_id?
    const { data: empExist, error: empErr } = await supabaseAdmin
      .from("empresas")
      .select("id, user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (empErr) {
      return NextResponse.json(
        { ok: false, error: empErr.message },
        { status: 400 }
      );
    }

    let empresaId = empExist?.id as string | undefined;

    // 3) Si no existe, crear empresa básica
    if (!empresaId) {
      const razonBase = email ? email.split("@")[0] : "Empresa";
      const nowIso = new Date().toISOString();

      const { data: nuevaEmp, error: insErr } = await supabaseAdmin
        .from("empresas")
        .insert([
          {
            user_id: userId,
            razon_social: razonBase,
            nombre_comercial: razonBase,
            created_at: nowIso,
            updated_at: nowIso,
          },
        ])
        .select("id")
        .maybeSingle();

      if (insErr || !nuevaEmp?.id) {
        return NextResponse.json(
          { ok: false, error: insErr?.message || "No se pudo crear empresa" },
          { status: 400 }
        );
      }

      empresaId = nuevaEmp.id;
    }

    // 4) Asegurar plan Trial activo si no hay plan activo
    if (!empresaId) {
      return NextResponse.json(
        { ok: false, error: "No se pudo resolver empresaId" },
        { status: 400 }
      );
    }

    // 4.a Buscar plan activo actual
    const { data: planActivo } = await supabaseAdmin
      .from("empresas_planes")
      .select("id, plan_id, activo")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .maybeSingle();

    if (!planActivo) {
      // 4.b Buscar plan Trial
      const { data: trialPlan, error: trialErr } = await supabaseAdmin
        .from("planes")
        .select("id, nombre, duracion_dias")
        .eq("nombre", TRIAL_NAME)
        .maybeSingle();

      if (trialErr || !trialPlan?.id) {
        // No bloqueamos el flujo si no hay Trial configurado
        console.warn("No se encontró el plan Trial; se omite asignación de plan.");
        return NextResponse.json({ ok: true, empresaId }, { status: 200 });
      }

      // 4.c Calcular fechas de inicio y fin
      const hoy = new Date();
      const fecha_inicio = hoy.toISOString().slice(0, 10);

      const dias = Number(trialPlan.duracion_dias) || 7;
      const fecha_fin = new Date(hoy.getTime() + dias * 86400000)
        .toISOString()
        .slice(0, 10);

      // Desactivar cualquier plan activo previo (por si acaso)
      await supabaseAdmin
        .from("empresas_planes")
        .update({ activo: false })
        .eq("empresa_id", empresaId)
        .eq("activo", true);

      const { error: insPlanErr } = await supabaseAdmin
        .from("empresas_planes")
        .insert([
          {
            empresa_id: empresaId,
            plan_id: trialPlan.id,
            fecha_inicio,
            fecha_fin,
            activo: true,
          },
        ]);

      if (insPlanErr) {
        console.warn("No se pudo insertar plan Trial:", insPlanErr.message);
      }
    }

    return NextResponse.json({ ok: true, empresaId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error interno" },
      { status: 500 }
    );
  }
}
