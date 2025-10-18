// app/api/informes/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

export async function GET(req: Request) {
  try {
    const server = supabaseServer();

    // --- Auth ---
    const { data: auth } = await server.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    // --- Params opcionales: paginado/búsqueda/estado ---
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get("pageSize") || "20")));
    const q = (searchParams.get("q") || "").trim();
    const estado = (searchParams.get("estado") || "").trim(); // ej: 'borrador' | 'publicado' | '' (todos)

    // --- Rol + empresa_id (misma lógica que en create/get) ---
    let role: Role = ((user.user_metadata as any)?.role as Role) || "empresa";
    let empresaId: string | null = null;

    if (role === "empresa") {
      const { data: emp } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      empresaId = emp?.id ?? null;

      // fallback por si no aparece en empresas
      if (!empresaId) {
        const { data: perfil } = await server
          .from("profiles")
          .select("empresa_id, role")
          .eq("id", user.id)
          .maybeSingle();
        if (perfil?.role) role = perfil.role as Role;
        if (perfil?.empresa_id) empresaId = perfil.empresa_id;
      }
    } else if (role === "asesor") {
      const { data: as } = await server
        .from("asesores")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();
      empresaId = as?.empresa_id ?? null;
    } else {
      // soporte / super_admin / super_admin_root
      const { data: perfil } = await server
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();
      empresaId = perfil?.empresa_id ?? null; // puede ser null, y verán todo
    }

    // --- Base query ---
    // Traemos columnas útiles para el dashboard
    let query = server
      .from("informes")
      .select(
        "id, titulo, tipo, estado, empresa_id, autor_id, created_at, updated_at, imagen_principal_url",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // --- Filtros por rol ---
    if (role === "empresa") {
      // empresa: sólo los de su empresa
      if (!empresaId) {
        return NextResponse.json(
          { ok: true, items: [], total: 0, page, pageSize },
          { status: 200 }
        );
      }
      query = query.eq("empresa_id", empresaId);
    } else if (role === "asesor") {
      // asesor: propios
      query = query.eq("autor_id", user.id);
    } else {
      // admins/soporte: sin filtro; si querés limitar por empresa cuando exista, descomentá:
      // if (empresaId) query = query.eq("empresa_id", empresaId);
    }

    // --- Filtro por estado (opcional) ---
    if (estado && estado !== "todos") {
      query = query.eq("estado", estado);
    }

    // --- Búsqueda (opcional) ---
    if (q) {
      // Supabase: OR con ILIKE
      query = query.or(`titulo.ilike.%${q}%,tipo.ilike.%${q}%`);
    }

    // --- Paginado ---
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Error al listar informes" },
        { status: 400 }
      );
    }

    // payload compatible con front-ends que esperan distintas claves
    return NextResponse.json(
      {
        ok: true,
        items: data || [],
        informes: data || [],
        data: data || [],
        total: count ?? 0,
        page,
        pageSize,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
