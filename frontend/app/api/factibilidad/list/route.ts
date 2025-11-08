import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitRaw = searchParams.get("limit") ?? "100";
    const limit = Number.isNaN(Number(limitRaw)) ? 100 : parseInt(limitRaw, 10);

    const supabase = supabaseServer();

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Error obteniendo sesión en factibilidad/list:", sessionError);
      return NextResponse.json(
        { error: "Error de autenticación" },
        { status: 500 }
      );
    }

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 💡 Confiamos en las políticas de RLS de informes_factibilidad:
    // - Empresas ven sus informes + los de sus asesores
    // - Asesores sólo sus propios informes
    const { data, error } = await supabase
      .from("informes_factibilidad")
      .select(
        `
          id,
          titulo,
          estado,
          created_at,
          datos_json,
          autor_nombre,
          asesor_email,
          tipologia
        `
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error consultando informes_factibilidad:", error);
      return NextResponse.json(
        { error: "Error consultando informes de factibilidad" },
        { status: 500 }
      );
    }

    const informes =
      (data ?? []).map((row) => ({
        ...row,
        tipo_informe: "factibilidad" as const,
      })) ?? [];

    return NextResponse.json({ informes });
  } catch (e: any) {
    console.error("Error inesperado en factibilidad/list:", e);
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
