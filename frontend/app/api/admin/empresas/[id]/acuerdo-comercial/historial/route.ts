export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role =
  | "empresa"
  | "asesor"
  | "soporte"
  | "super_admin"
  | "super_admin_root";

async function resolveUserRole(userId: string): Promise<Role | null> {
  const { data: p1 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (p1?.role) return p1.role as Role;

  const { data: p2 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return (p2?.role as Role) ?? null;
}

async function assertAdmin() {
  const server = supabaseServer();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "No autenticado." }, { status: 401 }),
    };
  }

  const role = await resolveUserRole(user.id);
  if (role !== "super_admin" && role !== "super_admin_root") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Acceso denegado." }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
  };
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await assertAdmin();
    if (!auth.ok) return auth.response;

    const empresaId = params?.id;
    if (!empresaId) {
      return NextResponse.json({ error: "Falta empresaId." }, { status: 400 });
    }

    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(100, limitRaw))
      : 50;

    const { data, error } = await supabaseAdmin
      .from("empresa_acuerdos_comerciales")
      .select(
        [
          "id",
          "empresa_id",
          "plan_id",
          "activo",
          "tipo_acuerdo",
          "descuento_pct",
          "precio_neto_fijo",
          "max_asesores_override",
          "precio_extra_por_asesor_override",
          "modo_iva",
          "iva_pct",
          "fecha_inicio",
          "fecha_fin",
          "motivo",
          "observaciones",
          "created_by",
          "updated_by",
          "created_at",
          "updated_at",
        ].join(", ")
      )
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        ok: true,
        items: data ?? [],
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado." },
      { status: 500 }
    );
  }
}
