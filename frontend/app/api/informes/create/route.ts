export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "#lib/supabaseServer";

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

export async function POST(req: Request) {
  try {
    const server = supabaseServer();
    const {
      data: { user },
    } = await server.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.datos) {
      return NextResponse.json({ error: "Falta 'datos' (JSON del informe)." }, { status: 400 });
    }

    const { titulo, tipo, datos, etiquetas } = body as {
      titulo?: string;
      tipo?: string;
      datos: any;
      etiquetas?: any[];
    };

    // rol desde user_metadata (tu app lo viene usando así)
    const role = ((user.user_metadata as any)?.role || "empresa") as Role;

    // Resolver empresa_id según rol:
    let empresaId: string | null = null;
    let asesorId: string | null = null;

    if (role === "empresa") {
      // La empresa es el usuario dueño de empresas.user_id
      const { data: emp, error: empErr } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (empErr || !emp) {
        return NextResponse.json(
          { error: "No se pudo resolver la empresa del usuario." },
          { status: 400 }
        );
      }
      empresaId = emp.id;
      asesorId = null;
    } else if (role === "asesor") {
      // El asesor está en la tabla asesores con empresa_id
      const { data: as, error: asErr } = await server
        .from("asesores")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();

      if (asErr || !as?.empresa_id) {
        return NextResponse.json(
          { error: "El asesor no tiene empresa asociada." },
          { status: 400 }
        );
      }
      empresaId = as.empresa_id;
      asesorId = user.id;
    } else {
      return NextResponse.json(
        { error: "Rol no soportado para crear informes." },
        { status: 403 }
      );
    }

    // Insert en public.informes con tus columnas reales
    const insertPayload = {
      empresa_id: empresaId,
      asesor_id: asesorId,
      autor_id: user.id,
      tipo: tipo || "VAI",
      titulo: titulo || "Informe VAI",
      datos_json: datos,                 // ← JSON completo del VAI
      etiquetas: Array.isArray(etiquetas) ? etiquetas : [], // ← jsonb []
      estado: "borrador",                // o "finalizado" si lo deseas
      // el resto con defaults de la tabla
    };

    const { data: row, error: insErr } = await server
      .from("informes")
      .insert(insertPayload)
      .select("id, titulo, created_at")
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, informe: row }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error interno." }, { status: 500 });
  }
}
