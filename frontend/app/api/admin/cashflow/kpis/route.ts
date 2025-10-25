// frontend/app/api/admin/cashflow/kpis/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

// ===== Utils =====
function pad2(n: number) { return String(n).padStart(2, "0"); }
function ymdToDate(s: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2]-1, +m[3]));
  return isNaN(d.getTime()) ? null : d;
}
function dayStartISO(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0,0,0,0)).toISOString();
}
function dayEndISO(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23,59,59,999)).toISOString();
}
function currentMonthRange() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()+1, 0));
  return {
    desdeStr: `${first.getUTCFullYear()}-${pad2(first.getUTCMonth()+1)}-${pad2(first.getUTCDate())}`,
    hastaStr: `${last.getUTCFullYear()}-${pad2(last.getUTCMonth()+1)}-${pad2(last.getUTCDate())}`,
    desdeISO: dayStartISO(first),
    hastaISO: dayEndISO(last),
  };
}
function toNum(x: any): number {
  if (x === null || x === undefined) return 0;
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

async function resolveUserRole(userId: string): Promise<Role | null> {
  const { data: p1 } = await supabaseAdmin
    .from("profiles").select("role").eq("user_id", userId).maybeSingle();
  if (p1?.role) return p1.role as Role;

  const { data: p2 } = await supabaseAdmin
    .from("profiles").select("role").eq("id", userId).maybeSingle();
  return (p2?.role as Role) ?? null;
}

// ===== Handler =====
export async function GET(req: Request) {
  try {
    // 0) Auth
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    // 1) Rol
    const role = await resolveUserRole(userId);
    if (!role || !["super_admin","super_admin_root"].includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // 2) Rango (YYYY-MM-DD), default mes actual
    const url = new URL(req.url);
    const d1 = ymdToDate(url.searchParams.get("desde"));
    const d2 = ymdToDate(url.searchParams.get("hasta"));
    const rng = (d1 && d2 && d2 >= d1)
      ? { desdeStr: url.searchParams.get("desde")!, hastaStr: url.searchParams.get("hasta")!, desdeISO: dayStartISO(d1), hastaISO: dayEndISO(d2) }
      : currentMonthRange();

    // 3) Suscripciones activas para referencia dentro del rango:
    //    Plan activo si (fecha_inicio <= hasta) AND (fecha_fin IS NULL OR fecha_fin >= desde)
    const { data: epRows, error: epErr } = await supabaseAdmin
      .from("empresas_planes")
      .select("empresa_id, plan_id, max_asesores_override, activo, fecha_inicio, fecha_fin")
      .eq("activo", true)
      .lte("fecha_inicio", rng.hastaISO)
      .or(`fecha_fin.is.null,fecha_fin.gte.${rng.desdeISO}`);

    if (epErr) return NextResponse.json({ error: epErr.message }, { status: 400 });

    const empresaIds = new Set<string>();
    const planIds: string[] = [];
    for (const r of epRows ?? []) {
      if (r.empresa_id) empresaIds.add(String(r.empresa_id));
      if (r.plan_id) planIds.push(String(r.plan_id));
    }
    const empresas_activas = empresaIds.size;

    // 4) Map de planes
    let planMap = new Map<string, any>();
    if (planIds.length) {
      const uniq = Array.from(new Set(planIds));
      const { data: planes, error: pe } = await supabaseAdmin
        .from("planes")
        .select("id, precio, max_asesores, precio_extra_por_asesor")
        .in("id", uniq);
      if (pe) return NextResponse.json({ error: pe.message }, { status: 400 });
      planMap = new Map((planes ?? []).map((p: any) => [String(p.id), p]));
    }

    // 5) Asesores por empresa (snapshot, suficiente para visual — igual que tu /api/admin/kpis)
    let asesMap = new Map<string, number>();
    if (empresaIds.size) {
      const { data: det, error: de } = await supabaseAdmin
        .from("v_empresas_detalle_soporte")
        .select("empresa_id, asesores_totales")
        .in("empresa_id", Array.from(empresaIds));
      if (de) return NextResponse.json({ error: de.message }, { status: 400 });
      asesMap = new Map((det ?? []).map((r: any) => [String(r.empresa_id), Number(r.asesores_totales) || 0]));
    }

    // 6) KPI MRR (neto) — misma lógica que el endpoint original:
    let mrr_neto = 0;
    for (const row of epRows ?? []) {
      const plan = planMap.get(String(row.plan_id));
      if (!plan) continue;
      const precioBase = toNum(plan.precio);
      const cupoBase   = toNum(plan.max_asesores);
      const override   = row.max_asesores_override;
      const cupo       = (override === null || override === undefined) ? cupoBase : toNum(override);
      const ases       = asesMap.get(String(row.empresa_id)) ?? 0;
      const excedente  = Math.max(0, ases - cupo);
      const extra      = excedente * toNum(plan.precio_extra_por_asesor);
      mrr_neto += precioBase + extra;
    }

    // 7) Ingresos del período (neto): como no hay ledger confiable aún, aproximamos a MRR
    //    (visual). Cuando integres pasarela, reemplazamos por suma de movimientos 'paid'.
    const ingresos_neto_total = mrr_neto;
    const ingresos_con_iva    = Math.round(ingresos_neto_total * 1.21);
    const arpu_neto           = empresas_activas > 0 ? Math.round(ingresos_neto_total / empresas_activas) : 0;

    return NextResponse.json({
      rango: { desde: rng.desdeStr, hasta: rng.hastaStr },
      mrr_neto,
      ingresos_neto_total,
      ingresos_con_iva,
      arpu_neto,
      empresas_activas,
      churn_empresas: 0,
      upgrades: 0,
      downgrades: 0,
    }, { status: 200 });

  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
