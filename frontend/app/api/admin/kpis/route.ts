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
  // 1) Por user_id (preferente)
  const { data: p1 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (p1?.role) return p1.role as Role;

  // 2) Fallback por id
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
    const { count: empresasActivasCount, error: epCountErr } = await supabaseAdmin
      .from("empresas_planes")
      .select("empresa_id", { count: "exact", head: true })
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

    // 5) MRR simulado
    // 5.1 Traer planes activos por empresa
    const { data: activos, error: epErr } = await supabaseAdmin
      .from("empresas_planes")
      .select("empresa_id, plan_id, max_asesores_override")
      .eq("activo", true);

    if (epErr) {
      return NextResponse.json({ error: epErr.message }, { status: 400 });
    }

    // Si no hay activos, MRR = 0
    if (!activos || activos.length === 0) {
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

    // 5.2 Traer planes involucrados
    const planIds = Array.from(new Set(activos.map((a) => a.plan_id).filter(Boolean)));
    const { data: planes, error: planesErr } = await supabaseAdmin
      .from("planes")
      .select("id, precio, max_asesores, precio_extra_por_asesor")
      .in("id", planIds);

    if (planesErr) {
      return NextResponse.json({ error: planesErr.message }, { status: 400 });
    }
    const planMap = new Map(
      (planes ?? []).map((p) => [p.id as string, p])
    );

    // 5.3 Contar asesores por empresa
    const { data: asesCounts, error: asesGrpErr } = await supabaseAdmin
      .from("asesores")
      .select("empresa_id, count:id")
      .group("empresa_id");

    if (asesGrpErr) {
      return NextResponse.json({ error: asesGrpErr.message }, { status: 400 });
    }
    const asesMap = new Map<string, number>(
      (asesCounts ?? []).map((r: any) => [r.empresa_id as string, Number(r.count) || 0])
    );

    // 5.4 Calcular MRR empresa por empresa
    let mrrNeto = 0;

    for (const row of activos) {
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

    // 5.5 IVA 21% (solo para mostrar; BD sigue guardando neto)
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
