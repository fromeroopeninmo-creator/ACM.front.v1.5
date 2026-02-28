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

// Nombre “Trial” por compatibilidad; no creamos columnas nuevas.
const TRIAL_NAME = "Trial";

/** yyyy-mm-dd en UTC, sin riesgo de TZ local */
function todayUTC(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Suma días a una fecha (UTC) y devuelve yyyy-mm-dd */
function addDaysUTC(isoYYYYMMDD: string, days: number): string {
  const [y, m, d] = isoYYYYMMDD.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

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

    // 3) Si no existe, crear empresa básica (defaults seguros)
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
            // defaults coherentes
            color: "#E6A930",
            logo_url: "",
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

    if (!empresaId) {
      return NextResponse.json(
        { ok: false, error: "No se pudo resolver empresaId" },
        { status: 400 }
      );
    }

    // 4) Asegurar plan Trial activo si no hay plan activo
    const { data: planActivo, error: planActivoErr } = await supabaseAdmin
      .from("empresas_planes")
      .select("id, activo")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .maybeSingle();

    if (planActivoErr) {
      console.warn("bootstrap: error buscando plan activo:", planActivoErr.message);
    }

    if (!planActivo) {
      // Buscar plan trial por flag real primero (más exacto)
      let trialPlan: any = null;

      const { data: trialByFlag, error: trialFlagErr } = await supabaseAdmin
        .from("planes")
        .select("id, nombre, duracion_dias")
        .eq("es_trial", true)
        .order("duracion_dias", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!trialFlagErr && trialByFlag?.id) {
        trialPlan = trialByFlag;
      } else {
        // Fallback: por nombre (tolerante a variantes)
        const { data: trialByName, error: trialNameErr } = await supabaseAdmin
          .from("planes")
          .select("id, nombre, duracion_dias")
          .or(
            `nombre.eq.${TRIAL_NAME},nombre.eq.${TRIAL_NAME.toLowerCase()},nombre.ilike.%trial%`
          )
          .order("duracion_dias", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!trialNameErr && trialByName?.id) {
          trialPlan = trialByName;
        }
      }

      if (!trialPlan?.id) {
        console.warn("No se encontró el plan Trial; se omite asignación de plan.");
        return NextResponse.json({ ok: true, empresaId }, { status: 200 });
      }

      // Fechas (en UTC)
      const fecha_inicio = todayUTC();
      const dias = Number(trialPlan.duracion_dias) || 30;
      const fecha_fin = addDaysUTC(fecha_inicio, dias);

      // Desactivar cualquier plan activo previo (por si acaso)
      // (sin .catch porque no existe en el builder; errores a consola)
      const { error: updErr } = await supabaseAdmin
        .from("empresas_planes")
        .update({ activo: false })
        .eq("empresa_id", empresaId)
        .eq("activo", true);

      if (updErr) {
        console.warn("bootstrap: error desactivando planes previos:", updErr.message);
      }

      // Insertar trial activo
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
        console.warn("bootstrap: no se pudo insertar Trial:", insPlanErr.message);
      }
    }

    return NextResponse.json({ ok: true, empresaId }, { status: 200 });
  } catch (e: any) {
    console.error("bootstrap: error inesperado:", e?.message || e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Error interno" },
      { status: 500 }
    );
  }
}
