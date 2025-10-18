// app/api/informes/update/route.ts
import { NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

function isBase64Image(s?: string) {
  return !!s && /^data:image\/(png|jpe?g);base64,/.test(s);
}

async function uploadBase64Image(empresaId: string, informeId: string, base64: string, fileName: string) {
  const match = base64.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
  if (!match) throw new Error("Formato base64 inválido");
  const data = Buffer.from(match[2], "base64");
  const resized = await sharp(data).resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  const path = `${empresaId}/${informeId}/${fileName}`;
  const { error } = await supabaseAdmin.storage.from("informes").upload(path, resized, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  const { data: pub } = supabaseAdmin.storage.from("informes").getPublicUrl(path);
  return pub.publicUrl;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, datos, titulo } = body || {};
    if (!id) return NextResponse.json({ error: "Falta 'id'." }, { status: 400 });

    // obtener informe actual para empresa_id
    const { data: existing, error: getErr } = await supabaseAdmin
      .from("informes")
      .select("id, empresa_id, asesor_id, autor_id")
      .eq("id", id)
      .maybeSingle();

    if (getErr || !existing) {
      return NextResponse.json({ error: "Informe no encontrado." }, { status: 404 });
    }

    const empresaId = existing.empresa_id as string;
    const informeId = id as string;

    let imagen_principal_url: string | null = null;
    const compUrls: (string | null)[] = [null, null, null, null];

    if (isBase64Image(datos?.mainPhotoBase64)) {
      imagen_principal_url = await uploadBase64Image(empresaId, informeId, datos.mainPhotoBase64, "principal.jpg");
    }

    if (Array.isArray(datos?.comparables)) {
      for (let i = 0; i < Math.min(datos.comparables.length, 4); i++) {
        const b64 = datos.comparables[i]?.photoBase64;
        if (isBase64Image(b64)) {
          compUrls[i] = await uploadBase64Image(empresaId, informeId, b64, `comp${i + 1}.jpg`);
        }
      }
    }

    const datosLimpios = {
      ...datos,
      mainPhotoBase64: undefined,
      mainPhotoUrl: imagen_principal_url || datos?.mainPhotoUrl || "",
      comparables: Array.isArray(datos?.comparables)
        ? datos.comparables.map((c: any, idx: number) => ({
            ...c,
            photoBase64: undefined,
            photoUrl: compUrls[idx] || c.photoUrl || "",
          }))
        : [],
    };

    const { data: updated, error: upErr } = await supabaseAdmin
      .from("informes")
      .update({
        titulo: titulo ?? "Informe VAI",
        datos_json: datosLimpios,
        imagen_principal_url: imagen_principal_url ?? undefined,
        comp1_url: compUrls[0] ?? undefined,
        comp2_url: compUrls[1] ?? undefined,
        comp3_url: compUrls[2] ?? undefined,
        comp4_url: compUrls[3] ?? undefined,
        updated_at: new Date().toISOString(),
      })
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
