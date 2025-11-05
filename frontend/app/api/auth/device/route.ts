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
 * -- Opcional: índice
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

    // Usuario autenticado (RLS ON)
    const server = supabaseServer();
    const { data: auth, error: authErr } = await server.auth.getUser();

    if (authErr || !auth?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado.", active: false },
        { status: 401 }
      );
    }

    const userId = auth.user.id as string;
    const now = new Date().toISOString();

    // Si "claim" es true: este dispositivo reclama ser el activo
    if (claim) {
      // Upsert del dispositivo actual
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
        // En caso de duda, no bloqueamos la sesión
        return NextResponse.json({ active: true }, { status: 200 });
      }

      // Marcar otros dispositivos del mismo user como inactivos
      const { error: updErr } = await supabaseAdmin
        .from("user_devices")
        .update({ is_active: false, last_seen: now })
        .eq("user_id", userId)
        .neq("device_id", deviceId);

      if (updErr) {
        console.error("user_devices deactivate others error:", updErr.message);
        // Igual seguimos dejando activo este
      }

      return NextResponse.json({ active: true }, { status: 200 });
    }

    // Si "claim" es false: solo heartbeat / verificación
    const { data: row, error: selErr } = await supabaseAdmin
      .from("user_devices")
      .select("is_active")
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (selErr) {
      console.error("user_devices select error:", selErr.message);
      // No rompemos la app ni desconectamos al usuario
      return NextResponse.json({ active: true }, { status: 200 });
    }

    if (!row) {
      // No hay registro para este device, asumimos que NO es el activo
      return NextResponse.json({ active: false }, { status: 200 });
    }

    // Actualizamos last_seen
    await supabaseAdmin
      .from("user_devices")
      .update({ last_seen: now })
      .eq("user_id", userId)
      .eq("device_id", deviceId);

    return NextResponse.json({ active: !!row.is_active }, { status: 200 });
  } catch (e: any) {
    console.error("device route exception:", e?.message || e);
    return NextResponse.json(
      { error: e?.message || "Error inesperado", active: true },
      { status: 500 }
    );
  }
}
