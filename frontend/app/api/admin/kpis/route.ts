// app/api/admin/kpis/route.ts
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

function toNum(x: any): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === "number") return x;
  if (typeof x === "string") {
    const n = parseFloat(x);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
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

    // Fecha actual (para vigencia "hoy")
    const todayIso = new Date().toISOString();

    // 2) Empresas con plan activo y vigente HOY:
    //    - activo = true
    //    - fecha_inicio <= hoy
    //    - (fecha_fin IS NULL OR fecha_fin >= hoy)
    const { data: activosRows, error: epErr } = await supabaseAdmin
      .from("empresas_planes")
      .select(
        "empresa_id, plan_id, max_asesores_override, activo, fecha_inicio, fecha_fin"
      )
      .eq("activo", true)
      .lte("fecha_inicio", todayIso)
      .or(`fecha_fin.is.null,fecha_fin.gte.${todayIso}`);

    if (epErr) {
      return NextResponse.json({ error: epErr.message }, { status: 400 });
    }

    const empresasSet = new Set<string>();
    const activePlanIds: string[] = [];
    (activosRows || []).forEach((r: any) => {
      if (r?.empresa_id) empresasSet.add(String(r.empresa_id));
      if (r?.plan_id) activePlanIds.push(String(r.plan_id));
    });
    const empresas_activas = empresasSet.size;

    // 3) Asesores activos
    const { count: asesoresActivosCount, error: asesErr } =
      await supabaseAdmin
        .from("asesores")
        .select("id", { count: "exact", head: true })
        .eq("activo", true);

    if (asesErr) {
      return NextResponse.json({ error: asesErr.message }, { status: 400 });
    }
    const asesores_activos = asesoresActivosCount ?? 0;

    // 4) Informes totales
    const { count: informesCount, error: infErr } = await supabaseAdmin
      .from("informes")
      .select("id", { count: "exact", head: true });

    if (infErr) {
      return NextResponse.json({ error: infErr.message }, { status: 400 });
    }
    const informes_totales = informesCount ?? 0;

    // 5) MRR (neto)
    let mrr = 0;

    if ((activosRows?.length ?? 0) > 0) {
      // Map de planes (incluye nombre para detectar "Personalizado")
      const uniqPlanIds = Array.from(new Set(activePlanIds));
      const { data: planesRows, error: planesErr } = await supabaseAdmin
        .from("planes")
        .select(
          "id, nombre, precio, max_asesores, precio_extra_por_asesor"
        )
        .in("id", uniqPlanIds);

      if (planesErr) {
        return NextResponse.json({ error: planesErr.message }, { status: 400 });
      }

      const planMap = new Map<string, any>(
        (planesRows || []).map((p: any) => [String(p.id), p])
      );

      // Traemos también el plan Premium para usar como base del Personalizado
      const { data: premiumRow, error: premiumErr } = await supabaseAdmin
        .from("planes")
        .select("id, nombre, precio")
        .eq("nombre", "Premium")
        .maybeSingle();

      if (premiumErr) {
        // No frenamos todo por esto, pero lo logueamos
        console.warn(
          "admin/kpis: error leyendo plan Premium:",
          premiumErr.message
        );
      }

      const premiumBasePrecio = premiumRow
        ? toNum(premiumRow.precio)
        : 0;

      // Asesores por empresa (snapshot)
      const empresaIds = Array.from(empresasSet);
      let asesMap = new Map<string, number>();

      if (empresaIds.length > 0) {
        const { data: detalleEmp, error: detErr } = await supabaseAdmin
          .from("v_empresas_detalle_soporte")
          .select("empresa_id, asesores_totales")
          .in("empresa_id", empresaIds);

        if (detErr) {
          return NextResponse.json({ error: detErr.message }, { status: 400 });
        }

        asesMap = new Map<string, number>(
          (detalleEmp || []).map((r: any) => [
            String(r.empresa_id),
            Number(r.asesores_totales) || 0,
          ])
        );
      }

      for (const row of activosRows || []) {
        const empresaId = String(row.empresa_id);
        const plan = planMap.get(String(row.plan_id));
        if (!plan) continue;

        const planNombre = String(plan.nombre || "");
        const precioBasePlan = toNum(plan.precio);
        const cupoBasePlan = toNum(plan.max_asesores);
        const override = row.max_asesores_override;
        const cupoConfig =
          override === null || override === undefined
            ? cupoBasePlan
            : toNum(override);
        const asesoresEmpresa = asesMap.get(empresaId) ?? 0;
        const precioExtraUnit = toNum(plan.precio_extra_por_asesor);

        // Caso especial: PLAN PERSONALIZADO
        if (planNombre.toLowerCase() === "personalizado") {
          // Cupo contratado (override prevalece)
          const cupoEfectivo = Math.max(21, cupoConfig || cupoBasePlan);

          // Base: precio del plan Premium (si existe) o, en fallback, el propio precio del plan
          const basePremium =
            premiumBasePrecio > 0 ? premiumBasePrecio : precioBasePlan;

          // Lógica: premium cubre hasta 20 asesores,
          // luego cada asesor adicional suma precio_extra_por_asesor
          const adicionales = Math.max(0, cupoEfectivo - 20);
          const personalizadoPrecio =
            basePremium + adicionales * precioExtraUnit;

          mrr += personalizadoPrecio;
        } else {
          // Planes normales:
          // precio base + extra por asesores que superan el cupo
          const excedenteReal = Math.max(0, asesoresEmpresa - cupoConfig);
          const extra = excedenteReal * precioExtraUnit;
          mrr += precioBasePlan + extra;
        }
      }
    }

    // Respuesta con las claves que espera el front
    return NextResponse.json(
      {
        empresas_activas,
        asesores_activos,
        informes_totales,
        mrr, // neto
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
