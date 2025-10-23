// app/api/admin/kpis/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

function toNum(x: any): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === "number") return x;
  if (typeof x === "string") return parseFloat(x);
  return Number(x) || 0;
}

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
    // 0) Auth
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // 1) Autorización
    const role = await resolveUserRole(userId);
    const allowed: Role[] = ["super_admin", "super_admin_root"];
    if (!role || !allowed.includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // 2) Empresas activas (asumimos 0 o 1 activo por empresa)
    const { data: activosRows, count: empresasActivasCount, error: epCountErr } =
      await supabaseAdmin
        .from("empresas_planes")
        .select("empresa_id, plan_id, max_asesores_override", { count: "exact" })
        .eq("activo", true);

    if (epCountErr) {
      return NextResponse.json({ error: epCountErr.message }, { status: 400 });
    }

    const empresasActivas = empresasActivasCount ?? 0;

    // 3) Asesores totales
    const { count: asesoresTotales, error: asesCountErr } = await supabaseAdmin
      .from("asesores")
      .select("id", { count: "exact", head: true });
    if (asesCountErr) {
      return NextResponse.json({ error: asesCountErr.message }, { status: 400 });
    }

    // 4) Informes totales
    const { count: informesTotales, error: infCountErr } = await supabaseAdmin
      .from("informes")
      .select("id", { count: "exact", head: true });
    if (infCountErr) {
      return NextResponse.json({ error: infCountErr.message }, { status: 400 });
    }

    // Si no hay empresas activas, devolver KPIs con MRR=0
    if (!activosRows || activosRows.length === 0) {
      return NextResponse.json(
        {
          empresasActivas,
          asesoresTotales: asesoresTotales ?? 0,
          informesTotales: informesTotales ?? 0,
          mrrSimulado: { neto: 0, iva: 0, total: 0 },
        },
        { status: 200 }
      );
    }

    // 5) Traer planes involucrados
    const planIds = Array.from(new Set(activosRows.map((a: any) => a.plan_id).filter(Boolean)));
    const { data: planes, error: planesErr } = await supabaseAdmin
      .from("planes")
      .select("id, precio, max_asesores, precio_extra_por_asesor")
      .in("id", planIds);
    if (planesErr) {
      return NextResponse.json({ error: planesErr.message }, { status: 400 });
    }
    const planMap = new Map<string, any>((planes ?? []).map((p: any) => [p.id as string, p]));

    // 6) Asesores por empresa (usamos la vista v_empresas_detalle_soporte para evitar 'group')
    const empresaIds = Array.from(new Set(activosRows.map((a: any) => a.empresa_id as string)));
    // Hacemos una sola llamada si el set es chico; si crece mucho, podríamos chunkear
    const { data: detalleEmpresas, error: detErr } = await supabaseAdmin
      .from("v_empresas_detalle_soporte")
      .select("empresa_id, asesores_totales")
      .in("empresa_id", empresaIds);

    if (detErr) {
      return NextResponse.json({ error: detErr.message }, { status: 400 });
    }

    const asesMap = new Map<string, number>(
      (detalleEmpresas ?? []).map((r: any) => [r.empresa_id as string, Number(r.asesores_totales) || 0])
    );

    // 7) Calcular MRR empresa por empresa
    let mrrNeto = 0;

    for (const row of activosRows) {
      const empresaId = row.empresa_id as string;
      const plan = planMap.get(row.plan_id as string);
      if (!plan) continue;

      const precioBase = toNum(plan.precio);
      const maxBase = toNum(plan.max_asesores);
      const override = row.max_asesores_override ?? null;
      const cupo = override === null || override === undefined ? maxBase : toNum(override);
      const asesoresEmpresa = asesMap.get(empresaId) ?? 0;
      const excedente = Math.max(0, asesoresEmpresa - cupo);
      const precioExtra = toNum(plan.precio_extra_por_asesor);
      const extra = excedente * precioExtra;

      mrrNeto += precioBase + extra;
    }

    // 8) IVA 21% (solo visual; BD mantiene netos)
    const iva = Math.round(mrrNeto * 0.21 * 100) / 100;
    const total = Math.round((mrrNeto + iva) * 100) / 100;

    return NextResponse.json(
      {
        empresasActivas,
        asesoresTotales: asesoresTotales ?? 0,
        informesTotales: informesTotales ?? 0,
        mrrSimulado: {
          neto: Math.round(mrrNeto * 100) / 100,
          iva,
          total,
        },
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
