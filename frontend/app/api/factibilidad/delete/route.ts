import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

export async function DELETE(req: Request) {
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

    if (sessionError) {
      console.error("Error obteniendo sesión en factibilidad/delete:", sessionError);
      return NextResponse.json(
        { error: "Error de autenticación" },
        { status: 500 }
      );
    }

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 💡 RLS debe asegurar que:
    // - Empresa sólo borre informes de su empresa
    // - Asesor sólo borre los suyos
    const { error } = await supabase
      .from("informes_factibilidad")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error borrando informe_factibilidad:", error);
      return NextResponse.json(
        { error: "No se pudo eliminar el informe de factibilidad" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error inesperado en factibilidad/delete:", e);
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
