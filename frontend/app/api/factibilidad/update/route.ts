// app/api/factibilidad/update/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, datos, titulo } = body as {
      id: string;
      datos: any;
      titulo?: string;
    };

    if (!id) {
      return NextResponse.json(
        { error: "Falta id" },
        { status: 400 }
      );
    }

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

    const updatePayload: any = {
      datos_json: datos,
      updated_at: new Date().toISOString(),
    };
    if (titulo) updatePayload.titulo = titulo;

    const { data, error } = await supabase
      .from("informes_factibilidad")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, informe: data });
  } catch (err: any) {
    console.error("factibilidad/update", err);
    return NextResponse.json(
      { error: err?.message || "Error en factibilidad/update" },
      { status: 500 }
    );
  }
}
