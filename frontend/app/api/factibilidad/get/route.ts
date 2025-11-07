// app/api/factibilidad/get/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Falta parámetro id" },
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

    const { data, error } = await supabase
      .from("informes_factibilidad")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: "Informe no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, informe: data });
  } catch (err: any) {
    console.error("factibilidad/get", err);
    return NextResponse.json(
      { error: err?.message || "Error en factibilidad/get" },
      { status: 500 }
    );
  }
}
