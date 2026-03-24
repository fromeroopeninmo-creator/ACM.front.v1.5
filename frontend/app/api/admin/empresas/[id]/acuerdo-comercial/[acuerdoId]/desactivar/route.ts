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

async function resolveProfileId(userId: string): Promise<string | null> {
  const { data: p1 } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (p1?.id) return String(p1.id);

  const { data: p2 } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  return p2?.id ? String(p2.id) : null;
}

async function assertAdmin() {
  const server = supabaseServer();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "No autenticado." }, { status: 401 }),
    };
  }

  const role = await resolveUserRole(user.id);
  if (role !== "super_admin" && role !== "super_admin_root") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Acceso denegado." }, { status: 403 }),
    };
  }

  const profileId = await resolveProfileId(user.id);

  return {
    ok: true as const,
    userId: user.id,
    profileId,
  };
}

function getTodayISODateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

async function clearEmpresaPlanOperativoPorDesactivacionAcuerdo(params: {
  empresaId: string;
}) {
  const hoy = getTodayISODateOnly();

  const { data: planesActivos, error: readErr } = await supabaseAdmin
    .from("empresas_planes")
    .select("id, fecha_inicio, fecha_fin, activo")
    .eq("empresa_id", params.empresaId)
    .eq("activo", true);

  if (readErr) {
    throw new Error(
      `Error leyendo planes activos para desactivación por acuerdo comercial: ${readErr.message}`
    );
  }

  if (!planesActivos || planesActivos.length === 0) {
    return {
      synced: true,
      reason: "no_active_plan_to_clear",
      planRowIds: [] as string[],
      fechaFinAplicada: hoy,
    };
  }

  const ids = planesActivos.map((row) => String(row.id));

  const { error: clearErr } = await supabaseAdmin
    .from("empresas_planes")
    .update({
      activo: false,
      fecha_fin: hoy,
    })
    .in("id", ids);

  if (clearErr) {
    throw new Error(
      `Error desactivando plan operativo por desactivación de acuerdo: ${clearErr.message}`
    );
  }

  return {
    synced: true,
    reason: "cleared_active_plan_by_acuerdo_deactivation",
    planRowIds: ids,
    fechaFinAplicada: hoy,
  };
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string; acuerdoId: string } }
) {
  try {
    const auth = await assertAdmin();
    if (!auth.ok) return auth.response;

    const empresaId = params?.id;
    const acuerdoId = params?.acuerdoId;

    if (!empresaId || !acuerdoId) {
      return NextResponse.json(
        { error: "Faltan empresaId o acuerdoId." },
        { status: 400 }
      );
    }

    const hoy = getTodayISODateOnly();

    const { data: actual, error: actualErr } = await supabaseAdmin
      .from("empresa_acuerdos_comerciales")
      .select("id, empresa_id, activo, fecha_fin")
      .eq("id", acuerdoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (actualErr) {
      return NextResponse.json({ error: actualErr.message }, { status: 400 });
    }
    if (!actual) {
      return NextResponse.json({ error: "Acuerdo no encontrado." }, { status: 404 });
    }

    const patch: Record<string, any> = {
      activo: false,
      updated_by: auth.profileId,
    };

    if (!actual.fecha_fin || String(actual.fecha_fin) > hoy) {
      patch.fecha_fin = hoy;
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from("empresa_acuerdos_comerciales")
      .update(patch)
      .eq("id", acuerdoId)
      .eq("empresa_id", empresaId)
      .select("*")
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    let planSync:
      | {
          synced: boolean;
          reason: string;
          planRowIds: string[];
          fechaFinAplicada: string;
        }
      | null = null;

    try {
      planSync = await clearEmpresaPlanOperativoPorDesactivacionAcuerdo({
        empresaId,
      });
    } catch (clearErr: any) {
      return NextResponse.json(
        {
          error:
            clearErr?.message ||
            "No se pudo limpiar empresas_planes al desactivar el acuerdo comercial.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        acuerdo: updated,
        plan_sync: planSync,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado." },
      { status: 500 }
    );
  }
}
