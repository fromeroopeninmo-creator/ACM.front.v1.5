export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

/**
 * Lista informes visibles para el usuario autenticado.
 * ?scope=empresa | asesor
 * - empresa: todos los informes de la empresa
 * - asesor: solo los del usuario actual
 * Si no llega scope, se infiere por el rol.
 */
export async function GET(req: Request) {
  try {
    const server = supabaseServer();
    const { searchParams } = new URL(req.url);
    const scopeParam = searchParams.get("scope") as "empresa" | "asesor" | null;

    // 1) Usuario
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

    // 2) Resolver empresa_id de forma robusta
    let empresaId: string | null = null;

    if (role === "empresa") {
      // Buscamos por user_id y si no, por id_usuario (ya que tu tabla tiene ambas)
      const { data: empByUserId, error: e1 } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (e1) throw e1;

      if (empByUserId?.id) {
        empresaId = empByUserId.id;
      } else {
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
            "No se pudo resolver la empresa del usuario (revisar empresas.user_id / empresas.id_usuario o la fila del asesor).",
        },
        { status: 400 }
      );
    }

    // 3) Query según scope
    const scope =
      scopeParam ??
      (role === "empresa" ? "empresa" : role === "asesor" ? "asesor" : "empresa");

    let query = server
      .from("informes")
      .select(
        // columnas existentes en tu tabla informes:
        "id, empresa_id, autor_id, titulo, tipo, etiquetas, estado, payload, created_at, updated_at"
      );

    if (scope === "empresa") {
      query = query.eq("empresa_id", empresaId);
    } else {
      query = query.eq("autor_id", user.id);
    }

    // Ordenar de forma segura (si no existe created_at en tu tabla, ordenamos por updated_at)
    // En tu script más reciente, informes sí tiene created_at y updated_at.
    // Aun así, si hay error lo atrapamos y reintentamos sin ordenar.
    let data, error;
    ({ data, error } = await query.order("created_at", { ascending: false }));
    if (error?.message?.includes("column") && error.message.includes("created_at")) {
      // reintento: ordenar por updated_at
      ({ data, error } = await query.order("updated_at", { ascending: false }));
    }
    if (error) throw error;

    return NextResponse.json({ ok: true, scope, data });
  } catch (err: any) {
    console.error("❌ /api/informes/list error:", err);
    // devolvemos el mensaje exacto para que lo veas en la Network tab
    return NextResponse.json(
      { error: err?.message || "Error listando informes." },
      { status: 400 }
    );
  }
}
