export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";
import sharp from "sharp";

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

const BUCKET = "informes";

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

export async function POST(req: Request) {
  try {
    const server = supabaseServer();
    const {
      data: { user },
    } = await server.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const informeId = form.get("informeId") as string | null;
    const slot = form.get("slot") as string | null;

    if (!file || !informeId || !slot) {
      return NextResponse.json(
        { error: "Faltan parámetros: file, informeId, slot." },
        { status: 400 }
      );
    }

    const role = ((user.user_metadata as any)?.role || "empresa") as Role;

    // Resolver empresa_id (para chequear ownership y armar carpeta)
    let empresaId: string | null = null;
    if (role === "empresa") {
      const { data: emp, error: empErr } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (empErr || !emp) {
        return NextResponse.json(
          { error: "No se pudo resolver la empresa del usuario." },
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
      if (asErr || !as?.empresa_id) {
        return NextResponse.json(
          { error: "El asesor no tiene empresa asociada." },
          { status: 400 }
        );
      }
      empresaId = as.empresa_id;
    } else {
      return NextResponse.json({ error: "Rol no soportado." }, { status: 403 });
    }

    // Verificar que el informe pertenece a esa empresa o al autor
    const { data: inf, error: infErr } = await server
      .from("informes")
      .select("id, empresa_id, autor_id")
      .eq("id", informeId)
      .maybeSingle();

    if (infErr || !inf) {
      return NextResponse.json({ error: "Informe inexistente." }, { status: 404 });
    }
    if (inf.empresa_id !== empresaId && inf.autor_id !== user.id) {
      return NextResponse.json({ error: "No autorizado sobre este informe." }, { status: 403 });
    }

    // Procesar con sharp (máx 800px lado mayor) -> JPEG
    const arrayBuf = await file.arrayBuffer();
    const input = Buffer.from(arrayBuf);
    const processed = await sharp(input)
      .rotate()
      .resize({ width: 800, withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();

    // Path de storage: /empresaId/informeId/slot.jpg
    const storagePath = `${empresaId}/${informeId}/${slot}.jpg`;

    const { error: upErr } = await server.storage
      .from(BUCKET)
      .upload(storagePath, processed, {
        contentType: "image/jpeg",
        upsert: true,
        cacheControl: "0",
      });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    // Public URL
    const { data: pub } = server.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = pub.publicUrl;

    // Actualizar columna correspondiente
    const column = buildColumnFromSlot(slot);
    const { error: updErr } = await server
      .from("informes")
      .update({ [column]: publicUrl })
      .eq("id", informeId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    // Devolver url "cache-busted" para UI inmediata
    const busted = `${publicUrl}?v=${Date.now()}`;

    return NextResponse.json({ ok: true, url: busted });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error interno." }, { status: 500 });
  }
}
