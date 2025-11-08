// app/api/factibilidad/update/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["gru1", "sfo1"];

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

type Role =
  | "empresa"
  | "asesor"
  | "soporte"
  | "super_admin"
  | "super_admin_root";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Helpers
function sanitizeDatos(datos: any) {
  const clone = JSON.parse(JSON.stringify(datos || {}));
  // No guardar base64 en datos_json
  if (clone?.fotoLoteBase64) clone.fotoLoteBase64 = undefined;
  return clone;
}

export async function POST(req: Request) {
  try {
    // 0) Auth desde cookies
    const server = supabaseServer();
    const {
      data: { user },
      error: userErr,
    } = await server.auth.getUser();

    if (userErr) {
      return NextResponse.json(
        { error: `Auth error: ${userErr.message}` },
        { status: 401 }
      );
    }
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // 1) Body
    const body = await req.json().catch(() => null as any);
    const { id, datos, titulo } = body || {};
    if (!id) {
      return NextResponse.json({ error: "Falta 'id'." }, { status: 400 });
    }

    // 2) Traer informe (ADMIN, select("*") – evita error por columnas faltantes)
    const { data: existing, error: getErr } = await supabaseAdmin
      .from("informes_factibilidad")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (getErr) {
      return NextResponse.json({ error: getErr.message }, { status: 400 });
    }
    if (!existing) {
      return NextResponse.json(
        { error: "Informe de factibilidad no encontrado." },
        { status: 404 }
      );
    }

    // 3) Resolver rol y empresa del usuario
    let role: Role =
      ((user.user_metadata as any)?.role as Role) || "empresa";

    if (
      ![
        "empresa",
        "asesor",
        "soporte",
        "super_admin",
        "super_admin_root",
      ].includes(role)
    ) {
      role = "empresa";
    }

    let empresaId: string | null = null;
    if (role === "empresa") {
      const { data: emp } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      empresaId = emp?.id ?? null;
    } else if (role === "asesor") {
      const { data: prof } = await server
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();
      empresaId = prof?.empresa_id ?? null;
    }

    const existingEmpresaId = (existing as any).empresa_id as
      | string
      | null
      | undefined;
    const existingAutorId = (existing as any).autor_id as
      | string
      | null
      | undefined;

    // 4) Autorización (si las columnas existen)
    if (role === "empresa") {
      if (empresaId && existingEmpresaId && existingEmpresaId !== empresaId) {
        return NextResponse.json(
          { error: "Acceso denegado." },
          { status: 403 }
        );
      }
    } else if (role === "asesor") {
      if (existingAutorId && existingAutorId !== user.id) {
        return NextResponse.json(
          { error: "Acceso denegado." },
          { status: 403 }
        );
      }
    }
    // soporte / super_admin / super_admin_root → OK

    // 5) Limpiar datos_json (sacar base64)
    const datosLimpios = sanitizeDatos(datos);

    // 6) Update
    const { data: updated, error: updErr } = await supabaseAdmin
      .from("informes_factibilidad")
      .update({
        titulo: titulo ?? "Informe de Factibilidad",
        datos_json: datosLimpios,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, informe: updated }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
