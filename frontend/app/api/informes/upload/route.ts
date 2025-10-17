export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

// ⚙️ Cliente admin (solo en servidor) para subir al Storage
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 🔒 Usuario autenticado
    const server = supabaseServer();
    const { data: userRes } = await server.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // 📦 Recibir archivo
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Falta el archivo 'file'." }, { status: 400 });
    }

    // 🏢 Resolver empresa_id según rol (empresa/asesor)
    let empresaId: string | null = null;
    const role =
      (user.user_metadata as any)?.role ||
      (user as any)?.role ||
      "empresa";

    if (role === "empresa") {
      const { data: emp, error: empErr } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (empErr) {
        return NextResponse.json(
          { error: empErr.message || "Error obteniendo empresa." },
          { status: 400 }
        );
      }
      if (!emp?.id) {
        return NextResponse.json(
          { error: "No se encontró empresa asociada al usuario." },
          { status: 400 }
        );
      }
      empresaId = emp.id;
    } else if (role === "asesor") {
      const { data: as, error: asErr } = await server
        .from("asesores")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();
      if (asErr) {
        return NextResponse.json(
          { error: asErr.message || "Error obteniendo empresa del asesor." },
          { status: 400 }
        );
      }
      if (!as?.empresa_id) {
        return NextResponse.json(
          { error: "El asesor no tiene empresa asociada." },
          { status: 400 }
        );
      }
      empresaId = as.empresa_id;
    } else {
      return NextResponse.json(
        { error: "Solo empresas y asesores pueden subir fotos." },
        { status: 403 }
      );
    }

    // 🗜️ Comprimir a 800px (sin ampliar) y JPEG ~72%
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    const outputBuffer = await sharp(inputBuffer)
      .rotate() // respeta EXIF
      .resize({ width: 800, withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();

    // 🧾 Nombre y ruta
    const ext = "jpg";
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `emp_${empresaId}/autor_${user.id}/${filename}`;

    // ⬆️ Subir a bucket 'informes'
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("informes")
      .upload(path, outputBuffer, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json(
        { error: uploadErr.message || "Error subiendo imagen." },
        { status: 400 }
      );
    }

    // 🌐 URL pública
    const { data: pub } = supabaseAdmin.storage.from("informes").getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    return NextResponse.json({ url: publicUrl });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error interno." },
      { status: 500 }
    );
  }
}
