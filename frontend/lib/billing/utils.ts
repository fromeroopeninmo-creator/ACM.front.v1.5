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

/** Redondeo a 2 decimales (half-up). */
export const round2 = (n: number) => Math.round(n * 100) / 100;

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

  const isAdmin =
    actor.role === "super_admin_root" ||
    actor.role === "super_admin" ||
    actor.role === "soporte";

  // 1) Admin / soporte puede pasar empresaIdParam explícito
  if (isAdmin && empresaIdParam) return empresaIdParam;

  // 2) Si el profile ya tiene empresa_id, usarlo
  if (actor.empresaId) return actor.empresaId;

  // 3) Fallback: empresas.user_id = actor.userId
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

  // 4) No se pudo resolver
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
  // 1) Plan activo
  const { data: ep, error: epErr } = await supabase
    .from("empresas_planes")
    .select("empresa_id, plan_id, fecha_inicio, fecha_fin")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .maybeSingle();

  if (epErr) {
    throw new Error(`Error leyendo empresas_planes: ${epErr.message}`);
  }

  if (!ep) {
    // No hay plan activo registrado
    return null;
  }

  const empresa_id = (ep as any).empresa_id as string;
  const plan_actual_id = (ep as any).plan_id as string | null;
  const fecha_inicio = (ep as any).fecha_inicio as string;
  let fecha_fin = (ep as any).fecha_fin as string | null;

  // 2) Si no tenemos fecha_fin, calculamos desde planes.duracion_dias (o 30 días por defecto)
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

  // 3) Devolvemos estructura compatible con lo que usan preview/change-plan
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
 * Precio neto preferido:
 * - Ahora usamos SOLO planes.precio (neto).
 * - No intentamos overrides porque no existen columnas de precio en empresas_planes.
 */
export async function getPlanPrecioNetoPreferido(
  supabase: SupabaseClient,
  planId: string,
  empresaId: string // empresaId queda por compatibilidad, por si a futuro querés usar overrides
): Promise<number | null> {
  const { data: plan, error: planErr } = await supabase
    .from("planes")
    .select("id, precio")
    .eq("id", planId)
    .maybeSingle();

  if (planErr) throw new Error(`Error leyendo plan: ${planErr.message}`);
  if (!plan) return null;

  const base = Number((plan as any).precio ?? 0);
  return base;
}

/** Cálculo puro del prorrateo para upgrade (sin I/O). */
export function calcularDeltaProrrateo(params: {
  cicloInicioISO: string;
  cicloFinISO: string;
  precioActualNeto: number;
  precioNuevoNeto: number;
  alicuotaIVA: number; // ej. 0.21
}) {
  const inicio = new Date(params.cicloInicioISO).getTime();
  const fin = new Date(params.cicloFinISO).getTime();
  const ahora = Date.now();

  const msCiclo = Math.max(fin - inicio, 0);
  const msRest = Math.max(fin - ahora, 0);

  const diasCiclo = Math.max(Math.ceil(msCiclo / 86400000), 0);
  const diasRestantes = Math.max(Math.ceil(msRest / 86400000), 0);
  const factor = diasCiclo > 0 ? diasRestantes / diasCiclo : 0;

  const deltaBase = Math.max(params.precioNuevoNeto - params.precioActualNeto, 0);
  const deltaNeto = deltaBase * factor;
  const iva = deltaNeto * params.alicuotaIVA;
  const total = deltaNeto + iva;

  return { diasCiclo, diasRestantes, factor, deltaNeto, iva, total };
}
