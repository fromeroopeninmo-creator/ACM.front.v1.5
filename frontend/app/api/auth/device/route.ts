export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente admin SIN RLS para escribir en user_devices
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

/**
 * Tabla recomendada en la BD:
 *
 * CREATE TABLE public.user_devices (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id uuid NOT NULL,
 *   device_id text NOT NULL,
 *   last_seen timestamptz NOT NULL DEFAULT now(),
 *   is_active boolean NOT NULL DEFAULT true
 * );
 *
 * -- Opcional: UNIQUE si querés evitar duplicados (no es obligatorio para esta API):
 * -- ALTER TABLE public.user_devices
 * --   ADD CONSTRAINT user_devices_user_id_device_id_key UNIQUE (user_id, device_id);
 */

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const deviceId: string | undefined = body?.device_id;
    const claim: boolean = !!body?.claim;

    if (!deviceId) {
      return NextResponse.json(
        { error: "device_id es obligatorio", active: false },
        { status: 400 }
      );
    }

    // ===========================
    // 1) Intentar leer sesión
    // ===========================
    const server = supabaseServer();
    const { data: auth, error: authErr } = await server.auth.getUser();

    // ⚠️ CAMBIO IMPORTANTE:
    // Si NO hay usuario (403 session_not_found, token viejo, etc.),
    // NO devolvemos 401 ni matamos la sesión del front.
    if (authErr || !auth?.user?.id) {
      console.warn(
        "[user_devices] No autenticado en /api/auth/device:",
        authErr?.message || "sin user"
      );
      // Desde el punto de vista del front, no bloqueamos nada.
      return NextResponse.json({ active: true }, { status: 200 });
    }

    const userId = auth.user.id as string;
    const now = new Date().toISOString();

    // =========================================================
    // 2) MODO CLAIM: este dispositivo "reclama" ser el único activo
    // =========================================================
    if (claim) {
      // Buscar si ya existe (user_id, device_id)
      const { data: existing, error: selErr } = await supabaseAdmin
        .from("user_devices")
        .select("id")
        .eq("user_id", userId)
        .eq("device_id", deviceId)
        .maybeSingle();

      if (selErr) {
        console.error("user_devices select (claim) error:", selErr.message);
        // En caso de duda, no rompemos nada
        return NextResponse.json({ active: true }, { status: 200 });
      }

      if (existing?.id) {
        // Actualizar registro existente
        const { error: updErr } = await supabaseAdmin
          .from("user_devices")
          .update({ is_active: true, last_seen: now })
          .eq("id", existing.id);

        if (updErr) {
          console.error("user_devices update (claim) error:", updErr.message);
          return NextResponse.json({ active: true }, { status: 200 });
        }
      } else {
        // Insertar nuevo registro
        const { error: insErr } = await supabaseAdmin
          .from("user_devices")
          .insert({
            user_id: userId,
            device_id: deviceId,
            last_seen: now,
            is_active: true,
          });

        if (insErr) {
          console.error("user_devices insert (claim) error:", insErr.message);
          return NextResponse.json({ active: true }, { status: 200 });
        }
      }

      // Desactivar otros dispositivos del usuario
      const { error: deactivateErr } = await supabaseAdmin
        .from("user_devices")
        .update({ is_active: false, last_seen: now })
        .eq("user_id", userId)
        .neq("device_id", deviceId);

      if (deactivateErr) {
        console.error(
          "user_devices deactivate others error:",
          deactivateErr.message
        );
        // No frenamos igual
      }

      return NextResponse.json({ active: true }, { status: 200 });
    }

    // =========================================================
    // 3) MODO HEARTBEAT: sólo verificar si este device sigue activo
    // =========================================================
    const { data: row, error: selErr } = await supabaseAdmin
      .from("user_devices")
      .select("is_active")
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (selErr) {
      console.error("user_devices select (heartbeat) error:", selErr.message);
      // No desconectamos por errores internos
      return NextResponse.json({ active: true }, { status: 200 });
    }

    if (!row) {
      // Si aún no hay registro para este device, NO lo marcamos inactivo.
      // Evita loop de logout cuando algo falló en el claim.
      return NextResponse.json({ active: true }, { status: 200 });
    }

    // Actualizamos last_seen, pero no tocamos is_active
    await supabaseAdmin
      .from("user_devices")
      .update({ last_seen: now })
      .eq("user_id", userId)
      .eq("device_id", deviceId);

    return NextResponse.json({ active: !!row.is_active }, { status: 200 });
  } catch (e: any) {
    console.error("device route exception:", e?.message || e);
    // En caso de error inesperado, NO tiramos 401, dejamos la sesión viva
    return NextResponse.json(
      { error: e?.message || "Error inesperado", active: true },
      { status: 200 }
    );
  }
}
