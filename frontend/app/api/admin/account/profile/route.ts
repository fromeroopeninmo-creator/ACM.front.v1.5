// frontend/app/api/admin/account/profile/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

type Body = {
  nombre?: string;
  apellido?: string;
  telefono?: string;
};

export async function PUT(req: Request) {
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

    const body = (await req.json().catch(() => ({}))) as Body;

    // Solo enviamos columnas presentes (evitamos null explícito si no viene)
    const patch: Record<string, any> = {};
    if (typeof body.nombre === "string") patch.nombre = body.nombre.trim();
    if (typeof body.apellido === "string") patch.apellido = body.apellido.trim();
    if (typeof body.telefono === "string") patch.telefono = body.telefono.trim();

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    // 2) Update del perfil
    const { error: upErr } = await supa
      .from("profiles")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, updated: 1 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
