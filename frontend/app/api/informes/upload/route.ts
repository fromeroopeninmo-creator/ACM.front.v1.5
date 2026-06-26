// frontend/app/api/informes/upload/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Opcional: evitar la región IAD1 si vuelve a fallar
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

// === Admin client (bypassa RLS para Storage y DB) ===
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

type InformeImageColumn =
  | "imagen_principal_url"
  | "comp1_url"
  | "comp2_url"
  | "comp3_url"
  | "comp4_url"
  | "comp5_url"
  | "comp6_url"
  | "comp7_url"
  | "comp8_url";

/** Ping rápido */
export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: "upload" }), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

// Mapeo 1:1 de columnas según slot
function buildColumnFromSlot(slot: string): InformeImageColumn {
  if (slot === "principal") return "imagen_principal_url";

  if (slot === "comp1") return "comp1_url";
  if (slot === "comp2") return "comp2_url";
  if (slot === "comp3") return "comp3_url";
  if (slot === "comp4") return "comp4_url";
  if (slot === "comp5") return "comp5_url";
  if (slot === "comp6") return "comp6_url";
  if (slot === "comp7") return "comp7_url";
  if (slot === "comp8") return "comp8_url";

  throw new Error(
    "slot inválido. Usa: principal | comp1 | comp2 | comp3 | comp4 | comp5 | comp6 | comp7 | comp8"
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
      return NextResponse.json(
        { error: "No autenticado." },
        { status: 401 }
      );
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

    // Validamos el slot antes de subir nada
    const column = buildColumnFromSlot(slot);

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

    // 3) Rol del usuario.
    // IMPORTANTE:
    // Por ahora mantenemos user_metadata.role como estaba,
    // para no tocar más piezas del sistema en producción.
    const role = ((user.user_metadata as any)?.role || "empresa") as Role;

    // 4) Obtener empresa del usuario
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

    // 5) Traer informe con ADMIN y autorizar en código
    const { data: inf, error: infErr } = await supabaseAdmin
      .from("informes")
      .select("id, empresa_id, autor_id")
      .eq("id", informeId)
      .maybeSingle();

    if (infErr) {
      return NextResponse.json({ error: infErr.message }, { status: 400 });
    }

    if (!inf) {
      return NextResponse.json(
        { error: "Informe inexistente." },
        { status: 404 }
      );
    }

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

    // soporte / super_admin / super_admin_root → OK

    // 6) Subir archivo con ADMIN
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
              signErr?.message || "No se pudo obtener URL pública / firmada.",
          },
          { status: 400 }
        );
      }

      publicUrl = signed.signedUrl;
    }

    // 8) Actualizar columna correspondiente en informes
    const { error: updErr } = await supabaseAdmin
      .from("informes")
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

    return NextResponse.json({
      ok: true,
      url: busted,
      slot,
      column,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error interno." },
      { status: 500 }
    );
  }
}
