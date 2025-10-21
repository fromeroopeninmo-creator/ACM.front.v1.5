// app/api/empresa/bootstrap/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cambiá si tu plan Trial tiene otro nombre
const TRIAL_NAME = "Trial";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, email } = body || {};
    if (!userId) {
      return NextResponse.json({ error: "Falta userId" }, { status: 400 });
    }

    // 1) ¿Ya existe empresa para este user?
    const { data: empExist, error: empErr } = await supabaseAdmin
      .from("empresas")
      .select("id, user_id")
      .eq("user_id", userId)
      .maybeSingle();

    let empresaId = empExist?.id as string | undefined;

    if (empErr) {
      return NextResponse.json({ error: empErr.message }, { status: 400 });
    }

    // 2) Si no existe, crear empresa básica
    if (!empresaId) {
      const razon = email ? email.split("@")[0] : "Empresa";
      const { data: nuevaEmp, error: insErr } = await supabaseAdmin
        .from("empresas")
        .insert([
          {
            user_id: userId,
            razon_social: razon,
            nombre_comercial: razon,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select("id")
        .maybeSingle();

      if (insErr || !nuevaEmp?.id) {
        return NextResponse.json(
          { error: insErr?.message || "No se pudo crear empresa" },
          { status: 400 }
        );
      }
      empresaId = nuevaEmp.id;
    }

    // 3) Asegurar plan Trial activo si no hay plan activo
    // 3.a Buscar plan actual
    const { data: planActivo } = await supabaseAdmin
      .from("empresas_planes")
      .select("id, plan_id, activo")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .maybeSingle();

    if (!planActivo) {
      // 3.b Buscar plan Trial
      const { data: trialPlan, error: trialErr } = await supabaseAdmin
        .from("planes")
        .select("id, nombre, duracion_dias, max_asesores")
        .eq("nombre", TRIAL_NAME)
        .maybeSingle();

      if (trialErr || !trialPlan?.id) {
        // Si no hay Trial en la base, salimos OK igual (no bloqueamos)
        console.warn("No se encontró el plan Trial; skip.");
        return NextResponse.json({ ok: true, empresaId });
      }

      // 3.c Activar trial por su duración
      const hoy = new Date();
      const fecha_inicio = hoy.toISOString().slice(0, 10);
      const fecha_fin = new Date(
        hoy.getTime() + (Number(trialPlan.duracion_dias) || 7) * 86400000
      )
        .toISOString()
        .slice(0, 10);

      // Desactivar por las dudas cualquiera activo previo (idempotente)
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
        console.warn("No se pudo insertar plan trial:", insPlanErr.message);
      }
    }

    return NextResponse.json({ ok: true, empresaId });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error interno" },
      { status: 500 }
    );
  }
}
