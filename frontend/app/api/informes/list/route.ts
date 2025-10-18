// app/api/informes/list/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

/**
 * Devuelve los informes asociados a:
 *  - empresa del usuario logueado (si es empresa o asesor)
 *  - o autor = user.id (fallback)
 *
 * Opcionalmente podés pasar:
 *  - ?empresa_id=<uuid>
 *  - ?autor_id=<uuid>
 *  - ?limit=20  (default 50)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const empresaIdParam = searchParams.get("empresa_id");
    const autorIdParam = searchParams.get("autor_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    // 1) Resolver usuario desde Authorization: Bearer <jwt> si viene
    let userId: string | null = null;
    const auth = req.headers.get("authorization") || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (jwt) {
      const { data: userRes } = await supabaseAdmin.auth.getUser(jwt);
      userId = userRes.user?.id ?? null;
    }

    if (!userId && !empresaIdParam && !autorIdParam) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // 2) Resolver empresa_id por defecto (empresa del user o empresa del perfil asesor)
    let empresaId = empresaIdParam ?? null;

    if (!empresaId && userId) {
      const { data: empByUser } = await supabaseAdmin
        .from("empresas")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (empByUser?.id) {
        empresaId = empByUser.id;
      } else {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("role, empresa_id")
          .eq("id", userId)
          .maybeSingle();

        if (prof?.empresa_id) empresaId = prof.empresa_id;
      }
    }

    // 3) Armar query base
    let query = supabaseAdmin
      .from("informes")
      .select("id, titulo, tipo, estado, empresa_id, asesor_id, autor_id, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (empresaId) {
      query = query.eq("empresa_id", empresaId);
    } else if (autorIdParam || userId) {
      // si no hay empresa, al menos listá por autor
      query = query.eq("autor_id", autorIdParam ?? userId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, items: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
