export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

// Limpia posibles restos de base64 que vengan del cliente (por compatibilidad)
function sanitizeDatos(datos: any) {
  const clone = JSON.parse(JSON.stringify(datos || {}));
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
    const body = await req.json().catch(() => null as any);
    const { id, datos, titulo } = body || {};
    if (!id) return NextResponse.json({ error: "Falta 'id'." }, { status: 400 });

    // obtener informe actual para empresa_id (y existencia)
    const { data: existing, error: getErr } = await supabaseAdmin
      .from("informes")
      .select("id, empresa_id, asesor_id, autor_id, imagen_principal_url, comp1_url, comp2_url, comp3_url, comp4_url")
      .eq("id", id)
      .maybeSingle();

    if (getErr) {
      return NextResponse.json({ error: getErr.message }, { status: 400 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Informe no encontrado." }, { status: 404 });
    }

    // Ya no procesamos base64 ni usamos sharp. Solo actualizamos datos + URLs si vienen provistas.
    const datosLimpios = sanitizeDatos(datos);

    // Preparar el payload de update (no sobreescribir URLs si no llegan)
    const patch: Record<string, any> = {
      titulo: titulo ?? "Informe VAI",
      datos_json: datosLimpios,
      updated_at: new Date().toISOString(),
    };

    // Si el cliente envía URLs (por haber subido por /upload), las reflejamos en columnas:
    if (typeof datos?.mainPhotoUrl === "string" && datos.mainPhotoUrl) {
      patch.imagen_principal_url = datos.mainPhotoUrl;
    }

    if (Array.isArray(datos?.comparables)) {
      const urls = datos.comparables.map((c: any) => c?.photoUrl).filter(Boolean);
      if (typeof urls[0] === "string") patch.comp1_url = urls[0];
      if (typeof urls[1] === "string") patch.comp2_url = urls[1];
      if (typeof urls[2] === "string") patch.comp3_url = urls[2];
      if (typeof urls[3] === "string") patch.comp4_url = urls[3];
    }

    const { data: updated, error: upErr } = await supabaseAdmin
      .from("informes")
      .update(patch)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, informe: updated }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
