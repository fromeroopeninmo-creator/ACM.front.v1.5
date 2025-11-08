// app/api/factibilidad/upload/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Opcional: evitar región IAD1 si da problemas
export const preferredRegion = ["gru1", "sfo1"];

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

type Role =
  | "empresa"
  | "asesor"
  | "soporte"
  | "super_admin"
  | "super_admin_root";

const BUCKET = "informes";

// === Admin client (bypass RLS para Storage y DB) ===
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Ping rápido (debug) */
export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, route: "factibilidad/upload" }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    }
  );
}

// Slot → columna en la tabla informes_factibilidad
function buildColumnFromSlot(slot: string): keyof {
  foto_lote_url: string;
} {
  if (slot === "foto_lote") return "foto_lote_url";
  throw new Error("slot inválido. Usa: foto_lote");
}

function extFromMime(mime: string | null): string {
  if (!mime) return "bin";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic") return "heic";
  if (mime === "image/heif") return "heif";
  return "img";
}

function isAllowedImage(mime: string | null) {
  return !!mime && mime.startsWith("image/");
}

const MAX_BYTES = 12 * 1024 * 1024; // 12MB

export async function POST(req: Request) {
  try {
    // 1) Usuario autenticado (cookies)
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

    // 2) Form-data
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const informeId = (form.get("informeId") as string | null)?.trim();
    const slot = (form.get("slot") as string | null)?.trim(); // debería ser "foto_lote"

    if (!file || !informeId || !slot) {
      return NextResponse.json(
        { error: "Faltan parámetros: file, informeId, slot." },
        { status: 400 }
      );
    }

    const mime = file.type || null;
    if (!isAllowedImage(mime)) {
      return NextResponse.json(
        { error: "Archivo no es una imagen válida." },
        { status: 400 }
      );
    }
    if (typeof file.size === "number" && file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "La imagen excede el tamaño máximo permitido." },
        { status: 413 }
      );
    }

    // 3) Rol del usuario
    const role = ((user.user_metadata as any)?.role ||
      "empresa") as Role;

    // 4) Obtener empresa del usuario (con SERVER client)
    let empresaId: string | null = null;
    if (role === "empresa") {
      const { data: emp, error: empErr } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (empErr) {
        return NextResponse.json({ error: empErr.message }, { status: 400 });
      }
      if (!emp?.id) {
        return NextResponse.json(
          { error: "Empresa no encontrada." },
          { status: 400 }
        );
      }
      empresaId = emp.id;
    } else if (role === "asesor") {
      const { data: prof, error: profErr } = await server
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();
      if (profErr) {
        return NextResponse.json({ error: profErr.message }, { status: 400 });
      }
      if (!prof?.empresa_id) {
        return NextResponse.json(
          { error: "Asesor sin empresa asociada." },
          { status: 400 }
        );
      }
      empresaId = prof.empresa_id;
    }
    // soporte / admins → pueden operar sin empresaId explícita para autorización extra si querés

    // 5) Traer informe de factibilidad con ADMIN y autorizar
    const { data: inf, error: infErr } = await supabaseAdmin
      .from("informes_factibilidad")
      .select("id, empresa_id, autor_id")
      .eq("id", informeId)
      .maybeSingle();

    if (infErr) {
      return NextResponse.json(
        { error: infErr.message },
        { status: 400 }
      );
    }
    if (!inf) {
      return NextResponse.json(
        { error: "Informe de factibilidad inexistente." },
        { status: 404 }
      );
    }

    // Reglas de autorización
    if (role === "empresa") {
      if (!empresaId || inf.empresa_id !== empresaId) {
        return NextResponse.json(
          { error: "No autorizado sobre este informe." },
          { status: 403 }
        );
      }
    } else if (role === "asesor") {
      if (inf.autor_id !== user.id) {
        return NextResponse.json(
          { error: "No autorizado sobre este informe." },
          { status: 403 }
        );
      }
    }
    // soporte / super_admin / super_admin_root → OK

    // 6) Subir archivo con ADMIN (sin RLS) al bucket "informes"
    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const ext = extFromMime(mime);
    const storagePath = `${inf.empresa_id}/${informeId}/${slot}.${ext}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: mime || "application/octet-stream",
        upsert: true,
        cacheControl: "0",
      });

    if (upErr) {
      return NextResponse.json(
        { error: `Error al subir a storage: ${upErr.message}` },
        { status: 400 }
      );
    }

    // 7) Obtener URL pública o firmada
    let publicUrl: string | null = null;
    const { data: pub } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);
    publicUrl = pub?.publicUrl || null;

    if (!publicUrl) {
      const { data: signed, error: signErr } =
        await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
      if (signErr || !signed?.signedUrl) {
        return NextResponse.json(
          {
            error:
              signErr?.message ||
              "No se pudo obtener URL pública/firmada.",
          },
          { status: 400 }
        );
      }
      publicUrl = signed.signedUrl;
    }

    // 8) Actualizar la columna foto_lote_url en informes_factibilidad
    const column = buildColumnFromSlot(slot); // solo "foto_lote" → "foto_lote_url"
    const { error: updErr } = await supabaseAdmin
      .from("informes_factibilidad")
      .update({ [column]: publicUrl })
      .eq("id", informeId);

    if (updErr) {
      return NextResponse.json(
        {
          error: `Error al actualizar informe de factibilidad: ${updErr.message}`,
        },
        { status: 400 }
      );
    }

    // 9) Responder con URL con cache-busting
    const busted = `${publicUrl}?v=${Date.now()}`;
    return NextResponse.json({ ok: true, url: busted }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error interno." },
      { status: 500 }
    );
  }
}
