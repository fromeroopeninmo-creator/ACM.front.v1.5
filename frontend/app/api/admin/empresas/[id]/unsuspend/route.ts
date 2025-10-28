// frontend/app/api/admin/empresas/[id]/unsuspend/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

async function resolveUserRole(userId: string): Promise<Role | null> {
  const { data: p1 } = await supabaseAdmin.from("profiles").select("role").eq("user_id", userId).maybeSingle();
  if (p1?.role) return p1.role as Role;
  const { data: p2 } = await supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle();
  return (p2?.role as Role) ?? null;
}

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  try {
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const role = await resolveUserRole(userId);
    if (!role || (role !== "super_admin" && role !== "super_admin_root")) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    const { id } = ctx.params;

    const { error } = await supabaseAdmin
      .from("empresas")
      .update({ suspendida: false, suspendida_at: null, suspension_motivo: null })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
