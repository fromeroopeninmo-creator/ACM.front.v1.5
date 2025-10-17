export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

type Scope = "empresa" | "asesor";
type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

export async function GET(req: Request) {
  try {
    const server = supabaseServer();
    const {
      data: { user },
    } = await server.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const scopeParam = (searchParams.get("scope") as Scope) || null;

    // rol
    const role = ((user.user_metadata as any)?.role || "empresa") as Role;

    // resolver empresa_id cuando aplique
    let empresaId: string | null = null;

    if (role === "empresa") {
      const { data: emp, error: empErr } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (empErr || !emp) {
        return NextResponse.json({ error: "No se pudo resolver la empresa." }, { status: 400 });
      }
      empresaId = emp.id;
    } else if (role === "asesor") {
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
    } else {
      return NextResponse.json({ error: "Rol no soportado." }, { status: 403 });
    }

    // construir query
    let q = server
      .from("informes")
      .select(
        `
        id,
        titulo,
        tipo,
        estado,
        created_at,
        updated_at,
        imagen_principal_url,
        comp1_url,
        comp2_url,
        comp3_url,
        comp4_url,
        etiquetas,
        autor_id,
        asesor_id,
        empresa_id
      `
      )
      .order("created_at", { ascending: false });

    if (scopeParam === "asesor" || role === "asesor") {
      // solo mis informes
      q = q.eq("autor_id", user.id);
    } else {
      // por defecto empresa: todos los informes de la empresa
      q = q.eq("empresa_id", empresaId!);
    }

    const { data, error } = await q.limit(100);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, items: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error interno." }, { status: 500 });
  }
}
