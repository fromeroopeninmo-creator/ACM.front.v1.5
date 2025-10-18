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
    // scope queda aceptado pero no es obligatorio para compatibilidad con UI
    const _scope = searchParams.get("scope");

    // ---- Resolver rol y empresa_id (igual que en create/get) ----
    let role: Role = ((user.user_metadata as any)?.role as Role) || "empresa";
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

    // ---- Base query (selección usada por dashboard) ----
    let query = server
      .from("informes")
      .select(
        // incluimos campos típicos del listado
        "id, titulo, tipo, estado, created_at, updated_at, empresa_id, autor_id, imagen_principal_url",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // ---- Filtros por rol con OR para no perder informes ----
    if (role === "empresa") {
      if (!empresaId) {
        query = query.eq("autor_id", user.id);
      } else {
        query = query.or(`empresa_id.eq.${empresaId},autor_id.eq.${user.id}`);
      }
    } else if (role === "asesor") {
      query = query.eq("autor_id", user.id);
    } else {
      if (filterEmpresaId) query = query.eq("empresa_id", filterEmpresaId);
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

    // ⚠️ Compatibilidad de contrato con UI:
    // - Devolvemos tanto "items" como "informes" (muchas UIs esperan "informes")
    // - Mantenemos ok/total/page/limit
    return NextResponse.json(
      {
        ok: true,
        page,
        limit,
        total: count ?? 0,
        items: data ?? [],
        informes: data ?? [], // <- compatibilidad
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
