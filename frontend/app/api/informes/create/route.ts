export const runtime = "nodejs";
export const dynamic = "force-dynamic";


// frontend/app/api/informes/create/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(URL, SERVICE_KEY);

async function resolveEmpresaId(userId: string) {
  const { data: empByUser } = await admin
    .from("empresas")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (empByUser?.id) return empByUser.id;

  const { data: asesor } = await admin
    .from("asesores")
    .select("empresa_id")
    .eq("id", userId)
    .maybeSingle();
  if (asesor?.empresa_id) return asesor.empresa_id;

  return null;
}

export async function POST(req: Request) {
  try {
    const server = supabaseServer(cookies());
    const { data: userRes } = await server.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const empresaId = await resolveEmpresaId(user.id);
    if (!empresaId) {
      return NextResponse.json({ error: "No se pudo resolver empresa." }, { status: 400 });
    }

    const body = await req.json();
    const {
      titulo = "Informe VAI",
      tipo = "VAI",
      payload = {},
      imagen_principal_url,
      comp1_url,
      comp2_url,
      comp3_url,
      comp4_url,
    } = body || {};

    const insertObj = {
      empresa_id: empresaId,
      autor_id: user.id,
      titulo,
      tipo,
      payload,
      imagen_principal_url: imagen_principal_url ?? null,
      comp1_url: comp1_url ?? null,
      comp2_url: comp2_url ?? null,
      comp3_url: comp3_url ?? null,
      comp4_url: comp4_url ?? null,
    };

    const { data, error } = await admin
      .from("informes")
      .insert(insertObj)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, id: data?.id }, { status: 200 });
  } catch (err: any) {
    console.error("💥 /api/informes/create:", err);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
