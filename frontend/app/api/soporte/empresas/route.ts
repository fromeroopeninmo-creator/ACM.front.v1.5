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
        // OJO: si tu vista ya expone provincia/created_at, añadilos aquí y
        // más abajo NO hará falta el "merge" con la tabla empresas.
        "empresa_id, empresa_nombre, cuit, plan_nombre, max_asesores, max_asesores_override, plan_activo, fecha_inicio, fecha_fin",
        { count: "exact" }
      );

    // Filtros básicos
    if (q) {
      query = query.or(
        `empresa_nombre.ilike.%${q}%,cuit.ilike.%${q}%`
      );
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
        id: row.empresa_id as string,                 // 👈 normalizamos a "id"
        razon_social: row.empresa_nombre as string,   // 👈 normalizamos a "razon_social"
        cuit: row.cuit as string | null,

        // Estos vienen de la vista:
        plan_nombre: row.plan_nombre as string | null,
        max_asesores: row.max_asesores as number | null,
        max_asesores_override: row.max_asesores_override as number | null,

        // KPIs si tu vista los tuviera (si no, los dejamos como null/0)
        asesores_activos: null as number | null,
        informes_30d: null as number | null,

        // Los completaremos con un 2º query a "empresas"
        provincia: null as string | null,
        created_at: null as string | null,
      })) ?? [];

    // Si no hay items, devolvemos directamente
    if (baseItems.length === 0) {
      return NextResponse.json(
        { items: [], page, pageSize: limit, total: count ?? 0 },
        { status: 200 }
      );
    }

    // 🧩 Traer provincia + created_at (y opcionalmente KPIs si los tenés en empresas)
    const empresaIds = baseItems.map((i) => i.id);
    const { data: empresasRows, error: empErr } = await supabaseAdmin
      .from("empresas")
      .select("id, provincia, created_at")
      .in("id", empresaIds);

    if (empErr) {
      // No rompemos la respuesta si falla; devolvemos lo que tengamos.
      // Pero informamos el error en un campo adicional "warning" si querés.
      // Para simplificar, lo ignoramos.
    }

    const byId = new Map<string, { provincia: string | null; created_at: string | null }>();
    for (const e of empresasRows || []) {
      byId.set(e.id as string, {
        provincia: (e as any).provincia ?? null,
        created_at: (e as any).created_at ?? null,
      });
    }

    // Merge
    const merged = baseItems
      .map((item) => {
        const extra = byId.get(item.id);
        return {
          ...item,
          provincia: extra?.provincia ?? null,
          created_at: extra?.created_at ?? null,
        };
      })
      // Filtro por provincia si lo pidieron y la vista no lo traía
      .filter((i) =>
        provinciaFilter ? (i.provincia || "").toLowerCase().includes(provinciaFilter.toLowerCase()) : true
      );

    return NextResponse.json(
      {
        items: merged,
        page,
        pageSize: limit,
        total: count ?? merged.length, // si count vino bien, usamos count
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
