export const runtime = "nodejs";
export const dynamic = "force-dynamic";


// frontend/app/api/informes/list/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(URL, SERVICE_KEY);

async function resolveContext(userId: string) {
  // ¿Empresa?
  const { data: emp } = await admin
    .from("empresas")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (emp?.id) return { role: "empresa", empresaId: emp.id };

  // ¿Asesor?
  const { data: as } = await admin
    .from("asesores")
    .select("empresa_id")
    .eq("id", userId)
    .maybeSingle();
  if (as?.empresa_id) return { role: "asesor", empresaId: as.empresa_id };

  return { role: "desconocido", empresaId: null };
}

export async function GET(req: Request) {
  try {
    const server = supabaseServer(cookies());
    const { data: userRes } = await server.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const { role, empresaId } = await resolveContext(user.id);
    if (!empresaId) {
      return NextResponse.json({ error: "No se pudo resolver empresa." }, { status: 400 });
    }

    const url = new URL(req.url);
    const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(
      Math.max(parseInt(url.searchParams.get("pageSize") || "10", 10), 1),
      100
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = admin
      .from("informes")
      .select("id, empresa_id, autor_id, titulo, tipo, created_at, imagen_principal_url", {
        count: "exact",
      })
      .order("created_at", { ascending: false });

    if (role === "empresa") {
      q = q.eq("empresa_id", empresaId);
    } else if (role === "asesor") {
      q = q.eq("autor_id", user.id);
    } else {
      return NextResponse.json(
        { error: "Rol no reconocido. Debe ser empresa o asesor." },
        { status: 403 }
      );
    }

    const { data, count, error } = await q.range(from, to);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        page,
        pageSize,
        total: count ?? 0,
        items: data ?? [],
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("💥 /api/informes/list:", err);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
