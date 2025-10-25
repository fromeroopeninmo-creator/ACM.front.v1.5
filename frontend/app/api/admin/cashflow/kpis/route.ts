// app/api/admin/cashflow/kpis/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

/* ========================= Utils ========================= */
function parseDateYMD(s: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0));
  return Number.isNaN(d.getTime()) ? null : d;
}
function dayStartISO(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  return x.toISOString();
}
function dayEndISO(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  return x.toISOString();
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function currentMonthRange() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(y, m + 1, 0));
  return {
    desdeISO: dayStartISO(first),
    hastaISO: dayEndISO(last),
    desdeStr: `${first.getUTCFullYear()}-${pad2(first.getUTCMonth() + 1)}-${pad2(first.getUTCDate())}`,
    hastaStr: `${last.getUTCFullYear()}-${pad2(last.getUTCMonth() + 1)}-${pad2(last.getUTCDate())}`,
  };
}
function toNum(x: any): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === "number") return Number.isFinite(x) ? x : 0;
  if (typeof x === "string") {
    const n = parseFloat(x);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

async function resolveUserRole(userId: string): Promise<Role | null> {
  // Preferente: profiles.user_id
  const { data: p1 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (p1?.role) return p1.role as Role;

  // Fallback: profiles.id
  const { data: p2 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (p2?.role as Role) ?? null;
}

/* ========================= GET /kpis ========================= */
export async function GET(req: Request) {
  try {
    // 0) Auth
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // 1) Rol
    const role = await resolveUserRole(userId);
    const allowed: Role[] = ["super_admin", "super_admin_root"];
    if (!role || !allowed.includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // 2) Parámetros (opcionalmente rango YYYY-MM-DD)
    const url = new URL(req.url);
    const desdeParam = url.searchParams.get("desde");
    const hastaParam = url.searchParams.get("hasta");

    const desdeDate = parseDateYMD(desdeParam);
    const hastaDate = parseDateYMD(hastaParam);

    const rng = (() => {
      if (desdeDate && hastaDate && hastaDate >= desdeDate) {
        return {
          desdeISO: dayStartISO(desdeDate),
          hastaISO: dayEndISO(hastaDate),
          desdeStr: `${desdeParam}`,
          hastaStr: `${hastaParam}`,
        };
      }
      // Por defecto: mes en curso
      return currentMonthRange();
    })();

    /* ========================= Ingresos (ledger) =========================
       Suma de monto_neto en movimientos_financieros dentro del rango,
       estado = 'paid'. Pasarela indiferente.
    ===================================================================== */
    let ingresos_neto_total = 0;
    {
      const { data: movs, error: movErr } = await supabaseAdmin
        .from("movimientos_financieros")
        .select("monto_neto, fecha, estado")
        .gte("fecha", rng.desdeISO)
        .lte("fecha", rng.hastaISO)
        .eq("estado", "paid");

      if (movErr) {
        return NextResponse.json({ error: movErr.message }, { status: 400 });
      }
      for (const m of movs ?? []) {
        ingresos_neto_total += toNum((m as any).monto_neto);
      }
    }

    // Visual con IVA 21%
    const ingresos_con_iva = Math.round(ingresos_neto_total * 1.21);

    /* ========================= MRR Neto =========================
       Aprox. mensual: suma del precio del plan vigente por empresa al
       final del rango (rng.hastaISO) + extra por asesor si supera cupo.
       Mismo approach del endpoint original /api/admin/kpis pero con
       referencia temporal rng.hastaISO.
    ===================================================================== */
    let mrr_neto = 0;
    let empresas_activas = 0;

    {
      // Tomamos suscripciones activas cuyo plan no haya vencido para la fecha de referencia
      const refISO = rng.hastaISO;
      const { data: activosRows, error: epErr } = await supabaseAdmin
        .from("empresas_planes")
        .select("empresa_id, plan_id, max_asesores_override, activo, fecha_fin, fecha_inicio")
        .eq("activo", true)
        .lte("fecha_inicio", refISO)
        .or(`fecha_fin.is.null,fecha_fin.gte.${refISO}`);

      if (epErr) {
        return NextResponse.json({ error: epErr.message }, { status: 400 });
      }

      const empresasSet = new Set<string>();
      const planIds: string[] = [];
      for (const r of activosRows ?? []) {
        if (r?.empresa_id) empresasSet.add(String(r.empresa_id));
        if (r?.plan_id) planIds.push(String(r.plan_id));
      }
      empresas_activas = empresasSet.size;

      let planMap = new Map<string, any>();
      if (planIds.length > 0) {
        const uniqPlanIds = Array.from(new Set(planIds));
        const { data: planesRows, error: planesErr } = await supabaseAdmin
          .from("planes")
          .select("id, precio, max_asesores, precio_extra_por_asesor")
          .in("id", uniqPlanIds);
        if (planesErr) {
          return NextResponse.json({ error: planesErr.message }, { status: 400 });
        }
        planMap = new Map<string, any>((planesRows ?? []).map((p: any) => [String(p.id), p]));
      }

      // Conteo de asesores activos por empresa (snapshot actual — suficiente para visual)
      let asesMap = new Map<string, number>();
      if (empresasSet.size > 0) {
        const empresaIds = Array.from(empresasSet);
        const { data: detalleEmp, error: detErr } = await supabaseAdmin
          .from("v_empresas_detalle_soporte")
          .select("empresa_id, asesores_totales")
          .in("empresa_id", empresaIds);
        if (detErr) {
          return NextResponse.json({ error: detErr.message }, { status: 400 });
        }
        asesMap = new Map<string, number>(
          (detalleEmp || []).map((r: any) => [String(r.empresa_id), Number(r.asesores_totales) || 0])
        );
      }

      for (const row of activosRows ?? []) {
        const empresaId = String(row.empresa_id);
        const plan = planMap.get(String(row.plan_id));
        if (!plan) continue;

        const precioBase = toNum(plan.precio);
        const cupoBase = toNum(plan.max_asesores);
        const override = row.max_asesores_override;
        const cupo = override === null || override === undefined ? cupoBase : toNum(override);
        const asesoresEmpresa = asesMap.get(empresaId) ?? 0;
        const excedente = Math.max(0, asesoresEmpresa - cupo);
        const precioExtra = toNum(plan.precio_extra_por_asesor);
        const extra = excedente * precioExtra;

        mrr_neto += precioBase + extra;
      }
    }

    /* ========================= ARPU ========================= */
    const arpu_neto = empresas_activas > 0 ? Math.round(ingresos_neto_total / empresas_activas) : 0;

    /* ========================= Churn/Up/Down (placeholder visual) =========================
       Hasta integrar señalizaciones reales de upgrade/downgrade/churn,
       devolvemos 0 para no romper la UI.
    ===================================================================== */
    const churn_empresas = 0;
    const upgrades = 0;
    const downgrades = 0;

    return NextResponse.json(
      {
        rango: { desde: rng.desdeStr, hasta: rng.hastaStr },
        mrr_neto,
        ingresos_neto_total,
        ingresos_con_iva,
        arpu_neto,
        empresas_activas,
        churn_empresas,
        upgrades,
        downgrades,
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
