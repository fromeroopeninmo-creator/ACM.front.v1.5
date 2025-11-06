// app/api/auth/device/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

/**
 * Tabla recomendada:
 *
 * CREATE TABLE public.user_devices (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id uuid NOT NULL,
 *   device_id text NOT NULL,
 *   last_seen timestamptz NOT NULL DEFAULT now(),
 *   is_active boolean NOT NULL DEFAULT true,
 *   UNIQUE (user_id, device_id)
 * );
 *
 * CREATE INDEX user_devices_user_id_idx ON public.user_devices(user_id);
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

    // Usuario autenticado (RLS ON) – pero OJO:
    // si falla, devolvemos 200 con una marca `unauthenticated: true`
    const server = supabaseServer();
    const { data: auth, error: authErr } = await server.auth.getUser();

    if (authErr || !auth?.user?.id) {
      // ⚠️ Muy importante: NO devolvemos 401 para que el front
      // no lo trate como "otro dispositivo", sino como "no hay sesión".
      return NextResponse.json(
        { error: "No autenticado.", active: false, unauthenticated: true },
        { status: 200 }
      );
    }

    const userId = auth.user.id as string;
    const now = new Date().toISOString();

    // === MODO "CLAIM" → este dispositivo pasa a ser el activo ===
    if (claim) {
      // Upsert de este device
      const { error: upErr } = await supabaseAdmin
        .from("user_devices")
        .upsert(
          {
            user_id: userId,
            device_id: deviceId,
            last_seen: now,
            is_active: true,
          },
          {
            onConflict: "user_id,device_id",
          }
        );

      if (upErr) {
        console.error("user_devices upsert error:", upErr.message);
        // No lo tratamos como expulsión; dejamos la sesión seguir.
        return NextResponse.json({ active: true }, { status: 200 });
      }

      // Desactivar OTROS devices del mismo usuario
      const { error: updErr } = await supabaseAdmin
        .from("user_devices")
        .update({ is_active: false, last_seen: now })
        .eq("user_id", userId)
        .neq("device_id", deviceId);

      if (updErr) {
        console.error(
          "user_devices deactivate others error:",
          updErr.message
        );
      }

      return NextResponse.json({ active: true }, { status: 200 });
    }

    // === HEARTBEAT / CHECK ===
    const { data: row, error: selErr } = await supabaseAdmin
      .from("user_devices")
      .select("is_active")
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (selErr) {
      console.error("user_devices select error:", selErr.message);
      // En errores de DB, NO expulsamos la sesión.
      return NextResponse.json({ active: true }, { status: 200 });
    }

    if (!row) {
      // No hay fila para este device → asumimos que NO es el activo
      return NextResponse.json({ active: false }, { status: 200 });
    }

    // Actualizar last_seen
    await supabaseAdmin
      .from("user_devices")
      .update({ last_seen: now })
      .eq("user_id", userId)
      .eq("device_id", deviceId);

    return NextResponse.json({ active: !!row.is_active }, { status: 200 });
  } catch (e: any) {
    console.error("device route exception:", e?.message || e);
    // En caso de excepción, NO expulsamos al usuario.
    return NextResponse.json(
      { error: e?.message || "Error inesperado", active: true },
      { status: 200 }
    );
  }
}
