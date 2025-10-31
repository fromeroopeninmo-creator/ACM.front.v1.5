// #lib/billing/utils.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/** Redondeo a 2 decimales (half-up). */
export const round2 = (n: number) => Math.round(n * 100) / 100;

export type ActorCtx = {
  userId: string;
  role?: "super_admin_root" | "super_admin" | "soporte" | "empresa" | "asesor" | string;
  empresaId?: string | null;
};

/** Extrae user, role y empresa_id del contexto actual (RLS-friendly). */
export async function assertAuthAndGetContext(supabase: SupabaseClient): Promise<ActorCtx> {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) throw new Error("No autenticado");

  const userId = authData.user.id;

  // Buscar profile → role + empresa_id
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role, empresa_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (pErr) throw new Error(`Error leyendo profile: ${pErr.message}`);

  return {
    userId,
    role: (profile?.role as ActorCtx["role"]) ?? undefined,
    empresaId: profile?.empresa_id ?? null,
  };
}

/**
 * Determina el empresa_id “target”:
 * - Si actor es admin/root y se provee empresaIdParam → usar ese.
 * - Si actor es empresa/asesor → usar actor.empresaId.
 */
export async function getEmpresaIdForActor(params: {
  supabase: SupabaseClient;
  actor: ActorCtx;
  empresaIdParam?: string;
}): Promise<string | null> {
  const { actor, empresaIdParam } = params;

  const isAdmin =
    actor.role === "super_admin_root" || actor.role === "super_admin" || actor.role === "soporte";

  if (isAdmin && empresaIdParam) return empresaIdParam;
  if (actor.empresaId) return actor.empresaId;

  return null;
}

/** Lee estado de suscripción desde la vista segura (SECURITY INVOKER). */
export async function getSuscripcionEstado(supabase: SupabaseClient, empresaId: string) {
  const { data, error } = await supabase
    .from("v_suscripcion_estado")
    .select(
      "empresa_id, ciclo_inicio, ciclo_fin, estado, moneda, plan_actual_id, plan_actual_nombre, plan_proximo_id, plan_proximo_nombre, cambio_programado_para"
    )
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error) throw new Error(`Error leyendo suscripción: ${error.message}`);
  return data as
    | {
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
      }
    | null;
}

/**
 * Precio neto preferido para un plan:
 * - Si el plan es el ACTUAL de la empresa y `empresas_planes.precio_neto_override` existe → usar override.
 * - En caso contrario, usar `planes.precio_neto_mensual`.
 *
 * Nota: Para el "nuevo plan", usualmente NO hay override en empresas_planes (porque guarda el actual),
 * por lo que se usa el precio de `planes`.
 */
export async function getPlanPrecioNetoPreferido(
  supabase: SupabaseClient,
  planId: string,
  empresaId: string
): Promise<number | null> {
  // 1) Precio base del plan
  const { data: plan, error: planErr } = await supabase
    .from("planes")
    .select("id, precio_neto_mensual, nombre")
    .eq("id", planId)
    .maybeSingle();

  if (planErr) throw new Error(`Error leyendo plan: ${planErr.message}`);
  if (!plan) return null;
  const base = Number(plan.precio_neto_mensual ?? 0);

  // 2) ¿Override en empresas_planes para la empresa?
  const { data: ep, error: epErr } = await supabase
    .from("empresas_planes")
    .select("empresa_id, plan_id, precio_neto_override")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (epErr) throw new Error(`Error leyendo empresas_planes: ${epErr.message}`);

  if (ep && ep.plan_id === planId && ep.precio_neto_override != null) {
    return Number(ep.precio_neto_override);
  }

  return base;
}

/** Cálculo puro de prorrateo (upgrade). */
export function calcularDeltaProrrateo(params: {
  cicloInicioISO: string;
  cicloFinISO: string;
  precioActualNeto: number;
  precioNuevoNeto: number;
  alicuotaIVA: number; // p.ej. 0.21
}) {
  const inicio = new Date(params.cicloInicioISO).getTime();
  const fin = new Date(params.cicloFinISO).getTime();
  const ahora = Date.now();

  const msCiclo = Math.max(fin - inicio, 0);
  const msRest = Math.max(fin - ahora, 0);

  const diasCiclo = Math.max(Math.ceil(msCiclo / (1000 * 60 * 60 * 24)), 0);
  const diasRestantes = Math.max(Math.ceil(msRest / (1000 * 60 * 60 * 24)), 0);

  const factor = diasCiclo > 0 ? diasRestantes / diasCiclo : 0;

  const deltaBase = Math.max(params.precioNuevoNeto - params.precioActualNeto, 0);
  const deltaNeto = deltaBase * factor;

  const iva = deltaNeto * params.alicuotaIVA;
  const total = deltaNeto + iva;

  return { diasCiclo, diasRestantes, factor, deltaNeto, iva, total };
}
