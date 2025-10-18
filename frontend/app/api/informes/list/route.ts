// app/api/informes/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Scope = "empresa" | "asesor";

export async function GET(req: Request) {
  try {
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scope = (searchParams.get("scope") as Scope) || null;

    // Resolver role + empresa_id/asesor
    let role: "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root" = "empresa";
    let empresaId: string | null = null;

    // ¿Empresa?
    const { data: emp } = await supabaseAdmin
      .from("empresas")
      .select("id, user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (emp?.id) {
      role = "empresa";
      empresaId = emp.id;
    } else {
      // ¿Perfil?
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("id, role, empresa_id")
        .eq("id", userId)
        .maybeSingle();

      if (prof?.role) role = prof.role as typeof role;
      if (prof?.empresa_id) empresaId = prof.empresa_id;
    }

    // Construir query según scope/role
    let query = supabaseAdmin
      .from("informes")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (scope === "empresa") {
      if (!empresaId) {
        return NextResponse.json({ ok: true, items: [], informes: [], total: 0 }, { status: 200 });
      }
      query = query.eq("empresa_id", empresaId);
    } else if (scope === "asesor") {
      query = query.eq("autor_id", userId);
    } else {
      // default: si sos empresa, por empresa; si sos asesor, por autor_id
      if (role === "empresa" && empresaId) {
        query = query.eq("empresa_id", empresaId);
      } else {
        query = query.eq("autor_id", userId);
      }
    }

    const { data, count, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    // Normalizar forma de salida para tu dashboard
    const informes = data ?? [];
    const items = informes.map((inf: any) => ({
      id: inf.id,
      titulo: inf.titulo,
      tipo: inf.tipo,
      empresa_id: inf.empresa_id,
      autor_id: inf.autor_id,
      estado: inf.estado,
      created_at: inf.created_at ?? inf.fecha_creacion ?? null,
      updated_at: inf.updated_at ?? null,
      imagen_principal_url: inf.imagen_principal_url ?? null,
    }));

    return NextResponse.json(
      {
        ok: true,
        items,           // <- para UIs que esperan "items"
        informes,        // <- para UIs que esperan "informes"
        total: count ?? items.length,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
