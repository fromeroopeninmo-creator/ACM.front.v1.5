// frontend/app/api/informes/upload/route.ts
import { NextResponse } from "next/server";
import sharp from "sharp";
import { supabaseServer } from "#lib/supabaseServer";

export const runtime = "nodejs";

// Límite razonable de archivo (ej. 10 MB)
const MAX_FILE_BYTES = 10 * 1024 * 1024;

// Redimensionar a 800px (lado mayor), salida JPEG calidad 75
async function compressToJpeg800(input: ArrayBuffer) {
  const buf = Buffer.from(input);
  const image = sharp(buf, { failOn: "none" });
  const meta = await image.metadata();

  // Si no es imagen válida:
  if (!meta || !(meta.width && meta.height)) {
    throw new Error("Archivo subido no es una imagen válida.");
  }

  // Redimensiona manteniendo aspecto; si ya es más chica, no pasa nada
  const out = await image
    .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 75, mozjpeg: true })
    .toBuffer();

  return out;
}

export async function POST(req: Request) {
  try {
    const server = supabaseServer(); // ✅ sin cookies()
    const { data: userRes } = await server.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Falta archivo 'file'." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "El archivo excede el tamaño permitido (10MB)." }, { status: 400 });
    }

    // Determinar empresa_id del dueño
    let empresa_id: string | null = null;

    // ¿Es empresa (empresas.user_id = user.id)?
    {
      const { data: emp } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (emp?.id) empresa_id = emp.id;
    }

    // Si no, ¿es asesor?
    if (!empresa_id) {
      const { data: as } = await server
        .from("asesores")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();
      if (as?.empresa_id) empresa_id = as.empresa_id;
    }

    if (!empresa_id) {
      return NextResponse.json(
        { error: "No se pudo determinar la empresa asociada." },
        { status: 400 }
      );
    }

    // Leer y comprimir
    const ab = await file.arrayBuffer();
    const output = await compressToJpeg800(ab);

    // Construir ruta en Storage (bucket 'informes')
    const stamp = Date.now();
    // Opcionalmente, podés aceptar un "subfolder" desde formData (p.ej. "main" o "comp1")
    const sub = (form.get("subfolder") as string | null) || "misc";
    const path = `${empresa_id}/${sub}/${stamp}.jpg`;

    const { error: upErr } = await server.storage
      .from("informes")
      .upload(path, output, {
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "31536000",
      });

    if (upErr) {
      console.error("❌ Error subiendo imagen:", upErr);
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    // Public URL (si el bucket es público) o generá URL firmada
    const { data: pub } = server.storage.from("informes").getPublicUrl(path);
    const publicUrl = pub?.publicUrl || null;

    return NextResponse.json(
      {
        ok: true,
        path,
        url: publicUrl,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("💥 Error en /api/informes/upload:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error interno del servidor." },
      { status: 500 }
    );
  }
}
