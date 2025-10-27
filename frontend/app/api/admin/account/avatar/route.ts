// frontend/app/api/admin/account/avatar/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client para Storage (subida server-side)
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

function extFromType(t?: string | null) {
  if (!t) return "bin";
  if (t.includes("jpeg")) return "jpg";
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("gif")) return "gif";
  return "bin";
}

export async function POST(req: Request) {
  try {
    const server = supabaseServer();

    // 1) Auth
    const {
      data: { user },
      error: authErr,
    } = await server.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // 2) Leer multipart/form-data
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Archivo 'file' requerido." }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "application/octet-stream";
    const ext = extFromType(mime);

    // 3) Subir a Storage (bucket avatars)
    const key = `avatars/${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("avatars")
      .upload(key, buf, { contentType: mime, upsert: true });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    // 4) Construir URL pública (si bucket es público) o firmada
    //    Intentamos public URL primero:
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("avatars").getPublicUrl(key);

    let url = publicUrl;

    // 5) Intentar guardar en profiles.avatar_url (si existe)
    //    Si la columna no existe, ignoramos error de columna (42703) y seguimos.
    try {
      const { error: updErr } = await server
        .from("profiles")
        .update({ avatar_url: url, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (updErr && updErr.code !== "42703") {
        // Otro error real de RLS o similar
        return NextResponse.json(
          { error: `Subido pero no se pudo guardar en perfil: ${updErr.message}`, url },
          { status: 207 } // Multi-Status (informativo)
        );
      }
    } catch {
      // Ignoramos si la tabla/columna no existe en este entorno
    }

    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
