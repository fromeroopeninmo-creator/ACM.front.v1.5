// app/api/admin/metrics/route.ts
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

export async function GET() {
  try {
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;

    if (!userId) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const role = await resolveUserRole(userId);
    const allowed = role === "super_admin" || role === "super_admin_root";
    if (!allowed) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // Empresas activas (según plan vigente en la vista segura)
    const { count: empresasActivasCount, error: empErr } = await supabaseAdmin
      .from("v_empresas_soporte")
      .select("empresa_id", { count: "exact", head: true })
      .eq("plan_activo", true);
    if (empErr) throw empErr;

    // Asesores activos
    const { count: asesoresActivosCount, error: asesErr } = await supabaseAdmin
      .from("asesores")
      .select("id", { count: "exact", head: true })
      .eq("activo", true);
    if (asesErr) throw asesErr;

    // Informes totales
    const { count: informesTotalesCount, error: infErr } = await supabaseAdmin
      .from("informes")
      .select("id", { count: "exact", head: true });
    if (infErr) throw infErr;

    // MRR = suma de precios de planes para las empresas con plan activo
    // 1) traer todas las asignaciones activas
    const { data: activos, error: epErr } = await supabaseAdmin
      .from("empresas_planes")
      .select("plan_id")
      .eq("activo", true);
    if (epErr) throw epErr;

    let mrr = 0;
    if (activos && activos.length > 0) {
      const planIds = Array.from(
        new Set((activos.map((r) => r.plan_id).filter(Boolean) as string[]))
      );
      if (planIds.length > 0) {
        const { data: planes, error: pErr } = await supabaseAdmin
          .from("planes")
          .select("id, precio")
          .in("id", planIds);
        if (pErr) throw pErr;

        // Conteo por plan_id
        const countByPlan: Record<string, number> = {};
        for (const row of activos) {
          const pid = row.plan_id as string | null;
          if (!pid) continue;
          countByPlan[pid] = (countByPlan[pid] || 0) + 1;
        }

        for (const pl of planes || []) {
          const qty = countByPlan[pl.id] || 0;
          const precio = Number(pl.precio ?? 0);
          if (Number.isFinite(precio) && qty > 0) {
            mrr += precio * qty;
          }
        }
      }
    }

    return NextResponse.json(
      {
        empresas_activas: empresasActivasCount ?? 0,
        asesores_activos: asesoresActivosCount ?? 0,
        informes_totales: informesTotalesCount ?? 0,
        mrr, // en ARS (neto) según planes.precio
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
