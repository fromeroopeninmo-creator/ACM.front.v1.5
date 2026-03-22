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

type TipoAcuerdoComercial =
  | "descuento_pct"
  | "precio_fijo"
  | "precio_fijo_con_cupo"
  | "descuento_con_cupo";

type ModoIVA = "sumar_al_neto" | "incluido_en_precio" | "no_aplica";

type CreateAcuerdoBody = {
  plan_id?: string | null;
  tipo_acuerdo: TipoAcuerdoComercial;
  descuento_pct?: number | null;
  precio_neto_fijo?: number | null;
  max_asesores_override?: number | null;
  precio_extra_por_asesor_override?: number | null;
  modo_iva?: ModoIVA | null;
  iva_pct?: number | null;
  fecha_inicio: string;
  fecha_fin?: string | null;
  motivo?: string | null;
  observaciones?: string | null;
};

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
    role,
  };
}

function normalizeNullableString(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function normalizeNullableNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isValidISODateOnly(v: unknown): v is string {
  if (typeof v !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function validateCreateBody(body: CreateAcuerdoBody) {
  const tipos: TipoAcuerdoComercial[] = [
    "descuento_pct",
    "precio_fijo",
    "precio_fijo_con_cupo",
    "descuento_con_cupo",
  ];

  const modosIVA: ModoIVA[] = [
    "sumar_al_neto",
    "incluido_en_precio",
    "no_aplica",
  ];

  if (!tipos.includes(body.tipo_acuerdo)) {
    return "tipo_acuerdo inválido.";
  }

  if (!isValidISODateOnly(body.fecha_inicio)) {
    return "fecha_inicio es obligatoria y debe tener formato YYYY-MM-DD.";
  }

  if (body.fecha_fin != null && !isValidISODateOnly(body.fecha_fin)) {
    return "fecha_fin debe tener formato YYYY-MM-DD.";
  }

  if (body.fecha_fin && body.fecha_fin < body.fecha_inicio) {
    return "fecha_fin no puede ser menor que fecha_inicio.";
  }

  if (body.modo_iva != null && !modosIVA.includes(body.modo_iva)) {
    return "modo_iva inválido.";
  }

  if (body.descuento_pct != null && (body.descuento_pct < 0 || body.descuento_pct > 100)) {
    return "descuento_pct debe estar entre 0 y 100.";
  }

  if (body.precio_neto_fijo != null && body.precio_neto_fijo < 0) {
    return "precio_neto_fijo no puede ser negativo.";
  }

  if (body.max_asesores_override != null && body.max_asesores_override < 0) {
    return "max_asesores_override no puede ser negativo.";
  }

  if (
    body.precio_extra_por_asesor_override != null &&
    body.precio_extra_por_asesor_override < 0
  ) {
    return "precio_extra_por_asesor_override no puede ser negativo.";
  }

  if (body.iva_pct != null && (body.iva_pct < 0 || body.iva_pct > 100)) {
    return "iva_pct debe estar entre 0 y 100.";
  }

  if (body.tipo_acuerdo === "descuento_pct" && body.descuento_pct == null) {
    return "descuento_pct es obligatorio para tipo_acuerdo = descuento_pct.";
  }

  if (body.tipo_acuerdo === "precio_fijo" && body.precio_neto_fijo == null) {
    return "precio_neto_fijo es obligatorio para tipo_acuerdo = precio_fijo.";
  }

  if (
    body.tipo_acuerdo === "precio_fijo_con_cupo" &&
    (body.precio_neto_fijo == null || body.max_asesores_override == null)
  ) {
    return "precio_neto_fijo y max_asesores_override son obligatorios para tipo_acuerdo = precio_fijo_con_cupo.";
  }

  if (
    body.tipo_acuerdo === "descuento_con_cupo" &&
    (body.descuento_pct == null || body.max_asesores_override == null)
  ) {
    return "descuento_pct y max_asesores_override son obligatorios para tipo_acuerdo = descuento_con_cupo.";
  }

  return null;
}

function isDateInRangeToday(fechaInicio: string, fechaFin?: string | null) {
  const hoy = new Date().toISOString().slice(0, 10);
  if (fechaInicio > hoy) return false;
  if (fechaFin && fechaFin < hoy) return false;
  return true;
}

function addDaysToDateOnly(dateOnly: string, days: number): string {
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function resolvePlanFechaFin(params: {
  planId: string;
  fechaInicio: string;
  fechaFin?: string | null;
}) {
  if (params.fechaFin) return params.fechaFin;

  const { data: plan, error } = await supabaseAdmin
    .from("planes")
    .select("duracion_dias")
    .eq("id", params.planId)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo resolver duracion_dias del plan: ${error.message}`);
  }

  const duracionDias =
    typeof plan?.duracion_dias === "number" && plan.duracion_dias > 0
      ? plan.duracion_dias
      : 30;

  return addDaysToDateOnly(params.fechaInicio, duracionDias);
}

async function syncEmpresaPlanOperativoConAcuerdo(params: {
  empresaId: string;
  planId: string;
  fechaInicio: string;
  fechaFin?: string | null;
  maxAsesoresOverride?: number | null;
}) {
  const acuerdoVigenteHoy = isDateInRangeToday(params.fechaInicio, params.fechaFin);

  if (!acuerdoVigenteHoy) {
    return {
      synced: false,
      reason: "acuerdo_fuera_de_vigencia_hoy",
      planRowId: null as string | null,
      fechaFinAplicada: params.fechaFin ?? null,
    };
  }

  const fechaFinAplicada = await resolvePlanFechaFin({
    planId: params.planId,
    fechaInicio: params.fechaInicio,
    fechaFin: params.fechaFin,
  });

  const { data: planActivoActual, error: activoErr } = await supabaseAdmin
    .from("empresas_planes")
    .select("id, plan_id, fecha_inicio, fecha_fin, max_asesores_override, activo")
    .eq("empresa_id", params.empresaId)
    .eq("activo", true)
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activoErr) {
    throw new Error(`Error leyendo plan activo actual de la empresa: ${activoErr.message}`);
  }

  if (planActivoActual?.id && String(planActivoActual.plan_id) === params.planId) {
    const { data: updated, error: updErr } = await supabaseAdmin
      .from("empresas_planes")
      .update({
        fecha_inicio: params.fechaInicio,
        fecha_fin: fechaFinAplicada,
        max_asesores_override:
          params.maxAsesoresOverride == null ? null : params.maxAsesoresOverride,
        activo: true,
      })
      .eq("id", planActivoActual.id)
      .select("id")
      .single();

    if (updErr) {
      throw new Error(`Error actualizando empresas_planes existente: ${updErr.message}`);
    }

    return {
      synced: true,
      reason: "updated_existing_active_plan",
      planRowId: updated?.id ? String(updated.id) : null,
      fechaFinAplicada,
    };
  }

  if (planActivoActual?.id) {
    const { error: deactivateErr } = await supabaseAdmin
      .from("empresas_planes")
      .update({
        activo: false,
      })
      .eq("empresa_id", params.empresaId)
      .eq("activo", true);

    if (deactivateErr) {
      throw new Error(`Error desactivando plan activo anterior: ${deactivateErr.message}`);
    }
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("empresas_planes")
    .insert([
      {
        empresa_id: params.empresaId,
        plan_id: params.planId,
        fecha_inicio: params.fechaInicio,
        fecha_fin: fechaFinAplicada,
        max_asesores_override:
          params.maxAsesoresOverride == null ? null : params.maxAsesoresOverride,
        activo: true,
      },
    ])
    .select("id")
    .single();

  if (insertErr) {
    throw new Error(`Error insertando plan operativo alineado al acuerdo: ${insertErr.message}`);
  }

  return {
    synced: true,
    reason: "inserted_new_active_plan",
    planRowId: inserted?.id ? String(inserted.id) : null,
    fechaFinAplicada,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await assertAdmin();
    if (!auth.ok) return auth.response;

    const empresaId = params?.id;
    if (!empresaId) {
      return NextResponse.json({ error: "Falta empresaId." }, { status: 400 });
    }

    const hoy = new Date().toISOString().slice(0, 10);

    const { data: acuerdo, error } = await supabaseAdmin
      .from("empresa_acuerdos_comerciales")
      .select(
        [
          "id",
          "empresa_id",
          "plan_id",
          "activo",
          "tipo_acuerdo",
          "descuento_pct",
          "precio_neto_fijo",
          "max_asesores_override",
          "precio_extra_por_asesor_override",
          "modo_iva",
          "iva_pct",
          "fecha_inicio",
          "fecha_fin",
          "motivo",
          "observaciones",
          "created_by",
          "updated_by",
          "created_at",
          "updated_at",
        ].join(", ")
      )
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .lte("fecha_inicio", hoy)
      .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        ok: true,
        acuerdo: acuerdo ?? null,
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

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await assertAdmin();
    if (!auth.ok) return auth.response;

    const empresaId = params?.id;
    if (!empresaId) {
      return NextResponse.json({ error: "Falta empresaId." }, { status: 400 });
    }

    const bodyRaw = (await req.json().catch(() => null)) as CreateAcuerdoBody | null;
    if (!bodyRaw) {
      return NextResponse.json({ error: "Body inválido." }, { status: 400 });
    }

    const body: CreateAcuerdoBody = {
      plan_id: normalizeNullableString(bodyRaw.plan_id),
      tipo_acuerdo: bodyRaw.tipo_acuerdo,
      descuento_pct: normalizeNullableNumber(bodyRaw.descuento_pct),
      precio_neto_fijo: normalizeNullableNumber(bodyRaw.precio_neto_fijo),
      max_asesores_override: normalizeNullableNumber(bodyRaw.max_asesores_override),
      precio_extra_por_asesor_override: normalizeNullableNumber(
        bodyRaw.precio_extra_por_asesor_override
      ),
      modo_iva: (bodyRaw.modo_iva ?? "sumar_al_neto") as ModoIVA,
      iva_pct: normalizeNullableNumber(bodyRaw.iva_pct) ?? 21,
      fecha_inicio: bodyRaw.fecha_inicio,
      fecha_fin: normalizeNullableString(bodyRaw.fecha_fin),
      motivo: normalizeNullableString(bodyRaw.motivo),
      observaciones: normalizeNullableString(bodyRaw.observaciones),
    };

    const validationError = validateCreateBody(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { data: empresa, error: empresaErr } = await supabaseAdmin
      .from("empresas")
      .select("id")
      .eq("id", empresaId)
      .maybeSingle();

    if (empresaErr) {
      return NextResponse.json({ error: empresaErr.message }, { status: 400 });
    }
    if (!empresa) {
      return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
    }

    if (body.plan_id) {
      const { data: plan, error: planErr } = await supabaseAdmin
        .from("planes")
        .select("id")
        .eq("id", body.plan_id)
        .maybeSingle();

      if (planErr) {
        return NextResponse.json({ error: planErr.message }, { status: 400 });
      }
      if (!plan) {
        return NextResponse.json({ error: "plan_id no existe." }, { status: 404 });
      }
    }

    const { data: activoExistente, error: activoErr } = await supabaseAdmin
      .from("empresa_acuerdos_comerciales")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .limit(1)
      .maybeSingle();

    if (activoErr) {
      return NextResponse.json({ error: activoErr.message }, { status: 400 });
    }

    if (activoExistente?.id) {
      return NextResponse.json(
        {
          error:
            "La empresa ya tiene un acuerdo comercial activo. Desactívalo o edítalo antes de crear uno nuevo.",
        },
        { status: 409 }
      );
    }

    const insertPayload = {
      empresa_id: empresaId,
      plan_id: body.plan_id,
      activo: true,
      tipo_acuerdo: body.tipo_acuerdo,
      descuento_pct: body.descuento_pct,
      precio_neto_fijo: body.precio_neto_fijo,
      max_asesores_override: body.max_asesores_override,
      precio_extra_por_asesor_override: body.precio_extra_por_asesor_override,
      modo_iva: body.modo_iva ?? "sumar_al_neto",
      iva_pct: body.iva_pct ?? 21,
      fecha_inicio: body.fecha_inicio,
      fecha_fin: body.fecha_fin,
      motivo: body.motivo,
      observaciones: body.observaciones,
      created_by: auth.profileId,
      updated_by: auth.profileId,
    };

    const { data: created, error: createErr } = await supabaseAdmin
      .from("empresa_acuerdos_comerciales")
      .insert([insertPayload])
      .select("*")
      .single();

    if (createErr) {
      return NextResponse.json(
        { error: createErr.message },
        { status: createErr.code === "23505" ? 409 : 400 }
      );
    }

    let planSync:
      | {
          synced: boolean;
          reason: string;
          planRowId: string | null;
          fechaFinAplicada: string | null;
        }
      | null = null;

    if (body.plan_id) {
      try {
        planSync = await syncEmpresaPlanOperativoConAcuerdo({
          empresaId,
          planId: body.plan_id,
          fechaInicio: body.fecha_inicio,
          fechaFin: body.fecha_fin,
          maxAsesoresOverride: body.max_asesores_override,
        });
      } catch (syncErr: any) {
        await supabaseAdmin
          .from("empresa_acuerdos_comerciales")
          .delete()
          .eq("id", created.id);

        return NextResponse.json(
          {
            error:
              syncErr?.message ||
              "No se pudo sincronizar empresas_planes con el acuerdo comercial.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        acuerdo: created,
        plan_sync: planSync,
      },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado." },
      { status: 500 }
    );
  }
}
