// app/api/factibilidad/upload/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Opcional: evitar la región IAD1 si vuelve a fallar
export const preferredRegion = ["gru1", "sfo1"];

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

// Usamos el mismo bucket que ACM. Cambiá esto si querés separarlo.
const BUCKET = "informes";

// === Admin client (bypass RLS para Storage y DB) ===
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Ping rápido (podés quitarlo luego) */
export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: "factibilidad/upload" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// En factibilidad sólo tenemos una foto del lote => foto_lote_url
function buildColumnFromSlot(slot: string): keyof { foto_lote_url: string } {
  // Aceptamos varios alias por si el front usa distinto nombre
  if (
    slot === "lote" ||
    slot === "foto_lote" ||
    slot === "foto" ||
    slot === "principal"
  ) {
    return "foto_lote_url";
  }
  throw new Error(
    "slot inválido. Usa: lote | foto_lote | foto | principal"
  );
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
    const slot = (form.get("slot") as string | null)?.trim();

    if (!file || !informeId || !slot) {
      return NextResponse.json(
        { error: "Faltan parámetros: file, informeId, slot." },
        { status: 400 }
      );
    }

    const mime = file.type || null;
    if (!isAllowedImage(mime)) {
      return NextResponse.json(
        { error: "Archivo no es imagen válida." },
        { status: 400 }
      );
    }
    if (typeof file.size === "number" && file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "La imagen excede el tamaño máximo permitido." },
        { status: 413 }
      );
    }

    // 3) Rol del usuario (para autorización lógica posterior)
    const role =
      ((user.user_metadata as any)?.role as Role) || ("empresa" as Role);

    // 4) Obtener empresa del usuario (con SERVER client)
    let empresaId: string | null = null;
    if (role === "empresa") {
      const { data: emp, error: empErr } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (empErr)
        return NextResponse.json({ error: empErr.message }, { status: 400 });
      if (!emp?.id)
        return NextResponse.json(
          { error: "Empresa no encontrada." },
          { status: 400 }
        );
      empresaId = emp.id;
    } else if (role === "asesor") {
      const { data: prof, error: profErr } = await server
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();
      if (profErr)
        return NextResponse.json({ error: profErr.message }, { status: 400 });
      if (!prof?.empresa_id)
        return NextResponse.json(
          { error: "Asesor sin empresa asociada." },
          { status: 400 }
        );
      empresaId = prof.empresa_id;
    }

    // 5) Traer informe de factibilidad con ADMIN (bypass RLS) y AUTORIZAR en código
    const { data: inf, error: infErr } = await supabaseAdmin
      .from("informes_factibilidad")
      .select("id, empresa_id, autor_id")
      .eq("id", informeId)
      .maybeSingle();

    if (infErr)
      return NextResponse.json({ error: infErr.message }, { status: 400 });
    if (!inf)
      return NextResponse.json(
        { error: "Informe de factibilidad inexistente." },
        { status: 404 }
      );

    // Reglas:
    // - empresa: debe coincidir empresa_id
    // - asesor: debe ser autor_id
    // - soporte/super_admin/root: OK
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
    // soporte/super_admin/super_admin_root → OK

    // 6) Subir archivo con ADMIN (sin RLS)
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

    // 7) URL pública / firmada
    let publicUrl: string | null = null;
    const { data: pub } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);
    publicUrl = pub?.publicUrl || null;

    if (!publicUrl) {
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
      if (signErr || !signed?.signedUrl) {
        return NextResponse.json(
          {
            error:
              signErr?.message ||
              "No se pudo obtener URL pública / firmada.",
          },
          { status: 400 }
        );
      }
      publicUrl = signed.signedUrl;
    }

    // 8) Actualizar columna correspondiente en informes_factibilidad (ADMIN)
    const column = buildColumnFromSlot(slot);
    const { error: updErr } = await supabaseAdmin
      .from("informes_factibilidad")
      .update({ [column]: publicUrl })
      .eq("id", informeId);

    if (updErr) {
      return NextResponse.json(
        { error: `Error al actualizar informe: ${updErr.message}` },
        { status: 400 }
      );
    }

    // 9) Responder con cache busting
    const busted = `${publicUrl}?v=${Date.now()}`;
    return NextResponse.json({ ok: true, url: busted });
  } catch (e: any) {
    console.error("factibilidad/upload error:", e);
    return NextResponse.json(
      { error: e?.message || "Error interno." },
      { status: 500 }
    );
  }
}
