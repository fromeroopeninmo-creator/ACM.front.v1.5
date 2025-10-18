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
    const filterEmpresaId = searchParams.get("empresa_id") || null;

    // ---- Resolver rol y empresa_id igual que en create/get ----
    let role: Role =
      ((user.user_metadata as any)?.role as Role) || "empresa";

    let empresaId: string | null = null;

    if (role === "empresa") {
      const { data: emp } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (emp?.id) {
        empresaId = emp.id;
      } else {
        const { data: perfil } = await server
          .from("profiles")
          .select("role, empresa_id")
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
      // soporte / admins
      empresaId = filterEmpresaId; // opcional
    }

    // ---- Base query (selección compacta para dashboard) ----
    let query = server
      .from("informes")
      .select(
        "id, titulo, tipo, estado, created_at, updated_at, empresa_id, autor_id, imagen_principal_url",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // ---- Filtros por rol con OR para no perder informes ----
    if (role === "empresa") {
      // Ver lo de SU empresa + los que el propio user haya creado (por si algún informe no tiene empresa_id asignado bien)
      if (!empresaId) {
        // si por alguna razón no pudimos resolver empresa, al menos devolvemos los del autor
        query = query.eq("autor_id", user.id);
      } else {
        // empresa_id = empresaId OR autor_id = user.id
        query = query.or(`empresa_id.eq.${empresaId},autor_id.eq.${user.id}`);
      }
    } else if (role === "asesor") {
      // Asesor: solo sus propios
      query = query.eq("autor_id", user.id);
    } else {
      // soporte / admins: todo, con filtro opcional por empresa_id
      if (filterEmpresaId) {
        query = query.eq("empresa_id", filterEmpresaId);
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
