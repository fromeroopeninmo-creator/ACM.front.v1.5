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

type UpdateAcuerdoBody = {
  plan_id?: string | null;
  tipo_acuerdo?: TipoAcuerdoComercial;
  descuento_pct?: number | null;
  precio_neto_fijo?: number | null;
  max_asesores_override?: number | null;
  precio_extra_por_asesor_override?: number | null;
  modo_iva?: ModoIVA | null;
  iva_pct?: number | null;
  fecha_inicio?: string;
  fecha_fin?: string | null;
  motivo?: string | null;
  observaciones?: string | null;
  activo?: boolean;
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

  return {
    ok: true as const,
    userId: user.id,
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

function validateUpdatePayload(payload: Record<string, any>) {
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

  if (payload.tipo_acuerdo != null && !tipos.includes(payload.tipo_acuerdo)) {
    return "tipo_acuerdo inválido.";
  }

  if (payload.modo_iva != null && !modosIVA.includes(payload.modo_iva)) {
    return "modo_iva inválido.";
  }

  if (
    payload.descuento_pct != null &&
    (payload.descuento_pct < 0 || payload.descuento_pct > 100)
  ) {
    return "descuento_pct debe estar entre 0 y 100.";
  }

  if (payload.precio_neto_fijo != null && payload.precio_neto_fijo < 0) {
    return "precio_neto_fijo no puede ser negativo.";
  }

  if (payload.max_asesores_override != null && payload.max_asesores_override < 0) {
    return "max_asesores_override no puede ser negativo.";
  }

  if (
    payload.precio_extra_por_asesor_override != null &&
    payload.precio_extra_por_asesor_override < 0
  ) {
    return "precio_extra_por_asesor_override no puede ser negativo.";
  }

  if (payload.iva_pct != null && (payload.iva_pct < 0 || payload.iva_pct > 100)) {
    return "iva_pct debe estar entre 0 y 100.";
  }

  if (payload.fecha_inicio != null && !isValidISODateOnly(payload.fecha_inicio)) {
    return "fecha_inicio debe tener formato YYYY-MM-DD.";
  }

  if (payload.fecha_fin != null && payload.fecha_fin !== null && !isValidISODateOnly(payload.fecha_fin)) {
    return "fecha_fin debe tener formato YYYY-MM-DD.";
  }

  if (
    payload.fecha_inicio != null &&
    payload.fecha_fin != null &&
    payload.fecha_fin !== null &&
    payload.fecha_fin < payload.fecha_inicio
  ) {
    return "fecha_fin no puede ser menor que fecha_inicio.";
  }

  return null;
}

export async function PUT(
  req: Request,
  { params }: { params: { empresaId: string; acuerdoId: string } }
) {
  try {
    const auth = await assertAdmin();
    if (!auth.ok) return auth.response;

    const empresaId = params?.empresaId;
    const acuerdoId = params?.acuerdoId;

    if (!empresaId || !acuerdoId) {
      return NextResponse.json(
        { error: "Faltan empresaId o acuerdoId." },
        { status: 400 }
      );
    }

    const bodyRaw = (await req.json().catch(() => null)) as UpdateAcuerdoBody | null;
    if (!bodyRaw) {
      return NextResponse.json({ error: "Body inválido." }, { status: 400 });
    }

    const { data: actual, error: actualErr } = await supabaseAdmin
      .from("empresa_acuerdos_comerciales")
      .select("*")
      .eq("id", acuerdoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (actualErr) {
      return NextResponse.json({ error: actualErr.message }, { status: 400 });
    }
    if (!actual) {
      return NextResponse.json({ error: "Acuerdo no encontrado." }, { status: 404 });
    }

    const payload: Record<string, any> = {
      updated_by: auth.userId,
    };

    if ("plan_id" in bodyRaw) payload.plan_id = normalizeNullableString(bodyRaw.plan_id);
    if ("tipo_acuerdo" in bodyRaw) payload.tipo_acuerdo = bodyRaw.tipo_acuerdo;
    if ("descuento_pct" in bodyRaw) payload.descuento_pct = normalizeNullableNumber(bodyRaw.descuento_pct);
    if ("precio_neto_fijo" in bodyRaw) payload.precio_neto_fijo = normalizeNullableNumber(bodyRaw.precio_neto_fijo);
    if ("max_asesores_override" in bodyRaw) {
      payload.max_asesores_override = normalizeNullableNumber(bodyRaw.max_asesores_override);
    }
    if ("precio_extra_por_asesor_override" in bodyRaw) {
      payload.precio_extra_por_asesor_override = normalizeNullableNumber(
        bodyRaw.precio_extra_por_asesor_override
      );
    }
    if ("modo_iva" in bodyRaw) payload.modo_iva = bodyRaw.modo_iva;
    if ("iva_pct" in bodyRaw) payload.iva_pct = normalizeNullableNumber(bodyRaw.iva_pct);
    if ("fecha_inicio" in bodyRaw) payload.fecha_inicio = bodyRaw.fecha_inicio;
    if ("fecha_fin" in bodyRaw) payload.fecha_fin = normalizeNullableString(bodyRaw.fecha_fin);
    if ("motivo" in bodyRaw) payload.motivo = normalizeNullableString(bodyRaw.motivo);
    if ("observaciones" in bodyRaw) {
      payload.observaciones = normalizeNullableString(bodyRaw.observaciones);
    }
    if ("activo" in bodyRaw && typeof bodyRaw.activo === "boolean") {
      payload.activo = bodyRaw.activo;
    }

    const validationError = validateUpdatePayload(payload);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const mergedTipo = payload.tipo_acuerdo ?? actual.tipo_acuerdo;
    const mergedDescuento = payload.descuento_pct ?? actual.descuento_pct;
    const mergedPrecioFijo = payload.precio_neto_fijo ?? actual.precio_neto_fijo;
    const mergedMaxAsesores =
      payload.max_asesores_override ?? actual.max_asesores_override;

    if (mergedTipo === "descuento_pct" && mergedDescuento == null) {
      return NextResponse.json(
        { error: "descuento_pct es obligatorio para tipo_acuerdo = descuento_pct." },
        { status: 400 }
      );
    }

    if (mergedTipo === "precio_fijo" && mergedPrecioFijo == null) {
      return NextResponse.json(
        { error: "precio_neto_fijo es obligatorio para tipo_acuerdo = precio_fijo." },
        { status: 400 }
      );
    }

    if (
      mergedTipo === "precio_fijo_con_cupo" &&
      (mergedPrecioFijo == null || mergedMaxAsesores == null)
    ) {
      return NextResponse.json(
        {
          error:
            "precio_neto_fijo y max_asesores_override son obligatorios para tipo_acuerdo = precio_fijo_con_cupo.",
        },
        { status: 400 }
      );
    }

    if (
      mergedTipo === "descuento_con_cupo" &&
      (mergedDescuento == null || mergedMaxAsesores == null)
    ) {
      return NextResponse.json(
        {
          error:
            "descuento_pct y max_asesores_override son obligatorios para tipo_acuerdo = descuento_con_cupo.",
        },
        { status: 400 }
      );
    }

    const mergedFechaInicio = payload.fecha_inicio ?? actual.fecha_inicio;
    const mergedFechaFin =
      payload.fecha_fin !== undefined ? payload.fecha_fin : actual.fecha_fin;

    if (
      mergedFechaInicio &&
      mergedFechaFin &&
      String(mergedFechaFin) < String(mergedFechaInicio)
    ) {
      return NextResponse.json(
        { error: "fecha_fin no puede ser menor que fecha_inicio." },
        { status: 400 }
      );
    }

    if (payload.plan_id) {
      const { data: plan, error: planErr } = await supabaseAdmin
        .from("planes")
        .select("id")
        .eq("id", payload.plan_id)
        .maybeSingle();

      if (planErr) {
        return NextResponse.json({ error: planErr.message }, { status: 400 });
      }
      if (!plan) {
        return NextResponse.json({ error: "plan_id no existe." }, { status: 404 });
      }
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from("empresa_acuerdos_comerciales")
      .update(payload)
      .eq("id", acuerdoId)
      .eq("empresa_id", empresaId)
      .select("*")
      .single();

    if (updErr) {
      return NextResponse.json(
        { error: updErr.message },
        { status: updErr.code === "23505" ? 409 : 400 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        acuerdo: updated,
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
