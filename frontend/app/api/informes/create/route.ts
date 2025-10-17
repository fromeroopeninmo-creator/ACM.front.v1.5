export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

type Body = {
  titulo?: string;
  data: any;           // JSON del informe (obligatorio)
  fotos?: string[];    // URLs públicas (opcional)
};

export async function POST(req: Request) {
  try {
    const server = supabaseServer();

    // 🔐 Usuario actual
    const { data: userRes, error: userErr } = await server.auth.getUser();
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const user = userRes.user;

    // 🧠 Resolver empresa_id y rol del autor
    // - Si existe fila en asesores(id = user.id) => rol=asesor y empresa_id = asesores.empresa_id
    // - Si no, buscamos empresas(user_id = user.id) => rol=empresa y empresa_id = empresas.id
    let empresaId: string | null = null;
    let autorRole: "asesor" | "empresa" = "empresa";

    // ¿Es asesor?
    {
      const { data: rowAsesor } = await server
        .from("asesores")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();

      if (rowAsesor?.empresa_id) {
        empresaId = rowAsesor.empresa_id;
        autorRole = "asesor";
      }
    }

    // ¿Es empresa?
    if (!empresaId) {
      const { data: rowEmpresa } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (rowEmpresa?.id) {
        empresaId = rowEmpresa.id;
        autorRole = "empresa";
      }
    }

    if (!empresaId) {
      return NextResponse.json(
        { error: "No se pudo resolver la empresa del autor." },
        { status: 400 }
      );
    }

    // 📦 Body
    const body = (await req.json()) as Body;
    if (body == null || body.data == null) {
      return NextResponse.json(
        { error: "Falta 'data' (JSON del informe)." },
        { status: 400 }
      );
    }

    const titulo = (body.titulo || "Informe sin título").slice(0, 200);
    const fotos = Array.isArray(body.fotos) ? body.fotos : [];

    // 📝 Insert en la tabla INFORMES (columnas finales)
    const { data: inserted, error: insErr } = await server
      .from("informes")
      .insert({
        empresa_id: empresaId,
        autor_id: user.id,
        autor_role: autorRole,
        titulo,
        data: body.data,
        fotos, // JSONB array de URLs
      })
      .select("id")
      .maybeSingle();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ id: inserted?.id || null }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error inesperado." },
      { status: 500 }
    );
  }
}
