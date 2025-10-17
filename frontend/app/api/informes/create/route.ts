// frontend/app/api/informes/create/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

// Importante en Vercel para poder usar node APIs si las necesitás en el futuro
export const runtime = "nodejs";

type CreateInformeBody = {
  titulo?: string;
  tipo?: string;             // ej: "VAI"
  data: any;                 // JSON con todos los campos del formulario
  thumb_path?: string | null; // opcional, miniatura en Storage si la tenés
};

const MAX_INFORMES_POR_EMPRESA = 250;

export async function POST(req: Request) {
  try {
    const server = supabaseServer(); // ✅ sin argumentos
    const { data: userRes } = await server.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const body = (await req.json()) as CreateInformeBody;
    if (!body?.data) {
      return NextResponse.json({ error: "Falta 'data' (JSON del informe)." }, { status: 400 });
    }

    // === Determinar empresa_id del dueño ===
    // Si es empresa -> empresas.user_id = user.id
    // Si es asesor  -> asesores.id = user.id  => tomar asesores.empresa_id
    let empresa_id: string | null = null;
    let autor_role = "empresa";

    // ¿Existe en empresas con este user?
    {
      const { data: emp } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (emp?.id) {
        empresa_id = emp.id;
        autor_role = "empresa";
      }
    }

    if (!empresa_id) {
      // Probar como asesor
      const { data: as } = await server
        .from("asesores")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();

      if (as?.empresa_id) {
        empresa_id = as.empresa_id;
        autor_role = "asesor";
      }
    }

    if (!empresa_id) {
      return NextResponse.json(
        { error: "No se pudo determinar la empresa asociada." },
        { status: 400 }
      );
    }

    // Insertar informe
    const insertPayload = {
      empresa_id,
      autor_id: user.id,
      autor_role,
      titulo: body.titulo ?? null,
      tipo: body.tipo ?? "VAI",
      data: body.data,            // JSONB
      thumb_path: body.thumb_path ?? null,
      // Si tu tabla tiene created_at con default now(), no hace falta setearlo
    };

    const { data: inserted, error: insertError } = await server
      .from("informes")
      .insert(insertPayload)
      .select("id, empresa_id, created_at")
      .single();

    if (insertError) {
      console.error("❌ Error insertando informe:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    // Enforce: máximo 250 informes por empresa -> borrar más antiguos
    // 1) Contar total
    const { count } = await server
      .from("informes")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresa_id);

    if ((count ?? 0) > MAX_INFORMES_POR_EMPRESA) {
      // 2) Buscar IDs ordenados por antigüedad y eliminar los sobrantes
      const exceso = (count as number) - MAX_INFORMES_POR_EMPRESA;

      const { data: viejos } = await server
        .from("informes")
        .select("id")
        .eq("empresa_id", empresa_id)
        .order("created_at", { ascending: true })
        .limit(exceso);

      if (viejos && viejos.length > 0) {
        const ids = viejos.map((v) => v.id);
        await server.from("informes").delete().in("id", ids);
      }
    }

    return NextResponse.json(
      { ok: true, id: inserted?.id, empresa_id },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("💥 Error en /api/informes/create:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error interno del servidor." },
      { status: 500 }
    );
  }
}
