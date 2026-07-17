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
  nombre_comercial: string | null;
  precio: number;
  max_asesores: number | null;
  precio_extra_por_asesor: number;
  duracion_dias: number | null;
  tipo_plan: string | null;
  tier_plan: string | null;
  incluye_valuador: boolean | null;
  incluye_tracker: boolean | null;
  es_trial: boolean | null;
  es_desarrollo: boolean | null;
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
  plan_duracion_dias: number | null;

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
  agreement_plan_id: string | null;
  agreement_fecha_inicio: string | null;
  agreement_fecha_fin: string | null;

  suscripcion_override_applied: boolean;
  suscripcion_precio_neto_override: number | null;

  ciclo_inicio: string | null;
  ciclo_fin: string | null;
  plan_es_trial: boolean | null;

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

/**
 * Lee user + profile (role, empresa_id). Lanza si no hay sesión.
 *
 * Compatibilidad histórica:
 * - perfiles nuevos pueden vincularse por profiles.user_id = auth.users.id
 * - perfiles históricos usan profiles.id = auth.users.id
 */
export async function assertAuthAndGetContext(
  supabase: SupabaseClient
): Promise<ActorCtx> {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user?.id) throw new Error("No autenticado");
  const userId = auth.user.id;

  type ProfileLookupRow = {
    role: Role | null;
    empresa_id: string | null;
  };

  let profile: ProfileLookupRow | null = null;

  const { data: profileByUserId, error: byUserIdError } = await supabase
    .from("profiles")
    .select("role, empresa_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!byUserIdError && profileByUserId) {
    profile = {
      role: (profileByUserId.role as Role | null) ?? null,
      empresa_id: profileByUserId.empresa_id ?? null,
    };
  }

  if (!profile) {
    const { data: profileById, error: byIdError } = await supabase
      .from("profiles")
      .select("role, empresa_id")
      .eq("id", userId)
      .maybeSingle();

    if (byIdError) {
      const firstError = byUserIdError?.message
        ? `; búsqueda por user_id: ${byUserIdError.message}`
        : "";
      throw new Error(`Error leyendo profile: ${byIdError.message}${firstError}`);
    }

    profile = profileById
      ? {
          role: (profileById.role as Role | null) ?? null,
          empresa_id: profileById.empresa_id ?? null,
        }
      : null;
  }

  const metadataRole =
    (auth.user.user_metadata?.role as Role | undefined) ??
    (auth.user.app_metadata?.role as Role | undefined);

  return {
    userId,
    role: (profile?.role as Role | undefined) ?? metadataRole,
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
      .or(`user_id.eq.${actor.userId},id_usuario.eq.${actor.userId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn(
        "getEmpresaIdForActor: error buscando empresas por user_id/id_usuario:",
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
 * Lee el plan activo de la empresa desde empresas_planes.
 * Esta es la fuente operativa del plan efectivo.
 */
export async function getEmpresaPlanActivo(
  supabase: SupabaseClient,
  empresaId: string
): Promise<{
  empresa_id: string;
  plan_id: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  max_asesores_override: number | null;
} | null> {
  const { data, error } = await supabase
    .from("empresas_planes")
    .select(
      "empresa_id, plan_id, fecha_inicio, fecha_fin, max_asesores_override"
    )
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Error leyendo empresas_planes: ${error.message}`);
  }

  if (!data) return null;

  return {
    empresa_id: (data as any).empresa_id as string,
    plan_id: ((data as any).plan_id ?? null) as string | null,
    fecha_inicio: ((data as any).fecha_inicio ?? null) as string | null,
    fecha_fin: ((data as any).fecha_fin ?? null) as string | null,
    max_asesores_override:
      (data as any).max_asesores_override == null
        ? null
        : Number((data as any).max_asesores_override),
  };
}

/**
 * Estado de suscripción/ciclo basado SOLO en empresas_planes + planes:
 * - Busca el registro activo en empresas_planes.
 * - Si no tiene fecha_fin, la calcula con planes.duracion_dias (o 30 días default).
 */
export type SuscripcionCicloEstado = {
  id: string;
  empresa_id: string;
  ciclo_inicio: string;
  ciclo_fin: string;
  estado: string;
  moneda: string;
  plan_actual_id: string | null;
  plan_actual_nombre: string | null;
  plan_proximo_id: string | null;
  plan_proximo_nombre: string | null;
  cambio_programado_para: string | null;
  metadata: Record<string, unknown>;
  precio_neto_override: number | null;
  externo_customer_id: string | null;
  externo_subscription_id: string | null;
};

function normalizeCycleDate(row: any, primary: "inicio" | "fin"): string | null {
  const preferred = primary === "inicio" ? row?.ciclo_inicio : row?.ciclo_fin;
  const fallback = primary === "inicio" ? row?.inicio : row?.fin;
  const value = preferred ?? fallback ?? null;
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Devuelve el ciclo mensual que realmente cubre el acceso en este momento.
 * La fuente de verdad es public.suscripciones, nunca empresas_planes.
 *
 * Reglas:
 * - Ignora checkouts pendientes, cancelados y ciclos históricos.
 * - Prioriza un ciclo activo cuyo inicio <= ahora < fin.
 * - Si existe un ciclo futuro ya pagado, lo expone como próximo plan/cambio.
 * - inicio/fin se mantienen como fallback de compatibilidad histórica.
 */
export async function getSuscripcionEstado(
  supabase: SupabaseClient,
  empresaId: string
): Promise<SuscripcionCicloEstado | null> {
  const nowIso = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from("suscripciones")
    .select(
      [
        "id",
        "empresa_id",
        "plan_id",
        "plan_actual_id",
        "plan_proximo_id",
        "cambio_programado_para",
        "estado",
        "inicio",
        "fin",
        "ciclo_inicio",
        "ciclo_fin",
        "moneda",
        "precio_neto_override",
        "metadata",
        "externo_customer_id",
        "externo_subscription_id",
        "created_at",
      ].join(", ")
    )
    .eq("empresa_id", empresaId)
    .eq("estado", "activa")
    .order("ciclo_inicio", { ascending: false, nullsFirst: false })
    .order("inicio", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Error leyendo ciclo real de suscripciones: ${error.message}`);
  }

  const normalized = (Array.isArray(rows) ? rows : [])
    .map((row: any) => ({
      row,
      inicio: normalizeCycleDate(row, "inicio"),
      fin: normalizeCycleDate(row, "fin"),
    }))
    .filter((item) => item.inicio && item.fin);

  const current = normalized
    .filter((item) => item.inicio! <= nowIso && item.fin! > nowIso)
    .sort((a, b) => b.fin!.localeCompare(a.fin!))[0];

  if (!current) return null;

  const future = normalized
    .filter((item) => item.inicio! >= current.fin! && item.inicio! > nowIso)
    .sort((a, b) => a.inicio!.localeCompare(b.inicio!))[0];

  const currentPlanId =
    (current.row.plan_actual_id ?? current.row.plan_id ?? null) as string | null;
  const futurePlanId = future
    ? ((future.row.plan_actual_id ?? future.row.plan_id ?? null) as string | null)
    : ((current.row.plan_proximo_id ?? null) as string | null);

  const planIds = [currentPlanId, futurePlanId].filter(Boolean) as string[];
  let planNames = new Map<string, string>();

  if (planIds.length > 0) {
    const { data: plans, error: plansError } = await supabase
      .from("planes")
      .select("id, nombre, nombre_comercial")
      .in("id", Array.from(new Set(planIds)));

    if (plansError) {
      console.warn("getSuscripcionEstado: no se pudieron resolver nombres:", plansError.message);
    } else {
      planNames = new Map(
        (plans ?? []).map((p: any) => [
          String(p.id),
          String(p.nombre_comercial ?? p.nombre ?? ""),
        ])
      );
    }
  }

  return {
    id: String(current.row.id),
    empresa_id: String(current.row.empresa_id),
    ciclo_inicio: current.inicio!,
    ciclo_fin: current.fin!,
    estado: String(current.row.estado ?? "activa"),
    moneda: String(current.row.moneda ?? "ARS"),
    plan_actual_id: currentPlanId,
    plan_actual_nombre: currentPlanId ? planNames.get(currentPlanId) ?? null : null,
    plan_proximo_id: futurePlanId,
    plan_proximo_nombre: futurePlanId ? planNames.get(futurePlanId) ?? null : null,
    cambio_programado_para:
      future?.inicio ??
      (current.row.cambio_programado_para
        ? new Date(String(current.row.cambio_programado_para)).toISOString()
        : null),
    metadata:
      current.row.metadata && typeof current.row.metadata === "object"
        ? (current.row.metadata as Record<string, unknown>)
        : {},
    precio_neto_override:
      current.row.precio_neto_override == null
        ? null
        : Number(current.row.precio_neto_override),
    externo_customer_id: current.row.externo_customer_id ?? null,
    externo_subscription_id: current.row.externo_subscription_id ?? null,
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
        "nombre_comercial",
        "precio",
        "max_asesores",
        "precio_extra_por_asesor",
        "duracion_dias",
        "tipo_plan",
        "tier_plan",
        "incluye_valuador",
        "incluye_tracker",
        "es_trial",
        "es_desarrollo",
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
    nombre_comercial: ((plan as any).nombre_comercial ?? null) as string | null,
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
    tier_plan: ((plan as any).tier_plan ?? null) as string | null,
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
    es_desarrollo:
      (plan as any).es_desarrollo == null
        ? null
        : Boolean((plan as any).es_desarrollo),
  };
}

/**
 * Devuelve todos los acuerdos activos y vigentes de una empresa.
 * Luego se elige el mejor match en memoria:
 * - primero acuerdo específico del plan
 * - luego acuerdo genérico (plan_id null)
 */
async function getEmpresaAcuerdosComercialesActivos(
  supabase: SupabaseClient,
  empresaId: string
): Promise<EmpresaAcuerdoComercialActivo[]> {
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
    .order("fecha_inicio", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    throw new Error(
      `Error leyendo acuerdos comerciales activos: ${error.message}`
    );
  }

  if (!Array.isArray(data) || data.length === 0) return [];

  return data.map((row: any) => ({
    id: row.id as string,
    empresa_id: row.empresa_id as string,
    plan_id: (row.plan_id ?? null) as string | null,
    activo: Boolean(row.activo),
    tipo_acuerdo: row.tipo_acuerdo as TipoAcuerdoComercial,
    descuento_pct:
      row.descuento_pct == null ? null : Number(row.descuento_pct),
    precio_neto_fijo:
      row.precio_neto_fijo == null ? null : Number(row.precio_neto_fijo),
    max_asesores_override:
      row.max_asesores_override == null
        ? null
        : Number(row.max_asesores_override),
    precio_extra_por_asesor_override:
      row.precio_extra_por_asesor_override == null
        ? null
        : Number(row.precio_extra_por_asesor_override),
    modo_iva: (row.modo_iva ?? "sumar_al_neto") as ModoIVA,
    iva_pct: Number(row.iva_pct ?? 21),
    fecha_inicio: row.fecha_inicio as string,
    fecha_fin: (row.fecha_fin ?? null) as string | null,
    motivo: (row.motivo ?? null) as string | null,
    observaciones: (row.observaciones ?? null) as string | null,
    created_by: (row.created_by ?? null) as string | null,
    updated_by: (row.updated_by ?? null) as string | null,
    created_at: (row.created_at ?? null) as string | null,
    updated_at: (row.updated_at ?? null) as string | null,
  }));
}

/**
 * Trae el acuerdo comercial activo y vigente para la empresa.
 * Reglas:
 * - si hay planId, prioriza acuerdo específico de ese plan
 * - si no encuentra, usa acuerdo genérico (plan_id null)
 * - si no hay match, retorna null
 */
export async function getEmpresaAcuerdoComercialActivo(
  supabase: SupabaseClient,
  empresaId: string,
  planId?: string | null
): Promise<EmpresaAcuerdoComercialActivo | null> {
  const acuerdos = await getEmpresaAcuerdosComercialesActivos(
    supabase,
    empresaId
  );

  if (acuerdos.length === 0) return null;

  if (planId) {
    const acuerdoEspecifico = acuerdos.find(
      (a) => a.plan_id != null && a.plan_id === planId
    );
    if (acuerdoEspecifico) return acuerdoEspecifico;

    const acuerdoGenerico = acuerdos.find((a) => a.plan_id == null);
    if (acuerdoGenerico) return acuerdoGenerico;

    return null;
  }

  const acuerdoGenerico = acuerdos.find((a) => a.plan_id == null);
  if (acuerdoGenerico) return acuerdoGenerico;

  return acuerdos[0] ?? null;
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
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("suscripciones")
    .select(
      "precio_neto_override, plan_id, plan_actual_id, ciclo_inicio, ciclo_fin, inicio, fin, created_at"
    )
    .eq("empresa_id", empresaId)
    .eq("estado", "activa")
    .not("precio_neto_override", "is", null)
    .order("ciclo_inicio", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(25);

  if (planId) {
    query = query.or(`plan_id.eq.${planId},plan_actual_id.eq.${planId}`);
  }

  const { data, error } = await query;

  if (error) {
    console.warn(
      "getSuscripcionPrecioNetoOverride: error leyendo suscripciones:",
      error.message
    );
    return null;
  }

  const row = (data ?? []).find((item: any) => {
    const inicio = normalizeCycleDate(item, "inicio");
    const fin = normalizeCycleDate(item, "fin");
    return !!inicio && !!fin && inicio <= nowIso && fin > nowIso;
  });

  return row?.precio_neto_override == null
    ? null
    : Number(row.precio_neto_override);
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
    .eq("activo", true)
    .order("fecha_inicio", { ascending: false })
    .limit(1);

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
 * Resuelve el precio neto base del plan usando la nueva estructura:
 * - tier_plan define si es personalizado
 * - personalizado = premium del mismo tipo_plan + extras
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

  const tipoPlan = (plan.tipo_plan ?? "").toLowerCase();
  const tierPlan = (plan.tier_plan ?? "").toLowerCase();
  const base = Number(plan.precio ?? 0);

  if (tierPlan !== "personalizado") {
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

  // Si no hay override usable, devolvemos el precio mínimo configurable
  // guardado en la fila del personalizado (21 asesores).
  if (!targetCount || targetCount <= 20) {
    return {
      precio_base_neto: round2(base),
      pricing_source: "personalizado_formula",
      plan,
    };
  }

  let basePremium = base;

  if (tipoPlan) {
    const { data: premiumPlan, error: premiumErr } = await supabase
      .from("planes")
      .select("precio")
      .eq("tipo_plan", tipoPlan)
      .eq("tier_plan", "premium")
      .limit(1)
      .maybeSingle();

    if (premiumErr) {
      console.warn(
        "resolvePlanNetoBase: error leyendo base Premium específica:",
        premiumErr.message
      );
    }

    if (premiumPlan) {
      basePremium = Number((premiumPlan as any).precio ?? base);
    }
  }

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
 *
 * Reglas:
 * - Plan operativo efectivo: si no se pasa planId, se toma desde empresas_planes.
 * - Pricing efectivo: acuerdo comercial vigente > suscripción override > precio base del plan.
 * - Si no hay acuerdo, el flujo normal del plan sigue intacto.
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

  const planActivo = await getEmpresaPlanActivo(supabase, empresaId);
  const suscripcionEstado = await getSuscripcionEstado(supabase, empresaId);

  let effectivePlanId = planId ?? null;

  if (!effectivePlanId) {
    effectivePlanId =
      planActivo?.plan_id ?? suscripcionEstado?.plan_actual_id ?? null;
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
    : await getEmpresaAcuerdoComercialActivo(
        supabase,
        empresaId,
        effectivePlanId
      );

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
    plan_nombre: plan.nombre_comercial ?? plan.nombre ?? null,
    plan_duracion_dias:
      plan.duracion_dias == null ? null : Number(plan.duracion_dias),

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
    agreement_plan_id: acuerdo?.plan_id ?? null,
    agreement_fecha_inicio: acuerdo?.fecha_inicio ?? null,
    agreement_fecha_fin: acuerdo?.fecha_fin ?? null,

    suscripcion_override_applied: !acuerdo && suscripcionOverride != null,
    suscripcion_precio_neto_override:
      suscripcionOverride == null ? null : round2(suscripcionOverride),

    ciclo_inicio: suscripcionEstado?.ciclo_inicio ?? null,
    ciclo_fin: suscripcionEstado?.ciclo_fin ?? null,
    plan_es_trial: plan.es_trial ?? null,

    pricing_source: pricingSource,
  };
}

/**
 * Precio neto preferido (manejo de plan personalizado).
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

export type BillingAccessContext = {
  actor: ActorCtx;
  empresaId: string | null;
  permitido: boolean;
  bypassAdmin: boolean;
  origen:
    | "admin"
    | "ciclo_pagado"
    | "trial"
    | "desarrollo"
    | "suspension_manual"
    | "sin_cobertura";
  motivo: string | null;
};

function isAutomaticBillingSuspensionReason(reason?: string | null): boolean {
  if (!reason) return false;
  const normalized = reason.toLowerCase().trim();
  return [
    "falta de pago",
    "pago no acreditado",
    "suscripción vencida",
    "suscripcion vencida",
    "plan vencido",
    "trial vencido",
    "acuerdo comercial pendiente de pago",
    "sin ciclo vigente",
    "sin plan activo",
  ].some((token) => normalized.includes(token));
}

/**
 * Guard central de acceso comercial para APIs protegidas.
 *
 * Importante:
 * - Es 100% de solo lectura.
 * - No activa/desactiva empresas_planes.
 * - No modifica empresas.suspendida ni sus fechas/motivos.
 * - Admin/soporte omiten el bloqueo comercial, pero cada endpoint debe conservar
 *   sus verificaciones de autorización sobre el recurso solicitado.
 */
export async function resolveBillingAccessForActor(params: {
  authSupabase: SupabaseClient;
  dataSupabase?: SupabaseClient;
  empresaIdParam?: string;
  allowAdminBypass?: boolean;
}): Promise<BillingAccessContext> {
  const {
    authSupabase,
    dataSupabase = authSupabase,
    empresaIdParam,
    allowAdminBypass = true,
  } = params;

  const actor = await assertAuthAndGetContext(authSupabase);
  const role = String(actor.role ?? "").toLowerCase();
  const isAdminLike =
    role === "super_admin_root" ||
    role === "super_admin" ||
    role === "soporte";

  if (isAdminLike && allowAdminBypass && !empresaIdParam) {
    return {
      actor,
      empresaId: null,
      permitido: true,
      bypassAdmin: true,
      origen: "admin",
      motivo: null,
    };
  }

  const empresaId = await getEmpresaIdForActor({
    supabase: dataSupabase,
    actor,
    empresaIdParam,
  });

  if (!empresaId) {
    return {
      actor,
      empresaId: null,
      permitido: false,
      bypassAdmin: false,
      origen: "sin_cobertura",
      motivo: "No se pudo resolver la empresa del usuario.",
    };
  }

  if (isAdminLike && allowAdminBypass) {
    return {
      actor,
      empresaId,
      permitido: true,
      bypassAdmin: true,
      origen: "admin",
      motivo: null,
    };
  }

  const { data: empresa, error: empresaError } = await dataSupabase
    .from("empresas")
    .select("id, suspendida, suspension_motivo")
    .eq("id", empresaId)
    .maybeSingle();

  if (empresaError) {
    throw new Error(`Error leyendo empresa para validar acceso: ${empresaError.message}`);
  }

  if (!empresa) {
    return {
      actor,
      empresaId,
      permitido: false,
      bypassAdmin: false,
      origen: "sin_cobertura",
      motivo: "Empresa no encontrada.",
    };
  }

  const manualSuspension =
    empresa.suspendida === true &&
    !isAutomaticBillingSuspensionReason(empresa.suspension_motivo);

  if (manualSuspension) {
    return {
      actor,
      empresaId,
      permitido: false,
      bypassAdmin: false,
      origen: "suspension_manual",
      motivo: empresa.suspension_motivo ?? "Cuenta suspendida manualmente.",
    };
  }

  const currentCycle = await getSuscripcionEstado(dataSupabase, empresaId);
  if (currentCycle) {
    return {
      actor,
      empresaId,
      permitido: true,
      bypassAdmin: false,
      origen: "ciclo_pagado",
      motivo: null,
    };
  }

  const today = todayUTCDate();
  const { data: operationalPlan, error: operationalError } = await dataSupabase
    .from("empresas_planes")
    .select("plan_id, fecha_inicio, fecha_fin, planes(es_trial, es_desarrollo)")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (operationalError) {
    throw new Error(
      `Error leyendo plan operativo para validar acceso: ${operationalError.message}`
    );
  }

  const planRelation = Array.isArray((operationalPlan as any)?.planes)
    ? (operationalPlan as any).planes[0]
    : (operationalPlan as any)?.planes;
  const isTrial = planRelation?.es_trial === true;
  const isDevelopment = planRelation?.es_desarrollo === true;
  const startsAt = operationalPlan?.fecha_inicio
    ? String(operationalPlan.fecha_inicio)
    : null;
  const endsAt = operationalPlan?.fecha_fin
    ? String(operationalPlan.fecha_fin)
    : null;
  const operationalCoverage =
    !!operationalPlan &&
    (isTrial || isDevelopment) &&
    (!startsAt || startsAt <= today) &&
    (!endsAt || endsAt >= today);

  if (operationalCoverage) {
    return {
      actor,
      empresaId,
      permitido: true,
      bypassAdmin: false,
      origen: isTrial ? "trial" : "desarrollo",
      motivo: null,
    };
  }

  return {
    actor,
    empresaId,
    permitido: false,
    bypassAdmin: false,
    origen: "sin_cobertura",
    motivo: isTrial
      ? "Trial vencido. Debe seleccionar un plan para continuar."
      : operationalPlan?.plan_id
      ? "Cuenta suspendida por falta de pago: sin ciclo vigente."
      : "Sin plan activo. Debe seleccionar un plan para continuar.",
  };
}

export async function assertBillingAccessForActor(params: {
  authSupabase: SupabaseClient;
  dataSupabase?: SupabaseClient;
  empresaIdParam?: string;
  allowAdminBypass?: boolean;
}): Promise<BillingAccessContext> {
  const access = await resolveBillingAccessForActor(params);

  if (!access.permitido) {
    const error = new Error(access.motivo ?? "Acceso suspendido.") as Error & {
      status?: number;
      code?: string;
    };
    error.status = access.empresaId ? 403 : 400;
    error.code = "BILLING_ACCESS_DENIED";
    throw error;
  }

  return access;
}
