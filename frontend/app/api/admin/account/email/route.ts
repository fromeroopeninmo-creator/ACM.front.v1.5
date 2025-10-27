// frontend/app/api/admin/account/email/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

type Body = { newEmail?: string };

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

    const { newEmail } = (await req.json().catch(() => ({}))) as Body;
    if (!newEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
      return NextResponse.json(
        { error: "Email inválido." },
        { status: 400 }
      );
    }

    // 2) Update de email (envía verificación si aplica)
    const { data, error: upErr } = await supa.auth.updateUser({ email: newEmail });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: "Solicitud de cambio de email iniciada.",
      user: { id: data.user?.id, email: data.user?.email },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
