export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const server = supabaseServer();
    const { searchParams } = new URL(req.url);
    const scopeParam = searchParams.get("scope") as "empresa" | "asesor" | null;

    // 1) Usuario actual
    const { data: userRes, error: userErr } = await server.auth.getUser();
    if (userErr) throw userErr;
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const role =
      (user.user_metadata?.role as string) ||
      (user.app_metadata?.role as string) ||
      "empresa";

    // 2) Resolver empresa_id
    let empresaId: string | null = null;

    if (role === "empresa") {
      // Intento por user_id
      const { data: empByUserId, error: e1 } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (e1) throw e1;

      if (empByUserId?.id) {
        empresaId = empByUserId.id;
      } else {
        // Intento por id_usuario (columna alternativa que tenés en tu tabla)
        const { data: empByAlt, error: e2 } = await server
          .from("empresas")
          .select("id")
          .eq("id_usuario", user.id)
          .maybeSingle();
        if (e2) throw e2;
        empresaId = empByAlt?.id ?? null;
      }
    } else if (role === "asesor") {
      const { data: asRow, error: asErr } = await server
        .from("asesores")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();
      if (asErr) throw asErr;
      empresaId = asRow?.empresa_id ?? null;
    }

    if (!empresaId) {
      return NextResponse.json(
        {
          error:
            "No se pudo resolver la empresa del usuario. Verificá empresas.user_id / empresas.id_usuario o la fila de asesores.",
        },
        { status: 400 }
      );
    }

    // 3) Scope final
    const scope =
      scopeParam ??
      (role === "empresa" ? "empresa" : role === "asesor" ? "asesor" : "empresa");

    // 4) Query (sin 'etiquetas' porque no existe en tu tabla)
    let query = server
      .from("informes")
      .select(
        "id, empresa_id, autor_id, titulo, tipo, estado, payload, created_at, updated_at"
      );

    if (scope === "empresa") {
      query = query.eq("empresa_id", empresaId);
    } else {
      query = query.eq("autor_id", user.id);
    }

    // 5) Ordenar de forma segura
    let { data, error } = await query.order("created_at", { ascending: false });
    if (error?.message?.includes("column") && error.message.includes("created_at")) {
      // Fallback a updated_at si hiciera falta
      ({ data, error } = await query.order("updated_at", { ascending: false }));
    }
    if (error) throw error;

    return NextResponse.json({ ok: true, scope, data });
  } catch (err: any) {
    console.error("❌ /api/informes/list error:", err);
    return NextResponse.json(
      { error: err?.message || "Error listando informes." },
      { status: 400 }
    );
  }
}
