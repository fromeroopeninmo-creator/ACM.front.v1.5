// app/api/factibilidad/upload/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = supabaseServer();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const informeId = formData.get("informeId") as string | null;
    const slot = formData.get("slot") as string | null;

    if (!file || !informeId || !slot) {
      return NextResponse.json(
        { error: "Faltan parámetros (file, informeId, slot)" },
        { status: 400 }
      );
    }

    // Usamos el mismo bucket que los informes VAI (ajustá si se llama distinto)
    const bucket = "informes";

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `factibilidad/${informeId}/${slot}-${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadError } =
      await supabase.storage.from(bucket).upload(path, file, {
        upsert: true,
        contentType: file.type || "image/jpeg",
      });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    // Guardamos la URL en la tabla SOLO para foto_lote
    if (slot === "foto_lote") {
      const { error: updError } = await supabase
        .from("informes_factibilidad")
        .update({
          foto_lote_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", informeId);

      if (updError) {
        console.warn(
          "No se pudo actualizar foto_lote_url en informes_factibilidad:",
          updError
        );
      }
    }

    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (err: any) {
    console.error("factibilidad/upload", err);
    return NextResponse.json(
      { error: err?.message || "Error en factibilidad/upload" },
      { status: 500 }
    );
  }
}
