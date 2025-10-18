// app/api/informes/create/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Base64Image = string | undefined | null;
const isBase64Image = (s: string | undefined | null) =>
  !!s && /^data:image\/(png|jpe?g);base64,/.test(s);

async function uploadBase64Image(opts: {
  empresaId: string;
  informeId: string;
  base64: string;
  fileName: string;
  bucket?: string;
  maxWidth?: number;
}) {
  const { empresaId, informeId, base64, fileName, bucket = "informes", maxWidth = 800 } = opts;

  const match = base64.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
  if (!match) throw new Error("Formato base64 inválido");

  const data = Buffer.from(match[2], "base64");

  const resized = await sharp(data)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  const path = `${empresaId}/${informeId}/${fileName}`;
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, resized, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;

  const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return pub.publicUrl;
}

export async function POST(req: Request) {
  try {
    // 1) Usuario autenticado por cookie (SSR)
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // 2) Body
    const body = await req.json().catch(() => null as any);
    const { datos, titulo = "Informe VAI" } = body || {};
    if (!datos) {
      return NextResponse.json({ error: "Faltan 'datos'." }, { status: 400 });
    }

    // 3) Resolver empresa_id / asesor_id
    let empresaId: string | null = null;
    let asesorId: string | null = null;

    const { data: emp } = await supabaseAdmin
      .from("empresas")
      .select("id, user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (emp?.id) {
      empresaId = emp.id;
    } else {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("id, role, empresa_id")
        .eq("id", userId)
        .maybeSingle();

      if (prof?.role === "asesor" && prof.empresa_id) {
        asesorId = prof.id;
        empresaId = prof.empresa_id;
      } else if (prof?.empresa_id) {
        empresaId = prof.empresa_id;
      }
    }

    if (!empresaId) {
      const { data: emp2 } = await supabaseAdmin
        .from("empresas")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      empresaId = emp2?.id ?? null;
    }

    if (!empresaId) {
      return NextResponse.json(
        { error: "No se pudo determinar la empresa del usuario." },
        { status: 400 }
      );
    }

    // 4) Generar id de informe
    let informeId: string;
    try {
      const { data: idGen } = await supabaseAdmin.rpc("uuid_generate_v4");
      informeId = idGen ?? crypto.randomUUID();
    } catch {
      // @ts-ignore
      informeId = crypto.randomUUID();
    }

    // 5) Subir imágenes (si vienen en base64)
    let imagen_principal_url: string | null = null;
    const compUrls: (string | null)[] = [null, null, null, null];

    const mainB64: Base64Image = datos?.mainPhotoBase64;
    if (isBase64Image(mainB64)) {
      imagen_principal_url = await uploadBase64Image({
        empresaId,
        informeId,
        base64: mainB64!,
        fileName: "principal.jpg",
      });
    }

    if (Array.isArray(datos?.comparables)) {
      for (let i = 0; i < Math.min(datos.comparables.length, 4); i++) {
        const b64 = datos.comparables[i]?.photoBase64 as Base64Image;
        if (isBase64Image(b64)) {
          const url = await uploadBase64Image({
            empresaId,
            informeId,
            base64: b64!,
            fileName: `comp${i + 1}.jpg`,
          });
          compUrls[i] = url;
        }
      }
    }

    // 6) Limpiar base64 del JSON a guardar
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

    // 7) Insertar informe
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("informes")
      .insert({
        id: informeId,
        empresa_id: empresaId,
        asesor_id: asesorId,
        autor_id: userId,
        tipo: "VAI",
        titulo,
        datos_json: datosLimpios,
        imagen_principal_url,
        comp1_url: compUrls[0],
        comp2_url: compUrls[1],
        comp3_url: compUrls[2],
        comp4_url: compUrls[3],
        estado: "borrador",
        etiquetas: [],
      })
      .select()
      .maybeSingle();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, informe: inserted }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
