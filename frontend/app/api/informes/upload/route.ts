export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

const BUCKET = "informes";

/** =========================
 *  GET de ping (diagnóstico)
 *  =========================
 *  Visitá /api/informes/upload en el navegador: debe responder 200 con { ok: true }.
 *  Luego, si querés, podés quitar este GET.
 */
export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: "upload" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// Mantiene tu mapeo 1:1 de columnas según slot
function buildColumnFromSlot(slot: string): keyof {
  imagen_principal_url: string;
  comp1_url: string;
  comp2_url: string;
  comp3_url: string;
  comp4_url: string;
} {
  if (slot === "principal") return "imagen_principal_url";
  if (slot === "comp1") return "comp1_url";
  if (slot === "comp2") return "comp2_url";
  if (slot === "comp3") return "comp3_url";
  if (slot === "comp4") return "comp4_url";
  throw new Error("slot inválido. Usa: principal | comp1 | comp2 | comp3 | comp4");
}

// Extensión segura basada en MIME (sin re-encodear)
function extFromMime(mime: string | null): string {
  if (!mime) return "bin";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic") return "heic";
  if (mime === "image/heif") return "heif";
  return "img";
}

// Validación mínima de imagen
function isAllowedImage(mime: string | null) {
  return !!mime && mime.startsWith("image/");
}

// Tamaño máximo (post-resize cliente). Ajustá si querés.
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(req: Request) {
  try {
    const server = supabaseServer();

    // 1) Usuario autenticado (JWT desde cookies)
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

    // 2) Datos del form-data
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

    // Validaciones básicas de archivo
    const mime = file.type || null;
    if (!isAllowedImage(mime)) {
      return NextResponse.json({ error: "Archivo no es imagen válida." }, { status: 400 });
    }
    if (typeof file.size === "number" && file.size > MAX_BYTES) {
      return NextResponse.json({ error: "La imagen excede el tamaño máximo permitido." }, { status: 413 });
    }

    // 3) Rol del usuario
    const role = ((user.user_metadata as any)?.role || "empresa") as Role;

    // 4) Resolver empresa_id según rol
    let empresaId: string | null = null;

    if (role === "empresa") {
      const { data: emp, error: empErr } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (empErr) {
        return NextResponse.json(
          { error: `No se pudo resolver la empresa del usuario (empresa): ${empErr.message}` },
          { status: 400 }
        );
      }
      if (!emp?.id) {
        return NextResponse.json(
          { error: "No se encontró empresa asociada al usuario (empresa)." },
          { status: 400 }
        );
      }
      empresaId = emp.id;
    } else if (role === "asesor") {
      // En tu esquema, la relación está en profiles (no en asesores.id = auth id)
      const { data: prof, error: profErr } = await server
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profErr) {
        return NextResponse.json(
          { error: `No se pudo resolver la empresa del usuario (asesor): ${profErr.message}` },
          { status: 400 }
        );
      }
      if (!prof?.empresa_id) {
        return NextResponse.json(
          { error: "El asesor no tiene empresa asociada (profiles.empresa_id nulo)." },
          { status: 400 }
        );
      }
      empresaId = prof.empresa_id;
    } else if (role === "soporte" || role === "super_admin" || role === "super_admin_root") {
      // Para soporte/admin permitimos subir si el informe existe (y usamos su empresa_id)
      const { data: infAdmin, error: infAdminErr } = await server
        .from("informes")
        .select("empresa_id")
        .eq("id", informeId)
        .maybeSingle();

      if (infAdminErr || !infAdmin?.empresa_id) {
        return NextResponse.json(
          { error: infAdminErr?.message || "Informe inexistente o sin empresa asociada." },
          { status: 404 }
        );
      }
      empresaId = infAdmin.empresa_id;
    } else {
      return NextResponse.json({ error: "Rol no soportado para upload." }, { status: 403 });
    }

    // 5) Verificar ownership del informe para empresa/asesor
    const { data: inf, error: infErr } = await server
      .from("informes")
      .select("id, empresa_id, autor_id")
      .eq("id", informeId)
      .maybeSingle();

    if (infErr || !inf) {
      return NextResponse.json({ error: "Informe inexistente." }, { status: 404 });
    }

    if (role === "empresa" || role === "asesor") {
      // Debe pertenecer a la misma empresa o ser autor
      if (inf.empresa_id !== empresaId && inf.autor_id !== user.id) {
        return NextResponse.json({ error: "No autorizado sobre este informe." }, { status: 403 });
      }
    }
    // Para soporte/super_admin ya pasamos con el bloque anterior

    // 6) Subir archivo directo a Storage (SIN sharp)
    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    const ext = extFromMime(mime);
    const storagePath = `${empresaId}/${informeId}/${slot}.${ext}`;

    const { error: upErr } = await server.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: mime || "application/octet-stream",
        upsert: true,
        cacheControl: "0",
      });

    if (upErr) {
      return NextResponse.json({ error: `Error al subir a storage: ${upErr.message}` }, { status: 400 });
    }

    // 7) URL pública (si el bucket es público) o firmada si no lo es
    let publicUrl: string | null = null;
    const { data: pub } = server.storage.from(BUCKET).getPublicUrl(storagePath);
    publicUrl = pub?.publicUrl || null;

    if (!publicUrl) {
      const { data: signed, error: signErr } = await server.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 días
      if (signErr || !signed?.signedUrl) {
        return NextResponse.json(
          { error: signErr?.message || "No se pudo obtener URL pública / firmada." },
          { status: 400 }
        );
      }
      publicUrl = signed.signedUrl;
    }

    // 8) Actualizar columna correspondiente en informes
    const column = buildColumnFromSlot(slot);
    const { error: updErr } = await server
      .from("informes")
      .update({ [column]: publicUrl })
      .eq("id", informeId);

    if (updErr) {
      return NextResponse.json({ error: `Error al actualizar informe: ${updErr.message}` }, { status: 400 });
    }

    // 9) Devolver url "cache-busted" para UI inmediata
    const busted = `${publicUrl}?v=${Date.now()}`;
    return NextResponse.json({ ok: true, url: busted });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error interno." }, { status: 500 });
  }
}
