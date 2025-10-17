export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";
import sharp from "sharp";

const BUCKET = "informes";
// 🔧 Mantener la compresión pedida: ancho máximo 800px, jpeg 70
const MAX_WIDTH = 800;
const JPEG_QUALITY = 70;

export async function POST(req: Request) {
  try {
    const server = supabaseServer();

    // 🔐 Usuario actual
    const { data: userRes, error: userErr } = await server.auth.getUser();
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const user = userRes.user;

    // 🧠 Resolver empresa_id (mismo criterio que en create)
    let empresaId: string | null = null;

    // ¿Es asesor?
    {
      const { data: rowAsesor } = await server
        .from("asesores")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();

      if (rowAsesor?.empresa_id) {
        empresaId = rowAsesor.empresa_id;
      }
    }

    // ¿Es empresa?
    if (!empresaId) {
      const { data: rowEmpresa } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (rowEmpresa?.id) {
        empresaId = rowEmpresa.id;
      }
    }

    if (!empresaId) {
      return NextResponse.json(
        { error: "No se pudo resolver la empresa para el almacenamiento." },
        { status: 400 }
      );
    }

    // 📥 Files (multipart/form-data)
    const form = await req.formData();
    const files = form.getAll("file");
    if (!files?.length) {
      return NextResponse.json({ error: "No se recibieron archivos." }, { status: 400 });
    }

    const urls: string[] = [];

    for (const f of files) {
      if (!(f instanceof File)) continue;

      const arrayBuf = await f.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuf);

      // 🗜️ Comprimir con sharp
      let output = sharp(inputBuffer).rotate();
      const metadata = await output.metadata();

      if ((metadata.width || 0) > MAX_WIDTH) {
        output = output.resize({ width: MAX_WIDTH });
      }

      const jpegBuffer = await output.jpeg({ quality: JPEG_QUALITY }).toBuffer();

      // 📁 Path: informes/{empresa_id}/{user_id}/{uuid}.jpg
      const uid = crypto.randomUUID();
      const path = `${empresaId}/${user.id}/${uid}.jpg`;

      const { error: upErr } = await server.storage
        .from(BUCKET)
        .upload(path, jpegBuffer, {
          cacheControl: "3600",
          contentType: "image/jpeg",
          upsert: false,
        });

      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 400 });
      }

      const { data: pub } = server.storage.from(BUCKET).getPublicUrl(path);
      urls.push(pub.publicUrl);
    }

    return NextResponse.json({ urls }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error inesperado." },
      { status: 500 }
    );
  }
}
