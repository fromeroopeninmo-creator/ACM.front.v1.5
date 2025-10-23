// app/api/admin/auditoria/route.ts
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

/**
 * GET /api/admin/auditoria
 * Query params:
 * - type?: 'planes' | 'soporte'  (si se omite, trae ambos)
 * - from?: ISO/fecha  (auditoria_planes.created_at / acciones_soporte.timestamp >= from)
 * - to?:   ISO/fecha  (<= to)
 * - actor?: uuid      (auditoria_planes.actor_id / acciones_soporte.soporte_id)
 * - empresaId?: uuid  (solo aplica a acciones_soporte)
 * - planId?: uuid     (solo aplica a auditoria_planes)
 * - page?: number     (aplica a ambos listados)
 * - pageSize?: number (aplica a ambos listados)
 *
 * Respuesta 200:
 * {
 *   planes:  [{ id, fecha, actorId, actorRole, action, planId, antes, despues }],
 *   soporte: [{ id, fecha, soporteId, empresaId, descripcion }],
 *   page, pageSize, totalPlanes, totalSoporte
 * }
 */
export async function GET(req: Request) {
  try {
    // 0) Auth
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    // 1) Autorización
    const role = await resolveUserRole(userId);
    const allowed: Role[] = ["super_admin", "super_admin_root"];
    if (!role || !allowed.includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // 2) Params
    const url = new URL(req.url);
    const type = url.searchParams.get("type"); // 'planes' | 'soporte' | null
    const from = url.searchParams.get("from"); // ISO o YYYY-MM-DD
    const to = url.searchParams.get("to");     // ISO o YYYY-MM-DD
    const actor = url.searchParams.get("actor"); // uuid
    const empresaId = url.searchParams.get("empresaId"); // uuid
    const planId = url.searchParams.get("planId"); // uuid
    const page = parseIntSafe(url.searchParams.get("page"), 1);
    const pageSize = parseIntSafe(url.searchParams.get("pageSize"), 20);
    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    const wantsPlanes = !type || type === "planes";
    const wantsSoporte = !type || type === "soporte";

    // 3) auditoria_planes
    let planesItems: any[] = [];
    let totalPlanes = 0;

    if (wantsPlanes) {
      let qP = supabaseAdmin
        .from("auditoria_planes")
        .select(
          "id, actor_id, actor_role, action, plan_id, valores_antes, valores_despues, created_at",
          { count: "exact" }
        );

      if (from) qP = qP.gte("created_at", from);
      if (to) qP = qP.lte("created_at", to);
      if (actor) qP = qP.eq("actor_id", actor);
      if (planId) qP = qP.eq("plan_id", planId);

      qP = qP.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

      const { data: pRows, error: pErr, count: pCount } = await qP;
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

      totalPlanes = pCount ?? 0;

      planesItems =
        pRows?.map((r: any) => ({
          id: r.id,
          fecha: r.created_at,
          actorId: r.actor_id,
          actorRole: r.actor_role,
          action: r.action, // 'create' | 'update' | 'delete'
          planId: r.plan_id,
          antes: r.valores_antes ?? null,
          despues: r.valores_despues ?? null,
        })) ?? [];
    }

    // 4) acciones_soporte
    let soporteItems: any[] = [];
    let totalSoporte = 0;

    if (wantsSoporte) {
      let qS = supabaseAdmin
        .from("acciones_soporte")
        .select("id, soporte_id, empresa_id, descripcion, timestamp", { count: "exact" });

      if (from) qS = qS.gte("timestamp", from);
      if (to) qS = qS.lte("timestamp", to);
      if (actor) qS = qS.eq("soporte_id", actor);
      if (empresaId) qS = qS.eq("empresa_id", empresaId);

      qS = qS.order("timestamp", { ascending: false }).range(offset, offset + limit - 1);

      const { data: sRows, error: sErr, count: sCount } = await qS;
      if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

      totalSoporte = sCount ?? 0;

      soporteItems =
        sRows?.map((r: any) => ({
          id: r.id,
          fecha: r.timestamp,
          soporteId: r.soporte_id,
          empresaId: r.empresa_id,
          descripcion: r.descripcion,
        })) ?? [];
    }

    // 5) Respuesta
    return NextResponse.json(
      {
        planes: planesItems,
        soporte: soporteItems,
        page,
        pageSize: limit,
        totalPlanes,
        totalSoporte,
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
