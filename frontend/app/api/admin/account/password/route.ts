// frontend/app/api/admin/account/password/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

type Body = { newPassword?: string };

export async function POST(req: Request) {
  try {
    const supa = supabaseServer();

    // 1) Auth
    const {
      data: { user },
      error: authErr,
    } = await supa.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const { newPassword } = (await req.json().catch(() => ({}))) as Body;
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 400 }
      );
    }

    // 2) Update de contraseña
    const { data, error: upErr } = await supa.auth.updateUser({
      password: newPassword,
    });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: "Contraseña actualizada.",
      user: { id: data.user?.id },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
