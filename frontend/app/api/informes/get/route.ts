// app/api/informes/get/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

type Role =
  | "empresa"
  | "asesor"
  | "soporte"
  | "super_admin"
  | "super_admin_root";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "Falta id" }, { status: 400 });
    }

    const server = supabaseServer();
    const {
      data: { user },
      error: authErr,
    } = await server.auth.getUser();

    if (authErr) {
      console.error("Auth error:", authErr.message);
    }
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    // Traer informe (si no existe, 404)
    const { data: informe, error: infErr } = await server
      .from("informes")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (infErr) {
      console.error("GET informe error:", infErr.message);
      return NextResponse.json(
        { ok: false, error: "Error al obtener informe" },
        { status: 500 }
      );
    }
    if (!informe) {
      return NextResponse.json(
        { ok: false, error: "Informe no encontrado" },
        { status: 404 }
      );
    }

    // Determinar rol (metadata → fallback a profiles.role)
    let role: Role =
      ((user.user_metadata as any)?.role as Role) ||
      "empresa";

    if (!["empresa", "asesor", "soporte", "super_admin", "super_admin_root"].includes(role)) {
      role = "empresa";
    }

    // Resolver empresa_id del usuario, según rol
    let empresaId: string | null = null;

    if (role === "empresa") {
      const { data: emp, error: empErr } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (empErr) {
        console.warn("Error consultando empresa:", empErr.message);
      }
      empresaId = emp?.id ?? null;
    } else if (role === "asesor") {
      const { data: as, error: asErr } = await server
        .from("asesores")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();

      if (asErr) {
        console.warn("Error consultando asesor:", asErr.message);
      }
      empresaId = as?.empresa_id ?? null;
    } else {
      // Roles administrativos: soporte / super_admin / super_admin_root
      // → acceso permitido a cualquier informe
      empresaId = null;
    }

    // Autorización:
    // - empresa: empresa_id del informe debe coincidir con la suya
    // - asesor: autor_id debe ser el usuario logueado (o, si preferís, que coincida empresa)
    // - admin/soporte: acceso total
    if (role === "empresa") {
      if (!empresaId || informe.empresa_id !== empresaId) {
        return NextResponse.json(
          { ok: false, error: "Acceso denegado" },
          { status: 403 }
        );
      }
    } else if (role === "asesor") {
      if (informe.autor_id !== user.id) {
        return NextResponse.json(
          { ok: false, error: "Acceso denegado" },
          { status: 403 }
        );
      }
    }
    // soporte / super_admin / super_admin_root → pasan

    // Devolvemos el informe tal cual.
    // (Si en el futuro querés devolver sólo campos necesarios,
    //  acá podríamos mapearlos antes del return).
    return NextResponse.json({ ok: true, informe }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/informes/get", err?.message || err);
    return NextResponse.json(
      { ok: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
