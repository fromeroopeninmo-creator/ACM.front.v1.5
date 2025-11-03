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

/** Determina empresa objetivo: admin/root pueden pasar empresaIdParam; empresa/asesor usa propia. */
export async function getEmpresaIdForActor(params: {
  supabase: SupabaseClient;
  actor: ActorCtx;
  empresaIdParam?: string;
}): Promise<string | null> {
  const { actor, empresaIdParam } = params;
  const isAdmin =
    actor.role === "super_admin_root" ||
    actor.role === "super_admin" ||
    actor.role === "soporte";

  if (isAdmin && empresaIdParam) return empresaIdParam;
  if (actor.empresaId) return actor.empresaId;
  return null;
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
 *
 * - Si el plan es "Personalizado":
 *   precio_efectivo = precio(Premium) + (cupo - 20) * precio_extra_por_asesor
 *   donde `cupo` = empresas_planes.max_asesores_override (o max_asesores del plan como fallback).
 *
 * - Para el resto:
 *   - Si el plan coincide con el plan ACTUAL de la empresa y existe override en empresas_planes → usarlo.
 *   - Caso contrario → usar planes.precio (neto).
 *
 * Nota: `planes.precio` es el nombre real en tu BD.
 */
export async function getPlanPrecioNetoPreferido(
  supabase: SupabaseClient,
  planId: string,
  empresaId: string
): Promise<number | null> {
  // 1) Leer el plan (incluimos campos necesarios para "Personalizado")
  const { data: plan, error: planErr } = await supabase
    .from("planes")
    .select("id, nombre, precio, precio_extra_por_asesor, max_asesores")
    .eq("id", planId)
    .maybeSingle();
  if (planErr) throw new Error(`Error leyendo plan: ${planErr.message}`);
  if (!plan) return null;

  const nombreLower = (plan.nombre || "").toLowerCase();
  const base = Number((plan as any).precio ?? 0);

  // 2) Lógica especial para plan "Personalizado"
  if (nombreLower === "personalizado") {
    // cupo tomado del override de la empresa (si tiene), o del propio plan, o mínimo 21
    const { data: ep, error: epErr } = await supabase
      .from("empresas_planes")
      .select("max_asesores_override")
      .eq("empresa_id", empresaId)
      .eq("plan_id", planId)
      .eq("activo", true)
      .maybeSingle();
    if (epErr)
      throw new Error(`Error leyendo empresas_planes: ${epErr.message}`);

    const cupo =
      (ep?.max_asesores_override as number | null) ??
      (plan.max_asesores as number | null) ??
      21;

    const extraUnit = Number(plan.precio_extra_por_asesor ?? 0);

    // precio base del plan Premium (asumimos que existe)
    const { data: premium, error: premErr } = await supabase
      .from("planes")
      .select("precio")
      .eq("nombre", "Premium")
      .maybeSingle();
    if (premErr)
      throw new Error(`Error leyendo plan Premium: ${premErr.message}`);

    const premiumBase = Number((premium as any)?.precio ?? 0);

    const extraCount = Math.max(0, cupo - 20); // a partir de 21 asesores
    const efectivo = premiumBase + extraCount * extraUnit;

    return efectivo;
  }

  // 3) Resto de planes: respetar override de empresas_planes (si existe)
  const { data: ep, error: epErr } = await supabase
    .from("empresas_planes")
    .select("empresa_id, plan_id, precio_neto_override")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .maybeSingle();
  if (epErr) throw new Error(`Error leyendo empresas_planes: ${epErr.message}`);

  if (ep && ep.plan_id === planId && (ep as any).precio_neto_override != null) {
    return Number((ep as any).precio_neto_override);
  }

  // Sin override: usar precio base del plan
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
