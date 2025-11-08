import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = supabaseServer();

    // ✅ Verificamos sesión
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("factibilidad/list sessionError:", sessionError);
      return NextResponse.json(
        { error: "No se pudo obtener la sesión actual" },
        { status: 500 }
      );
    }

    if (!session?.user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const scope = searchParams.get("scope") || "empresa";

    const limit = Number.isFinite(Number(limitParam))
      ? Number(limitParam)
      : 100;

    // 👇 Por ahora no complicamos con joins ni empresa_id.
    // Devolvemos todos los informes visibles para este usuario.
    // Si tenés RLS configurado, eso se encarga de que sólo vea lo que debe.
    // Más adelante, si querés que la empresa vea también informes de asesores,
    // ajustamos esto con un join a empresas/perfiles.

    let query = supabase
      .from("informes_factibilidad")
      .select(
        `
        id,
        titulo,
        estado,
        created_at,
        datos_json
      `
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    // Si quisieras filtrar distinto por scope más adelante:
    // if (scope === "asesor") { ... } etc.
    // Por ahora, dejamos que las políticas RLS manden.

    const { data, error } = await query;

    if (error) {
      console.error("factibilidad/list supabase error:", error);
      return NextResponse.json(
        { error: "Error consultando informes de factibilidad" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        informes: data ?? [],
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("factibilidad/list unexpected error:", e);
    return NextResponse.json(
      { error: "Error consultando informes de factibilidad" },
      { status: 500 }
    );
  }
}
