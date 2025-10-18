// app/api/informes/list/route.ts
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
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const user = auth?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const scope = searchParams.get("scope") || ""; // empresa | asesor | all (admins)
    const filterEmpresaId = searchParams.get("empresa_id") || null;

    // ---- Resolver rol + empresa_id (igual criterio que otras rutas) ----
    // 1) Intentar resolver como empresa
    let role: Role = "empresa";
    let empresaId: string | null = null;

    const metaRole = (user.user_metadata as any)?.role as Role | undefined;
    if (metaRole) role = metaRole;

    if (role === "empresa") {
      const { data: emp, error: empErr } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!empErr && emp?.id) {
        empresaId = emp.id;
      } else {
        // Si no hay empresa, intentar caer al perfil (p.ej. seeded desde profiles)
        const { data: perfil } = await server
          .from("profiles")
          .select("role, empresa_id")
          .eq("id", user.id)
          .maybeSingle();

        if (perfil?.role) role = perfil.role as Role;
        if (perfil?.empresa_id) empresaId = perfil.empresa_id;
      }
    } else if (role === "asesor") {
      // Asesor → empresa_id desde tabla asesores
      const { data: as } = await server
        .from("asesores")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();
      empresaId = as?.empresa_id ?? null;
    } else {
      // soporte / super_admin / super_admin_root
      // Sin empresa obligatoria (pero podemos filtrar por empresa_id si viene en query)
      empresaId = filterEmpresaId;
    }

    // ---- Construir query base ----
    let query = server
      .from("informes")
      .select(
        "id, titulo, tipo, estado, created_at, updated_at, empresa_id, autor_id, imagen_principal_url",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // ---- Filtros por rol/scope ----
    if (role === "empresa") {
      if (!empresaId) {
        return NextResponse.json(
          { ok: false, error: "No se pudo resolver la empresa del usuario." },
          { status: 400 }
        );
      }
      query = query.eq("empresa_id", empresaId);
    } else if (role === "asesor") {
      // Solo sus propios informes
      query = query.eq("autor_id", user.id);
    } else {
      // soporte / admins
      if (filterEmpresaId) {
        query = query.eq("empresa_id", filterEmpresaId);
      }
      // si scope==empresa, pero es admin, respetamos empresa_id si viene
      if (scope === "asesor") {
        query = query.eq("autor_id", user.id);
      }
    }

    // ---- Paginación ----
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) {
      console.error("LIST informes error:", error.message);
      return NextResponse.json(
        { ok: false, error: "Error al listar informes" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        page,
        limit,
        total: count ?? 0,
        items: data ?? [],
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("GET /api/informes/list", err?.message || err);
    return NextResponse.json(
      { ok: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
