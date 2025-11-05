// frontend/app/api/auth/device/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

/**
 * POST /api/auth/device
 * Body: { device_id: string, claim?: boolean }
 *
 * - claim = true  → este dispositivo se convierte en el dueño de la sesión (último dispositivo gana).
 * - claim = false → solo chequea si este dispositivo sigue siendo válido (no cambia el dueño).
 *
 * Respuesta:
 * { active: boolean; claimed: boolean }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const deviceId: string | undefined = body?.device_id;
    const claim: boolean = Boolean(body?.claim);

    if (!deviceId || typeof deviceId !== "string") {
      return NextResponse.json(
        { error: "device_id es obligatorio" },
        { status: 400 }
      );
    }

    // Usuario autenticado (via cookies)
    const supabase = supabaseServer();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }
    const userId = auth.user.id;

    // Perfil (cualquier rol: empresa, asesor, soporte, admin, etc.)
    const { data: prof, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id, session_device_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json(
        { error: `Error leyendo profile: ${profErr.message}` },
        { status: 500 }
      );
    }
    if (!prof) {
      return NextResponse.json(
        { error: "Perfil no encontrado para este usuario." },
        { status: 404 }
      );
    }

    const nowISO = new Date().toISOString();
    const stored = (prof as any).session_device_id as string | null;

    // 🔐 MODO CLAIM → este dispositivo pasa a ser el “dueño”
    if (claim) {
      const { error: updErr } = await supabaseAdmin
        .from("profiles")
        .update({ session_device_id: deviceId, updated_at: nowISO })
        .eq("id", prof.id);

      if (updErr) {
        return NextResponse.json(
          { error: `Error actualizando device: ${updErr.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { active: true, claimed: true },
        { status: 200 }
      );
    }

    // 🔎 MODO CHECK → no cambia el dueño, solo verifica
    if (!stored) {
      // No había ningún dueño todavía → este dispositivo reclama
      const { error: updErr } = await supabaseAdmin
        .from("profiles")
        .update({ session_device_id: deviceId, updated_at: nowISO })
        .eq("id", prof.id);

      if (updErr) {
        return NextResponse.json(
          { error: `Error inicializando device: ${updErr.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { active: true, claimed: true },
        { status: 200 }
      );
    }

    if (stored === deviceId) {
      // Todo bien, este dispositivo sigue siendo el dueño
      return NextResponse.json(
        { active: true, claimed: false },
        { status: 200 }
      );
    }

    // Otro dispositivo tomó el control → esta sesión debe desloguearse
    return NextResponse.json(
      { active: false, claimed: false },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
