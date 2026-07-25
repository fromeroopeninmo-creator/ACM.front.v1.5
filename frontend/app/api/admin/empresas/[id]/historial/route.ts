export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function assertAdmin() {
  const server = supabaseServer();
  const { data: { user } } = await server.auth.getUser();
  if (!user?.id) return false;
  const { data } = await admin
    .from("profiles")
    .select("role")
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle();
  return data?.role === "super_admin" || data?.role === "super_admin_root";
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await assertAdmin())) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    const [cycles, agreements] = await Promise.all([
      admin
        .from("suscripciones")
        .select("id, estado, inicio, fin, ciclo_inicio, ciclo_fin, moneda, plan_id, plan_actual_id, precio_neto_override, created_at, updated_at, metadata")
        .eq("empresa_id", params.id)
        .order("created_at", { ascending: false }),
      admin
        .from("empresa_acuerdos_comerciales")
        .select("id, plan_id, activo, tipo_acuerdo, descuento_pct, precio_neto_fijo, max_asesores_override, precio_extra_por_asesor_override, modo_iva, iva_pct, fecha_inicio, fecha_fin, motivo, observaciones, created_at, updated_at")
        .eq("empresa_id", params.id)
        .order("created_at", { ascending: false }),
    ]);

    if (cycles.error) throw new Error(cycles.error.message);
    if (agreements.error) throw new Error(agreements.error.message);

    const planIds = Array.from(new Set([
      ...(cycles.data ?? []).flatMap((row: any) => [row.plan_actual_id, row.plan_id]),
      ...(agreements.data ?? []).map((row: any) => row.plan_id),
    ].filter(Boolean).map(String)));

    const plans = planIds.length
      ? await admin.from("planes").select("id, nombre, nombre_comercial").in("id", planIds)
      : { data: [], error: null } as any;
    if (plans.error) throw new Error(plans.error.message);
    const planMap = new Map((plans.data ?? []).map((p: any) => [String(p.id), p.nombre_comercial ?? p.nombre]));

    return NextResponse.json({
      ciclos: (cycles.data ?? []).map((row: any) => ({
        ...row,
        plan_nombre: planMap.get(String(row.plan_actual_id ?? row.plan_id)) ?? null,
      })),
      acuerdos: (agreements.data ?? []).map((row: any) => ({
        ...row,
        plan_nombre: planMap.get(String(row.plan_id)) ?? null,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error interno." }, { status: 500 });
  }
}
