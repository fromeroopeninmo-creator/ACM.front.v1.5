// app/api/informes/get/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "Falta id" }, { status: 400 });
    }

    const server = supabaseServer();
    const { data: { user } } = await server.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    // Traer informe
    const { data: informe, error } = await server
      .from("informes")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("GET informe error:", error.message);
      return NextResponse.json({ ok: false, error: "Error al obtener informe" }, { status: 500 });
    }
    if (!informe) {
      return NextResponse.json({ ok: false, error: "Informe no encontrado" }, { status: 404 });
    }

    // Obtener perfil para determinar rol y empresa_id
    const { data: perfil, error: perErr } = await server
      .from("profiles")
      .select("id, role, empresa_id")
      .eq("id", user.id)
      .maybeSingle();

    if (perErr) {
      console.error("GET informe perfil error:", perErr.message);
      return NextResponse.json({ ok: false, error: "Error al obtener perfil" }, { status: 500 });
    }

    // Acceso:
    // - empresa: puede ver informes de su empresa (empresa_id coincide)
    // - asesor: sólo informes propios (autor_id = auth.uid())
    const role = perfil?.role || "empresa";
    if (role === "empresa") {
      if (!perfil?.empresa_id || informe.empresa_id !== perfil.empresa_id) {
        return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 });
      }
    } else if (role === "asesor") {
      if (informe.autor_id !== user.id) {
        return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 });
      }
    }

    return NextResponse.json({ ok: true, informe }, { status: 200 });
  } catch (err) {
    console.error("GET /api/informes/get", err);
    return NextResponse.json({ ok: false, error: "Error inesperado" }, { status: 500 });
  }
}
