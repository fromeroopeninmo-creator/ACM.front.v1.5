export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "#lib/supabaseServer";

/**
 * Devuelve la lista de informes visible para el usuario autenticado.
 * Soporta ?scope=empresa | asesor
 * - empresa: todos los informes de la empresa
 * - asesor: solo informes creados por el asesor (autor_id = user.id)
 *
 * Si no llega scope, se infiere por el rol del usuario.
 */
export async function GET(req: Request) {
  try {
    const server = supabaseServer(cookies());
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

    // 2) Resolver empresa_id según rol (y asegurar que existe)
    let empresaId: string | null = null;

    if (role === "empresa") {
      // empresa: buscar su fila en 'empresas' por user_id
      const { data: empRow, error: empErr } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (empErr) throw empErr;
      empresaId = empRow?.id ?? null;
    } else if (role === "asesor") {
      // asesor: buscar en 'asesores' su empresa_id por id = auth.user.id
      const { data: asRow, error: asErr } = await server
        .from("asesores")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();

      if (asErr) throw asErr;
      empresaId = asRow?.empresa_id ?? null;
    }

    // Si no pudimos determinar empresa_id, no hay acceso a informes
    if (!empresaId) {
      return NextResponse.json(
        { error: "No se pudo resolver la empresa del usuario." },
        { status: 400 }
      );
    }

    // 3) Construir query según scope/rol
    let query = server
      .from("informes")
      .select(
        // seleccionamos campos habituales; ajustá si tu tabla tiene otros nombres
        "id, empresa_id, autor_id, titulo, tipo, etiquetas, estado, payload, created_at, updated_at"
      );

    // Decidir alcance
    const scope =
      scopeParam ??
      (role === "empresa" ? "empresa" : role === "asesor" ? "asesor" : "empresa");

    if (scope === "empresa") {
      query = query.eq("empresa_id", empresaId);
    } else {
      // asesor: solo los propios
      query = query.eq("autor_id", user.id);
    }

    // Si tu tabla tiene created_at, podés descomentar el order:
    // query = query.order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, scope, data });
  } catch (err: any) {
    console.error("❌ /api/informes/list error:", err);
    const message = err?.message || "Error listando informes.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
