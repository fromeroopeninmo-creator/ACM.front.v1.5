// app/api/soporte/empresas/[empresaId]/route.ts
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
  // 1) Por user_id
  const { data: p1 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (p1?.role) return p1.role as Role;

  // 2) Fallback por id (algunas instalaciones usan profiles.id === auth.users.id)
  const { data: p2 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return (p2?.role as Role) ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: { empresaId: string } }
) {
  try {
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

    const empresaId = params?.empresaId;
    if (!empresaId) {
      return NextResponse.json({ error: "Falta empresaId." }, { status: 400 });
    }

    // 1) Traer detalle y KPIs desde la vista segura
    const { data: detalle, error: detErr } = await supabaseAdmin
      .from("v_empresas_detalle_soporte")
      .select(
        "empresa_id, empresa_nombre, cuit, plan_nombre, max_asesores, max_asesores_override, plan_activo, fecha_inicio, fecha_fin, asesores_totales, informes_totales"
      )
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (detErr) {
      return NextResponse.json({ error: detErr.message }, { status: 400 });
    }
    if (!detalle) {
      return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
    }

    // 2) Logo/color + datos de empresa adicionales (para completar el detalle visual)
    const { data: empresaRow } = await supabaseAdmin
      .from("empresas")
      .select("logo_url, color, condicion_fiscal, telefono, direccion, localidad, provincia")
      .eq("id", empresaId)
      .maybeSingle();

    // 3) Últimas acciones de soporte (10)
    const { data: acciones, error: accErr } = await supabaseAdmin
      .from("acciones_soporte")
      .select("id, soporte_id, empresa_id, descripcion, timestamp")
      .eq("empresa_id", empresaId)
      .order("timestamp", { ascending: false })
      .limit(10);

    if (accErr) {
      return NextResponse.json({ error: accErr.message }, { status: 400 });
    }

    // 4) Armar respuesta (mismo shape actual + nuevos campos en empresa)
    const resp = {
      empresa: {
        id: detalle.empresa_id,
        nombre: detalle.empresa_nombre,
        cuit: detalle.cuit,
        logoUrl: empresaRow?.logo_url ?? null,
        color: empresaRow?.color ?? null,
        condicion_fiscal: empresaRow?.condicion_fiscal ?? null,
        telefono: empresaRow?.telefono ?? null,
        direccion: empresaRow?.direccion ?? null,
        localidad: empresaRow?.localidad ?? null,
        provincia: empresaRow?.provincia ?? null,
      },
      plan: {
        nombre: detalle.plan_nombre ?? null,
        maxAsesores: detalle.max_asesores ?? null,
        override: detalle.max_asesores_override ?? null,
        activo: !!detalle.plan_activo,
        fechaInicio: detalle.fecha_inicio,
        fechaFin: detalle.fecha_fin,
      },
      kpis: {
        asesoresTotales: detalle.asesores_totales ?? 0,
        informesTotales: detalle.informes_totales ?? 0,
      },
      ultimasAccionesSoporte:
        acciones?.map((a) => ({
          id: a.id,
          soporteId: a.soporte_id,
          empresaId: a.empresa_id,
          descripcion: a.descripcion,
          timestamp: a.timestamp,
        })) ?? [],
    };

    return NextResponse.json(resp, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
