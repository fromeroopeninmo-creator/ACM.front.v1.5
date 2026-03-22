// app/api/soporte/empresas/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

function parseIntSafe(v: string | null, def: number): number {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : def;
}

// Intenta resolver el rol del usuario mirando profiles por user_id y, si no, por id
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

export async function GET(req: Request) {
  try {
    // 🔐 Auth + rol
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const role = await resolveUserRole(userId);
    const allowed: Role[] = ["soporte", "super_admin", "super_admin_root"];
    if (!role || !allowed.includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // 🔎 Query params (aceptamos ambos nombres: q y search)
    const url = new URL(req.url);
    const qRaw = url.searchParams.get("q");
    const searchRaw = url.searchParams.get("search");
    const q = (searchRaw || qRaw || "").trim();
    const plan = url.searchParams.get("plan");
    const estado = url.searchParams.get("estado"); // 'activo' | 'inactivo'
    const provinciaFilter = url.searchParams.get("provincia")?.trim() || null;

    const page = parseIntSafe(url.searchParams.get("page"), 1);
    const pageSize = parseIntSafe(url.searchParams.get("pageSize"), 20);
    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    // 🧮 Base: vista con info de plan/override/KPIs
    let query = supabaseAdmin
      .from("v_empresas_soporte")
      .select(
        "empresa_id, empresa_nombre, cuit, plan_nombre, max_asesores, max_asesores_override, plan_activo, fecha_inicio, fecha_fin",
        { count: "exact" }
      );

    // Filtros básicos
    if (q) {
      query = query.or(`empresa_nombre.ilike.%${q}%,cuit.ilike.%${q}%`);
    }
    if (plan && plan.trim().length > 0) {
      query = query.eq("plan_nombre", plan);
    }
    if (estado === "activo") query = query.eq("plan_activo", true);
    if (estado === "inactivo") query = query.eq("plan_activo", false);

    // Orden + paginado
    query = query.order("empresa_nombre", { ascending: true }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const baseItems =
      data?.map((row) => ({
        id: row.empresa_id as string,               // 👈 normalizamos a "id"
        razon_social: row.empresa_nombre as string, // 👈 normalizamos a "razon_social"
        cuit: row.cuit as string | null,

        // Estos vienen de la vista:
        plan_nombre: row.plan_nombre as string | null,
        max_asesores: row.max_asesores as number | null,
        max_asesores_override: row.max_asesores_override as number | null,

        // 👇 ESTOS CAMPOS FALTABAN Y LA UI LOS USA
        plan_activo: row.plan_activo as boolean | null,
        fecha_inicio: row.fecha_inicio as string | null,
        fecha_fin: row.fecha_fin as string | null,

        // KPIs si tu vista los tuviera (si no, los dejamos como null/0)
        asesores_activos: null as number | null,
        informes_30d: null as number | null,

        // Los completaremos con queries complementarias
        provincia: null as string | null,
        created_at: null as string | null,

        // Resumen acuerdo comercial activo
        acuerdo_comercial_activo: false as boolean,
        acuerdo_comercial_id: null as string | null,
        acuerdo_comercial_tipo: null as string | null,
        acuerdo_comercial_modo_iva: null as string | null,
        acuerdo_comercial_iva_pct: null as number | null,
        acuerdo_comercial_precio_neto_fijo: null as number | null,
        acuerdo_comercial_descuento_pct: null as number | null,
        acuerdo_comercial_max_asesores_override: null as number | null,
        acuerdo_comercial_precio_extra_por_asesor_override: null as number | null,
        acuerdo_comercial_fecha_inicio: null as string | null,
        acuerdo_comercial_fecha_fin: null as string | null,
      })) ?? [];

    // Si no hay items, devolvemos directamente
    if (baseItems.length === 0) {
      return NextResponse.json(
        { items: [], page, pageSize: limit, total: count ?? 0 },
        { status: 200 }
      );
    }

    // 🧩 Traer provincia + created_at
    const empresaIds = baseItems.map((i) => i.id);

    const { data: empresasRows, error: empErr } = await supabaseAdmin
      .from("empresas")
      .select("id, provincia, created_at")
      .in("id", empresaIds);

    if (empErr) {
      // No rompemos la respuesta si falla; devolvemos lo que tengamos.
    }

    const byId = new Map<string, { provincia: string | null; created_at: string | null }>();
    for (const e of empresasRows || []) {
      byId.set(e.id as string, {
        provincia: (e as any).provincia ?? null,
        created_at: (e as any).created_at ?? null,
      });
    }

    // 🧩 Traer acuerdos comerciales activos/vigentes de esas empresas
    const hoy = new Date().toISOString().slice(0, 10);

    const { data: acuerdosRows, error: acuerdosErr } = await supabaseAdmin
      .from("empresa_acuerdos_comerciales")
      .select(
        "id, empresa_id, tipo_acuerdo, descuento_pct, precio_neto_fijo, max_asesores_override, precio_extra_por_asesor_override, modo_iva, iva_pct, fecha_inicio, fecha_fin, created_at"
      )
      .in("empresa_id", empresaIds)
      .eq("activo", true)
      .lte("fecha_inicio", hoy)
      .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
      .order("created_at", { ascending: false });

    if (acuerdosErr) {
      // No rompemos la respuesta si falla; devolvemos lo que tengamos.
    }

    const acuerdoByEmpresaId = new Map<
      string,
      {
        id: string | null;
        tipo_acuerdo: string | null;
        descuento_pct: number | null;
        precio_neto_fijo: number | null;
        max_asesores_override: number | null;
        precio_extra_por_asesor_override: number | null;
        modo_iva: string | null;
        iva_pct: number | null;
        fecha_inicio: string | null;
        fecha_fin: string | null;
      }
    >();

    for (const a of acuerdosRows || []) {
      const empresaId = (a as any).empresa_id as string;
      if (!acuerdoByEmpresaId.has(empresaId)) {
        acuerdoByEmpresaId.set(empresaId, {
          id: ((a as any).id ?? null) as string | null,
          tipo_acuerdo: ((a as any).tipo_acuerdo ?? null) as string | null,
          descuento_pct:
            (a as any).descuento_pct == null
              ? null
              : Number((a as any).descuento_pct),
          precio_neto_fijo:
            (a as any).precio_neto_fijo == null
              ? null
              : Number((a as any).precio_neto_fijo),
          max_asesores_override:
            (a as any).max_asesores_override == null
              ? null
              : Number((a as any).max_asesores_override),
          precio_extra_por_asesor_override:
            (a as any).precio_extra_por_asesor_override == null
              ? null
              : Number((a as any).precio_extra_por_asesor_override),
          modo_iva: ((a as any).modo_iva ?? null) as string | null,
          iva_pct:
            (a as any).iva_pct == null ? null : Number((a as any).iva_pct),
          fecha_inicio: ((a as any).fecha_inicio ?? null) as string | null,
          fecha_fin: ((a as any).fecha_fin ?? null) as string | null,
        });
      }
    }

    // Merge
    const merged = baseItems
      .map((item) => {
        const extra = byId.get(item.id);
        const acuerdo = acuerdoByEmpresaId.get(item.id);

        return {
          ...item,
          provincia: extra?.provincia ?? null,
          created_at: extra?.created_at ?? null,

          acuerdo_comercial_activo: !!acuerdo,
          acuerdo_comercial_id: acuerdo?.id ?? null,
          acuerdo_comercial_tipo: acuerdo?.tipo_acuerdo ?? null,
          acuerdo_comercial_modo_iva: acuerdo?.modo_iva ?? null,
          acuerdo_comercial_iva_pct: acuerdo?.iva_pct ?? null,
          acuerdo_comercial_precio_neto_fijo: acuerdo?.precio_neto_fijo ?? null,
          acuerdo_comercial_descuento_pct: acuerdo?.descuento_pct ?? null,
          acuerdo_comercial_max_asesores_override:
            acuerdo?.max_asesores_override ?? null,
          acuerdo_comercial_precio_extra_por_asesor_override:
            acuerdo?.precio_extra_por_asesor_override ?? null,
          acuerdo_comercial_fecha_inicio: acuerdo?.fecha_inicio ?? null,
          acuerdo_comercial_fecha_fin: acuerdo?.fecha_fin ?? null,
        };
      })
      // Filtro por provincia si lo pidieron y la vista no lo traía
      .filter((i) =>
        provinciaFilter
          ? (i.provincia || "").toLowerCase().includes(provinciaFilter.toLowerCase())
          : true
      );

    return NextResponse.json(
      {
        items: merged,
        page,
        pageSize: limit,
        total: count ?? merged.length,
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
