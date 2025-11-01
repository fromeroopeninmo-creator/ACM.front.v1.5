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
 * - admin/root/soporte pueden pasar empresaIdParam explícito.
 * - empresa/asesor usa su propia empresa:
 *    1) profiles.empresa_id
 *    2) fallback: empresas.id donde empresas.user_id = actor.userId
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

  if (isAdmin && empresaIdParam) return empresaIdParam;

  // 1) Si el perfil ya trae empresa_id, usarlo
  if (actor.empresaId) return actor.empresaId;

  // 2) Fallback: dueño directo de la empresa (empresas.user_id = actor.userId)
  const { data: empByOwner, error: empErr } = await supabase
    .from("empresas")
    .select("id")
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (empErr) {
    // No lanzamos para no romper; devolvemos null y que el caller maneje 403.
    return null;
  }
  return empByOwner?.id ?? null;
}

/** Vista segura con SECURITY INVOKER: estado de suscripción/ciclo + planes actual/próximo. */
export async function getSuscripcionEstado(
  supabase: SupabaseClient,
  empresaId: string
) {
  const { data, error } = await supabase
    .from("v_suscripcion_estado")
    .select(
      "empresa_id, ciclo_inicio, ciclo_fin, estado, moneda, plan_actual_id, plan_actual_nombre, plan_proximo_id, plan_proximo_nombre, cambio_programado_para"
    )
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error)
    throw new Error(`Error leyendo v_suscripcion_estado: ${error.message}`);
  return data as
    | {
        empresa_id: string;
        ciclo_inicio: string;
        ciclo_fin: string;
        estado: string | null;
        moneda: string | null;
        plan_actual_id: string | null;
        plan_actual_nombre: string | null;
        plan_proximo_id: string | null;
        plan_proximo_nombre: string | null;
        cambio_programado_para: string | null;
      }
    | null;
}

/**
 * Precio neto preferido:
 * - Si el plan coincide con el plan ACTUAL de la empresa y existe override en empresas_planes → usarlo (precio_neto_override).
 * - Caso contrario → usar planes.precio (neto).
 * Nota: `planes.precio` es el nombre real en tu BD.
 */
export async function getPlanPrecioNetoPreferido(
  supabase: SupabaseClient,
  planId: string,
  empresaId: string
): Promise<number | null> {
  // Precio base del plan
  const { data: plan, error: planErr } = await supabase
    .from("planes")
    .select("id, precio")
    .eq("id", planId)
    .maybeSingle();
  if (planErr) throw new Error(`Error leyendo plan: ${planErr.message}`);
  if (!plan) return null;

  const base = Number((plan as any).precio ?? 0);

  // Override si empresas_planes coincide con ese plan actual
  const { data: ep, error: epErr } = await supabase
    .from("empresas_planes")
    .select("empresa_id, plan_id, precio_neto_override, activo")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .maybeSingle();
  if (epErr) throw new Error(`Error leyendo empresas_planes: ${epErr.message}`);

  if (
    ep &&
    ep.plan_id === planId &&
    (ep as any).precio_neto_override != null
  ) {
    return Number((ep as any).precio_neto_override);
  }
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
