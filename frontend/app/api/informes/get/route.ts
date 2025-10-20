// app/api/informes/get/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

// --- Admin client (bypass RLS solo para leer y luego autorizar en código) ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    // Admitimos ?id=... o ?informeId=...
    const id = searchParams.get("id") || searchParams.get("informeId");
    if (!id) {
      return NextResponse.json({ ok: false, error: "Falta id" }, { status: 400 });
    }

    // 1) Usuario actual (desde cookie)
    const server = supabaseServer();
    const { data: { user }, error: authErr } = await server.auth.getUser();
    if (authErr) {
      console.warn("Auth error:", authErr.message);
    }
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    // 2) Traer el informe con SERVICE_ROLE (evita 404 por RLS)
    const { data: informe, error: infErr } = await supabaseAdmin
      .from("informes")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (infErr) {
      console.error("GET informe (admin) error:", infErr.message);
      return NextResponse.json({ ok: false, error: "Error al obtener informe" }, { status: 500 });
    }
    if (!informe) {
      return NextResponse.json({ ok: false, error: "Informe no encontrado" }, { status: 404 });
    }

    // 3) Resolver rol del usuario
    let role: Role =
      ((user.user_metadata as any)?.role as Role) ||
      "empresa";
    if (!["empresa", "asesor", "soporte", "super_admin", "super_admin_root"].includes(role)) {
      role = "empresa";
    }

    // 4) Resolver empresa_id del usuario para autorización
    let empresaId: string | null = null;

    if (role === "empresa") {
      const { data: emp, error: empErr } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (empErr) console.warn("Empresas lookup:", empErr.message);
      empresaId = emp?.id ?? null;
    } else if (role === "asesor") {
      const { data: as, error: asErr } = await server
        .from("asesores")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();
      if (asErr) console.warn("Asesores lookup:", asErr.message);
      empresaId = as?.empresa_id ?? null;
    } else {
      // soporte/super_admin/super_admin_root → tendrán acceso full
      empresaId = null;
    }

    // 5) Autorización (en código)
    if (role === "empresa") {
      if (!empresaId || informe.empresa_id !== empresaId) {
        return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 });
      }
    } else if (role === "asesor") {
      if (informe.autor_id !== user.id) {
        return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 });
      }
    }
    // soporte/super_admin/super_admin_root → OK

    // 6) Respuesta
    return NextResponse.json(
      { ok: true, informe },
      {
        status: 200,
        headers: {
          // Evitar cacheo de un informe que puede editarse
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err: any) {
    console.error("GET /api/informes/get", err?.message || err);
    return NextResponse.json({ ok: false, error: "Error inesperado" }, { status: 500 });
  }
}
