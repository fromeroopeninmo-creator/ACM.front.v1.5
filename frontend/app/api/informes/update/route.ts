// frontend/app/api/informes/update/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Opcional: evitá IAD1 si hay incidentes
export const preferredRegion = ["gru1", "sfo1"];

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Helpers
function isDataUrlImage(s?: string) {
  return !!s && /^data:image\/(png|jpe?g|webp|heic|heif);base64,/.test(s);
}
function sanitizeDatos(datos: any) {
  const clone = JSON.parse(JSON.stringify(datos || {}));
  // Nunca guardes base64 en la BD
  if (clone?.mainPhotoBase64) clone.mainPhotoBase64 = undefined;
  if (Array.isArray(clone?.comparables)) {
    clone.comparables = clone.comparables.map((c: any) => ({
      ...c,
      photoBase64: undefined,
    }));
  }
  return clone;
}

export async function POST(req: Request) {
  try {
    // 0) Auth del usuario (desde cookies) para autorizar
    const server = supabaseServer();
    const {
      data: { user },
      error: userErr,
    } = await server.auth.getUser();

    if (userErr) {
      return NextResponse.json({ error: `Auth error: ${userErr.message}` }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // 1) Body
    const body = await req.json().catch(() => null as any);
    const { id, datos, titulo } = body || {};
    if (!id) return NextResponse.json({ error: "Falta 'id'." }, { status: 400 });

    // 2) Traer informe (ADMIN, sin RLS) y validar ownership
    const { data: existing, error: getErr } = await supabaseAdmin
      .from("informes")
      .select("id, empresa_id, autor_id")
      .eq("id", id)
      .maybeSingle();

    if (getErr) return NextResponse.json({ error: getErr.message }, { status: 400 });
    if (!existing) return NextResponse.json({ error: "Informe no encontrado." }, { status: 404 });

    // 3) Resolver rol y empresa del usuario (SERVER, respeta RLS)
    let role: Role =
      ((user.user_metadata as any)?.role as Role) ||
      "empresa";

    if (!["empresa", "asesor", "soporte", "super_admin", "super_admin_root"].includes(role)) {
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

    // 4) Autorización
    if (role === "empresa") {
      if (!empresaId || existing.empresa_id !== empresaId) {
        return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
      }
    } else if (role === "asesor") {
      if (existing.autor_id !== user.id) {
        return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
      }
    }
    // soporte / super_admin / super_admin_root → OK

    // 5) Limpiar datos_json (nada de base64) y respetar URLs si vienen
    const datosLimpios = sanitizeDatos(datos);

    // Nota: NO tocamos columnas de imágenes aquí.
    // /api/informes/upload ya actualiza imagen_principal_url y comp1..4_url.
    // Acá solo persistimos el JSON (incluyendo las mainPhotoUrl / photoUrl que ya tenés).

    const { data: updated, error: updErr } = await supabaseAdmin
      .from("informes")
      .update({
        titulo: titulo ?? "Informe VAI",
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
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
