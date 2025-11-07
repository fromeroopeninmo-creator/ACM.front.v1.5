// app/api/factibilidad/create/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, datos, titulo } = body as {
      id?: string;
      datos: any;
      titulo?: string;
    };

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

    const user = session.user as any;
    const role = (user.role as string) || "empresa";
    const empresaId = user.empresa_id ?? null;

    let finalEmpresaId: string | null = empresaId;
    let asesorId: string | null = null;

    if (role === "asesor") {
      asesorId = user.id;
      // suponemos que el asesor tiene empresa_id
      finalEmpresaId = user.empresa_id ?? null;
    } else if (role === "empresa") {
      finalEmpresaId = empresaId;
    }

    const finalTitulo =
      titulo || "Informe de Factibilidad Constructiva";

    // Si viene id → update simple (titulo + datos_json)
    if (id) {
      const { data, error } = await supabase
        .from("informes_factibilidad")
        .update({
          titulo: finalTitulo,
          datos_json: datos,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;

      return NextResponse.json({ ok: true, informe: data });
    }

    // Si no hay id → insert nuevo
    const { data, error } = await supabase
      .from("informes_factibilidad")
      .insert({
        user_id: user.id,
        empresa_id: finalEmpresaId,
        asesor_id: asesorId,
        titulo: finalTitulo,
        datos_json: datos,
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, informe: data });
  } catch (err: any) {
    console.error("factibilidad/create", err);
    return NextResponse.json(
      { error: err?.message || "Error en factibilidad/create" },
      { status: 500 }
    );
  }
}
