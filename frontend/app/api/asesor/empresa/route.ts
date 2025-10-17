// app/api/asesor/empresa/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ Server-side ONLY
);

/**
 * Body esperado:
 *  - { empresa_id: string }   (para asesores)
 *  - ó { user_id: string }    (para empresa dueña)
 * Devuelve campos públicos necesarios para UI (herencia en asesor).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { empresa_id, user_id } = body || {};

    if (!empresa_id && !user_id) {
      return NextResponse.json(
        { error: "Debe enviar empresa_id o user_id" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("empresas")
      .select(
        "id, nombre_comercial, matriculado, cpi, telefono, logo_url, color, updated_at"
      )
      .limit(1);

    if (empresa_id) query = query.eq("id", empresa_id);
    if (user_id) query = query.eq("user_id", user_id);

    const { data, error } = await query.maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: `DB error: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Empresa no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
