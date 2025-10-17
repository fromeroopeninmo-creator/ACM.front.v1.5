export const runtime = "nodejs";
export const dynamic = "force-dynamic";


// frontend/app/api/informes/upload/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client con service role (para Storage y queries sin RLS)
const admin = createClient(URL, SERVICE_KEY);

async function resolveEmpresaId(userId: string) {
  // 1) ¿Es empresa?
  const { data: empByUser } = await admin
    .from("empresas")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (empByUser?.id) return empByUser.id;

  // 2) ¿Es asesor?
  const { data: asesor } = await admin
    .from("asesores")
    .select("empresa_id")
    .eq("id", userId)
    .maybeSingle();

  if (asesor?.empresa_id) return asesor.empresa_id;

  return null;
}

export async function POST(req: Request) {
  try {
    // Obtener usuario autenticado desde cookie
    const server = supabaseServer(cookies());
    const { data: userRes } = await server.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const empresaId = await resolveEmpresaId(user.id);
    if (!empresaId) {
      return NextResponse.json({ error: "No se pudo resolver empresa." }, { status: 400 });
    }

    // Leer multipart/form-data
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const kind = (form.get("kind") as string | null) || "misc"; // "main" | "comp1"..."comp4" | "misc"

    if (!file) {
      return NextResponse.json({ error: "Falta 'file'." }, { status: 400 });
    }

    // Comprimir a 800px de ancho, JPG calidad 72
    const arrayBuffer = await file.arrayBuffer();
    const input = Buffer.from(arrayBuffer);
    const output = await sharp(input)
      .rotate()
      .resize({ width: 800, withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();

    const key = `empresa_${empresaId}/${Date.now()}_${crypto.randomUUID()}_${kind}.jpg`;

    const { error: upErr } = await admin.storage
      .from("informes")
      .upload(key, output, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: true,
      });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    const { data: pub } = admin.storage.from("informes").getPublicUrl(key);

    return NextResponse.json(
      {
        url: pub.publicUrl,
        key,
        empresa_id: empresaId,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("💥 /api/informes/upload:", err);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
