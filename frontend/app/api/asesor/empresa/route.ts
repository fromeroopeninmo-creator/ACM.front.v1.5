// app/api/asesor/empresa/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ server-side ONLY
);

/**
 * Body aceptado:
 *  - { asesor_id: string }  -> busca profiles.empresa_id y luego trae empresas.*
 *  - { empresa_id: string } -> trae empresas.* directo
 *  - { user_id: string }    -> para empresa dueña (opcional)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let { asesor_id, empresa_id, user_id } = body || {};

    // Si viene asesor_id, resolvemos empresa_id desde profiles
    if (asesor_id && !empresa_id) {
      const { data: prof, error: perr } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", asesor_id)
        .maybeSingle();

      if (perr) {
        return NextResponse.json(
          { error: `DB error (profiles): ${perr.message}` },
          { status: 500 }
        );
      }

      empresa_id = prof?.empresa_id ?? null;
      if (!empresa_id) {
        return NextResponse.json(
          { error: "El asesor no tiene empresa asociada." },
          { status: 404 }
        );
      }
    }

    if (!empresa_id && !user_id) {
      return NextResponse.json(
        { error: "Debe enviar asesor_id, empresa_id o user_id." },
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
        { error: `DB error (empresas): ${error.message}` },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
