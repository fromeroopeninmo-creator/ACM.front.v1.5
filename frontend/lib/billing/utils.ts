// #lib/billing/utils.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type Role =
  | "empresa"
  | "asesor"
  | "soporte"
  | "super_admin"
  | "super_admin_root"
  | string;

export type ActorCtx = {
  userId: string;
  role?: Role;
  empresaId?: string | null;
};

export type ModoIVA = "sumar_al_neto" | "incluido_en_precio" | "no_aplica";

export type TipoAcuerdoComercial =
  | "descuento_pct"
  | "precio_fijo"
  | "precio_fijo_con_cupo"
  | "descuento_con_cupo";

export type EmpresaAcuerdoComercialActivo = {
  id: string;
  empresa_id: string;
  plan_id: string | null;
  activo: boolean;
  tipo_acuerdo: TipoAcuerdoComercial;
  descuento_pct: number | null;
  precio_neto_fijo: number | null;
  max_asesores_override: number | null;
  precio_extra_por_asesor_override: number | null;
  modo_iva: ModoIVA;
  iva_pct: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  motivo: string | null;
  observaciones: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PlanBaseConfig = {
  id: string;
  nombre: string | null;
  precio: number;
  max_asesores: number | null;
  precio_extra_por_asesor: number;
  duracion_dias: number | null;
  tipo_plan: string | null;
  incluye_valuador: boolean | null;
  incluye_tracker: boolean | null;
  es_trial: boolean | null;
};

export type MontosConIVA = {
  precio_neto_final: number;
  iva_importe: number;
  precio_total_final: number;
};

export type EmpresaBillingConfig = {
  empresa_id: string;
  plan_id: string;
  plan_nombre: string | null;

  precio_base_neto: number;
  precio_neto_final: number;

  modo_iva: ModoIVA;
  iva_pct: number;
  iva_importe: number;
  precio_total_final: number;

  max_asesores_plan: number | null;
  max_asesores_final: number | null;

  precio_extra_por_asesor_plan: number;
  precio_extra_por_asesor_final: number;

  agreement_applied: boolean;
  agreement_id: string | null;
  agreement_tipo: TipoAcuerdoComercial | null;

  suscripcion_override_applied: boolean;
  suscripcion_precio_neto_override: number | null;

  pricing_source:
    | "plan"
    | "personalizado_formula"
    | "suscripcion_override"
    | "acuerdo_comercial_descuento"
    | "acuerdo_comercial_precio_fijo";
};

/** Redondeo a 2 decimales (half-up). */
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** yyyy-mm-dd en UTC */
export function todayUTCDate(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Lee user + profile (role, empresa_id). Lanza si no hay sesión. */
export async function assertAuthAndGetContext(
  supabase: SupabaseClient
): Promise<ActorCtx> {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user?.id) throw new Error("No autenticado");
  const userId = auth.user.id;

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role, empresa_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (pErr) throw new Error(`Error leyendo profile: ${pErr.message}`);

  return {
    userId,
    role: (profile?.role as Role) ?? undefined,
    empresaId: profile?.empresa_id ?? null,
  };
}

/**
 * Determina empresa objetivo:
 * - super_admin / super_admin_root / soporte pueden pasar empresaIdParam.
 * - empresa / asesor: usa empresa_id del profile si existe.
 * - Fallback: busca empresas.id por empresas.user_id = actor.userId.
 */
export async function getEmpresaIdForActor(params: {
  supabase: SupabaseClient;
  actor: ActorCtx;
  empresaIdParam?: string;
}): Promise<string | null> {
  const { supabase, actor, empresaIdParam } = params;

  const isAdminLike =
    actor.role === "super_admin_root" ||
    actor.role === "super_admin" ||
    actor.role === "soporte";

  if (actor.empresaId) return actor.empresaId;
  if (isAdminLike && empresaIdParam) return empresaIdParam;

  if (actor.userId) {
    const { data: emp, error } = await supabase
      .from("empresas")
      .select("id")
      .eq("user_id", actor.userId)
      .maybeSingle();

    if (error) {
      console.warn(
        "getEmpresaIdForActor: error buscando empresas por user_id:",
        error.message
      );
      return null;
    }

    if (emp?.id) return emp.id as string;
  }

  return null;
}

/** Helper interno para sumar días a un ISO date. */
function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Estado de suscripción/ciclo basado SOLO en empresas_planes + planes:
 * - Busca el registro activo en empresas_planes.
 * - Si no tiene fecha_fin, la calcula con planes.duracion_dias (o 30 días default).
 */
export async function getSuscripcionEstado(
  supabase: SupabaseClient,
  empresaId: string
) {
  const { data: ep, error: epErr } = await supabase
    .from("empresas_planes")
    .select("empresa_id, plan_id, fecha_inicio, fecha_fin")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .maybeSingle();

  if (epErr) {
    throw new Error(`Error leyendo empresas_planes: ${epErr.message}`);
  }

  if (!ep) return null;

  const empresa_id = (ep as any).empresa_id as string;
  const plan_actual_id = (ep as any).plan_id as string | null;
  const fecha_inicio = (ep as any).fecha_inicio as string;
  let fecha_fin = (ep as any).fecha_fin as string | null;

  if (!fecha_fin && plan_actual_id) {
    const { data: planRow, error: planErr } = await supabase
      .from("planes")
      .select("duracion_dias")
      .eq("id", plan_actual_id)
      .maybeSingle();

    if (planErr) {
      throw new Error(
        `Error leyendo plan en getSuscripcionEstado: ${planErr.message}`
      );
    }

    const dur =
      typeof planRow?.duracion_dias === "number" && planRow.duracion_dias > 0
        ? planRow.duracion_dias
        : 30;

    fecha_fin = addDaysISO(fecha_inicio, dur);
  }

  return {
    empresa_id,
    ciclo_inicio: fecha_inicio,
    ciclo_fin: fecha_fin ?? fecha_inicio,
    estado: "activa",
    moneda: "ARS",
    plan_actual_id,
    plan_actual_nombre: null,
    plan_proximo_id: null,
    plan_proximo_nombre: null,
    cambio_programado_para: null,
  };
}

/**
 * Trae la configuración base del plan.
 */
export async function getPlanBaseConfig(
  supabase: SupabaseClient,
  planId: string
): Promise<PlanBaseConfig | null> {
  const { data: plan, error } = await supabase
    .from("planes")
    .select(
      [
        "id",
        "nombre",
        "precio",
        "max_asesores",
        "precio_extra_por_asesor",
        "duracion_dias",
        "tipo_plan",
        "incluye_valuador",
        "incluye_tracker",
        "es_trial",
      ].join(", ")
    )
    .eq("id", planId)
    .maybeSingle();

  if (error) {
    throw new Error(`Error leyendo plan base: ${error.message}`);
  }

  if (!plan) return null;

  return {
    id: (plan as any).id as string,
    nombre: ((plan as any).nombre ?? null) as string | null,
    precio: Number((plan as any).precio ?? 0),
    max_asesores:
      (plan as any).max_asesores == null
        ? null
        : Number((plan as any).max_asesores),
    precio_extra_por_asesor: Number(
      (plan as any).precio_extra_por_asesor ?? 0
    ),
    duracion_dias:
      (plan as any).duracion_dias == null
        ? null
        : Number((plan as any).duracion_dias),
    tipo_plan: ((plan as any).tipo_plan ?? null) as string | null,
    incluye_valuador:
      (plan as any).incluye_valuador == null
        ? null
        : Boolean((plan as any).incluye_valuador),
    incluye_tracker:
      (plan as any).incluye_tracker == null
        ? null
        : Boolean((plan as any).incluye_tracker),
    es_trial:
      (plan as any).es_trial == null ? null : Boolean((plan as any).es_trial),
  };
}

/**
 * Trae el acuerdo comercial activo y vigente para la empresa.
 * Si el acuerdo tiene plan_id, solo aplica si coincide con el plan evaluado.
 */
export async function getEmpresaAcuerdoComercialActivo(
  supabase: SupabaseClient,
  empresaId: string,
  planId?: string | null
): Promise<EmpresaAcuerdoComercialActivo | null> {
  const hoy = todayUTCDate();

  const { data, error } = await supabase
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
    throw new Error(
      `Error leyendo acuerdo comercial activo: ${error.message}`
    );
  }

  if (!data) return null;

  const acuerdoPlanId = ((data as any).plan_id ?? null) as string | null;

  if (acuerdoPlanId && planId && acuerdoPlanId !== planId) {
    return null;
  }

  return {
    id: (data as any).id as string,
    empresa_id: (data as any).empresa_id as string,
    plan_id: acuerdoPlanId,
    activo: Boolean((data as any).activo),
    tipo_acuerdo: (data as any).tipo_acuerdo as TipoAcuerdoComercial,
    descuento_pct:
      (data as any).descuento_pct == null
        ? null
        : Number((data as any).descuento_pct),
    precio_neto_fijo:
      (data as any).precio_neto_fijo == null
        ? null
        : Number((data as any).precio_neto_fijo),
    max_asesores_override:
      (data as any).max_asesores_override == null
        ? null
        : Number((data as any).max_asesores_override),
    precio_extra_por_asesor_override:
      (data as any).precio_extra_por_asesor_override == null
        ? null
        : Number((data as any).precio_extra_por_asesor_override),
    modo_iva: ((data as any).modo_iva ??
      "sumar_al_neto") as EmpresaAcuerdoComercialActivo["modo_iva"],
    iva_pct: Number((data as any).iva_pct ?? 21),
    fecha_inicio: (data as any).fecha_inicio as string,
    fecha_fin: ((data as any).fecha_fin ?? null) as string | null,
    motivo: ((data as any).motivo ?? null) as string | null,
    observaciones: ((data as any).observaciones ?? null) as string | null,
    created_by: ((data as any).created_by ?? null) as string | null,
    updated_by: ((data as any).updated_by ?? null) as string | null,
    created_at: ((data as any).created_at ?? null) as string | null,
    updated_at: ((data as any).updated_at ?? null) as string | null,
  };
}

/**
 * Busca precio_neto_override en suscripciones para la empresa/plan.
 * Se usa como fallback, detrás del acuerdo comercial.
 */
export async function getSuscripcionPrecioNetoOverride(
  supabase: SupabaseClient,
  empresaId: string,
  planId?: string | null
): Promise<number | null> {
  const query = supabase
    .from("suscripciones")
    .select("precio_neto_override, plan_id, created_at")
    .eq("empresa_id", empresaId)
    .not("precio_neto_override", "is", null)
    .order("created_at", { ascending: false })
    .limit(25);

  const { data, error } = planId
    ? await query.eq("plan_id", planId)
    : await query;

  if (error) {
    console.warn(
      "getSuscripcionPrecioNetoOverride: error leyendo suscripciones:",
      error.message
    );
    return null;
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!row) return null;

  return row?.precio_neto_override == null
    ? null
    : Number((row as any).precio_neto_override);
}

/**
 * Lee overrides operativos del plan activo en empresas_planes.
 */
export async function getEmpresaPlanActivoOverrides(
  supabase: SupabaseClient,
  empresaId: string,
  planId?: string | null
): Promise<{
  max_asesores_override: number | null;
}> {
  let query = supabase
    .from("empresas_planes")
    .select("max_asesores_override, plan_id")
    .eq("empresa_id", empresaId)
    .eq("activo", true);

  if (planId) {
    query = query.eq("plan_id", planId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.warn(
      "getEmpresaPlanActivoOverrides: error leyendo empresas_planes:",
      error.message
    );
    return { max_asesores_override: null };
  }

  return {
    max_asesores_override:
      data?.max_asesores_override == null
        ? null
        : Number(data.max_asesores_override),
  };
}

/**
 * Resuelve el precio neto base del plan, manteniendo la lógica actual
 * del plan "Personalizado".
 */
export async function resolvePlanNetoBase(params: {
  supabase: SupabaseClient;
  planId: string;
  empresaId: string;
  maxAsesoresOverride?: number | null;
}): Promise<{
  precio_base_neto: number;
  pricing_source: "plan" | "personalizado_formula";
  plan: PlanBaseConfig;
}> {
  const { supabase, planId, empresaId, maxAsesoresOverride } = params;

  const plan = await getPlanBaseConfig(supabase, planId);
  if (!plan) {
    throw new Error("Plan no encontrado");
  }

  const base = Number(plan.precio ?? 0);
  const nombre = (plan.nombre ?? "").toLowerCase();

  if (nombre !== "personalizado") {
    return {
      precio_base_neto: round2(base),
      pricing_source: "plan",
      plan,
    };
  }

  let targetCount: number | null = null;

  if (
    typeof maxAsesoresOverride === "number" &&
    Number.isFinite(maxAsesoresOverride) &&
    maxAsesoresOverride > 0
  ) {
    targetCount = maxAsesoresOverride;
  } else {
    const epOverrides = await getEmpresaPlanActivoOverrides(
      supabase,
      empresaId,
      planId
    );
    if (epOverrides.max_asesores_override != null) {
      targetCount = epOverrides.max_asesores_override;
    }
  }

  if (!targetCount || targetCount <= 20) {
    return {
      precio_base_neto: round2(base),
      pricing_source: "personalizado_formula",
      plan,
    };
  }

  const { data: premiumPlan, error: premiumErr } = await supabase
    .from("planes")
    .select("precio")
    .eq("nombre", "Premium")
    .maybeSingle();

  if (premiumErr) {
    console.warn(
      "resolvePlanNetoBase: error leyendo plan Premium:",
      premiumErr.message
    );
  }

  const basePremium = premiumPlan
    ? Number((premiumPlan as any).precio ?? 0)
    : base;

  const unitExtra = Number(plan.precio_extra_por_asesor ?? 0);
  const extra = Math.max(0, targetCount - 20);
  const personalizadoPrecio = basePremium + extra * unitExtra;

  return {
    precio_base_neto: round2(personalizadoPrecio),
    pricing_source: "personalizado_formula",
    plan,
  };
}

/**
 * Calcula neto / IVA / total final.
 *
 * Nota:
 * - sumar_al_neto: precioNeto se interpreta como neto.
 * - no_aplica: precioNeto se interpreta como neto y no suma IVA.
 * - incluido_en_precio: precioNeto se interpreta como total pactado con IVA incluido.
 */
export function calcularMontosConIva(params: {
  precioNeto: number;
  modoIva?: ModoIVA | null;
  ivaPct?: number | null;
}): MontosConIVA {
  const precio = round2(Number(params.precioNeto ?? 0));
  const modo = (params.modoIva ?? "sumar_al_neto") as ModoIVA;
  const ivaPct = Number(params.ivaPct ?? 21);
  const tasa = ivaPct / 100;

  if (modo === "no_aplica") {
    return {
      precio_neto_final: round2(precio),
      iva_importe: 0,
      precio_total_final: round2(precio),
    };
  }

  if (modo === "incluido_en_precio") {
    if (tasa <= 0) {
      return {
        precio_neto_final: round2(precio),
        iva_importe: 0,
        precio_total_final: round2(precio),
      };
    }

    const neto = precio / (1 + tasa);
    const iva = precio - neto;

    return {
      precio_neto_final: round2(neto),
      iva_importe: round2(iva),
      precio_total_final: round2(precio),
    };
  }

  const iva = precio * tasa;
  const total = precio + iva;

  return {
    precio_neto_final: round2(precio),
    iva_importe: round2(iva),
    precio_total_final: round2(total),
  };
}

/**
 * Resuelve la configuración final de billing para una empresa y plan.
 */
export async function resolveEmpresaBillingConfig(params: {
  supabase: SupabaseClient;
  empresaId: string;
  planId?: string | null;
  maxAsesoresOverride?: number | null;
  forzarSinAcuerdo?: boolean;
}): Promise<EmpresaBillingConfig> {
  const {
    supabase,
    empresaId,
    planId,
    maxAsesoresOverride,
    forzarSinAcuerdo = false,
  } = params;

  let effectivePlanId = planId ?? null;

  if (!effectivePlanId) {
    const suscripcionEstado = await getSuscripcionEstado(supabase, empresaId);
    effectivePlanId = suscripcionEstado?.plan_actual_id ?? null;
  }

  if (!effectivePlanId) {
    throw new Error(
      "No se pudo resolver el plan para la empresa en resolveEmpresaBillingConfig"
    );
  }

  const epOverrides = await getEmpresaPlanActivoOverrides(
    supabase,
    empresaId,
    effectivePlanId
  );

  const planOverrideToUse =
    typeof maxAsesoresOverride === "number" &&
    Number.isFinite(maxAsesoresOverride) &&
    maxAsesoresOverride >= 0
      ? maxAsesoresOverride
      : epOverrides.max_asesores_override;

  const baseResolved = await resolvePlanNetoBase({
    supabase,
    planId: effectivePlanId,
    empresaId,
    maxAsesoresOverride: planOverrideToUse,
  });

  const plan = baseResolved.plan;

  const acuerdo = forzarSinAcuerdo
    ? null
    : await getEmpresaAcuerdoComercialActivo(supabase, empresaId, effectivePlanId);

  const suscripcionOverride = await getSuscripcionPrecioNetoOverride(
    supabase,
    empresaId,
    effectivePlanId
  );

  const maxAsesoresPlan =
    plan.max_asesores == null ? null : Number(plan.max_asesores);

  const maxAsesoresFinal =
    acuerdo?.max_asesores_override != null
      ? Number(acuerdo.max_asesores_override)
      : planOverrideToUse != null
      ? Number(planOverrideToUse)
      : maxAsesoresPlan;

  const precioExtraPorAsesorPlan = Number(plan.precio_extra_por_asesor ?? 0);

  const precioExtraPorAsesorFinal =
    acuerdo?.precio_extra_por_asesor_override != null
      ? Number(acuerdo.precio_extra_por_asesor_override)
      : precioExtraPorAsesorPlan;

  let precioNetoFinal = round2(baseResolved.precio_base_neto);
  let pricingSource: EmpresaBillingConfig["pricing_source"] =
    baseResolved.pricing_source;

  if (acuerdo) {
    if (
      acuerdo.tipo_acuerdo === "descuento_pct" ||
      acuerdo.tipo_acuerdo === "descuento_con_cupo"
    ) {
      const pct = Number(acuerdo.descuento_pct ?? 0);
      const descuento = precioNetoFinal * (pct / 100);
      precioNetoFinal = round2(Math.max(precioNetoFinal - descuento, 0));
      pricingSource = "acuerdo_comercial_descuento";
    } else if (
      acuerdo.tipo_acuerdo === "precio_fijo" ||
      acuerdo.tipo_acuerdo === "precio_fijo_con_cupo"
    ) {
      precioNetoFinal = round2(Number(acuerdo.precio_neto_fijo ?? 0));
      pricingSource = "acuerdo_comercial_precio_fijo";
    }
  } else if (suscripcionOverride != null) {
    precioNetoFinal = round2(Number(suscripcionOverride));
    pricingSource = "suscripcion_override";
  }

  const modoIva: ModoIVA = acuerdo?.modo_iva ?? "sumar_al_neto";
  const ivaPct = Number(acuerdo?.iva_pct ?? 21);

  const montos = calcularMontosConIva({
    precioNeto: precioNetoFinal,
    modoIva,
    ivaPct,
  });

  return {
    empresa_id: empresaId,
    plan_id: effectivePlanId,
    plan_nombre: plan.nombre ?? null,

    precio_base_neto: round2(baseResolved.precio_base_neto),
    precio_neto_final: montos.precio_neto_final,

    modo_iva: modoIva,
    iva_pct: ivaPct,
    iva_importe: montos.iva_importe,
    precio_total_final: montos.precio_total_final,

    max_asesores_plan: maxAsesoresPlan,
    max_asesores_final: maxAsesoresFinal,

    precio_extra_por_asesor_plan: round2(precioExtraPorAsesorPlan),
    precio_extra_por_asesor_final: round2(precioExtraPorAsesorFinal),

    agreement_applied: Boolean(acuerdo),
    agreement_id: acuerdo?.id ?? null,
    agreement_tipo: acuerdo?.tipo_acuerdo ?? null,

    suscripcion_override_applied: !acuerdo && suscripcionOverride != null,
    suscripcion_precio_neto_override:
      suscripcionOverride == null ? null : round2(suscripcionOverride),

    pricing_source: pricingSource,
  };
}

/**
 * Precio neto preferido (manejo de plan "Personalizado").
 * - Se mantiene por compatibilidad con código existente.
 */
export async function getPlanPrecioNetoPreferido(
  supabase: SupabaseClient,
  planId: string,
  empresaId: string,
  maxAsesoresOverride?: number
): Promise<number | null> {
  const resolved = await resolvePlanNetoBase({
    supabase,
    planId,
    empresaId,
    maxAsesoresOverride:
      typeof maxAsesoresOverride === "number"
        ? maxAsesoresOverride
        : undefined,
  });

  return resolved.precio_base_neto;
}

/** Cálculo de prorrateo (sin I/O). */
export function calcularDeltaProrrateo(params: {
  cicloInicioISO: string;
  cicloFinISO: string;
  precioActualNeto: number;
  precioNuevoNeto: number;
  alicuotaIVA: number;
}) {
  const inicio = new Date(params.cicloInicioISO).getTime();
  const fin = new Date(params.cicloFinISO).getTime();
  const ahora = Date.now();

  const msCiclo = Math.max(fin - inicio, 0);
  const msRest = Math.max(fin - ahora, 0);

  const diasCiclo = Math.max(Math.ceil(msCiclo / 86400000), 0);
  const diasRestantes = Math.max(Math.ceil(msRest / 86400000), 0);
  const factor = diasCiclo > 0 ? diasRestantes / diasCiclo : 0;

  const deltaBase = Math.max(
    params.precioNuevoNeto - params.precioActualNeto,
    0
  );
  const deltaNeto = deltaBase * factor;
  const iva = deltaNeto * params.alicuotaIVA;
  const total = deltaNeto + iva;

  return { diasCiclo, diasRestantes, factor, deltaNeto, iva, total };
}
