// app/api/empresa/ensure/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client (sin RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function POST() {
  try {
    const server = supabaseServer();
    const {
      data: { user },
      error: authErr,
    } = await server.auth.getUser();

    if (authErr) {
      return NextResponse.json(
        { error: `Auth error: ${authErr.message}` },
        { status: 401 }
      );
    }
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userId = user.id;

    // 1) ¿Ya tiene empresa?
    const { data: existing, error: empErr } = await supabaseAdmin
      .from("empresas")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (empErr) {
      return NextResponse.json({ error: empErr.message }, { status: 400 });
    }

    if (existing) {
      return NextResponse.json({ ok: true, empresa: existing }, { status: 200 });
    }

    // 2) No existe → la creamos a partir de user_metadata
    const meta: any = user.user_metadata || {};

    const insert = {
      user_id: userId,
      nombre_comercial:
        meta.inmobiliaria ||
        meta.empresa ||
        meta.razon_social ||
        meta.nombre ||
        user.email,
      razon_social: meta.razon_social || null,
      condicion_fiscal: meta.condicion_fiscal || null,
      matriculado: meta.matriculado || meta.matriculado_nombre || null,
      cpi: meta.cpi || null,
      telefono: meta.telefono || null,
      // podés sumar más columnas si querés
    };

    const { data: created, error: insErr } = await supabaseAdmin
      .from("empresas")
      .insert(insert)
      .select()
      .maybeSingle();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, empresa: created }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
