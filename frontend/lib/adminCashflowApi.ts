// frontend/lib/adminCashflowApi.ts
// Cliente para endpoints de Cashflow (Admin). Usa rutas relativas a la misma app.
// Admite un segundo parámetro opcional `init?: RequestInit` para pasar headers (cookie) en SSR.

export type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

/** ==== Tipos de respuestas ==== */
export interface CashflowKpisResponse {
  rango: { desde: string; hasta: string };
  mrr_neto: number;
  ingresos_neto_total: number;
  ingresos_con_iva: number;
  arpu_neto: number;
  empresas_activas: number;
  churn_empresas: number;
  upgrades: number;
  downgrades: number;
}

export interface MovimientoItem {
  id: string | null;
  fecha: string; // ISO
  empresa_id: string;
  empresa_nombre: string;
  tipo: "subscription" | "extra_asesor" | "ajuste";
  concepto: string | null;
  pasarela: string; // "simulada" | "mercadopago" | "stripe" | etc.
  moneda: string;   // "ARS"
  monto_neto: number;
  iva_21: number;
  total_con_iva: number;
  estado: "pending" | "paid" | "failed" | "refunded";
  referencia_pasarela: string | null;
  metadata: Record<string, any>;
}
export interface MovimientosResponse {
  items: MovimientoItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface SuscripcionItem {
  empresa_id: string;
  empresa_nombre: string;
  plan_id: string;
  plan_nombre: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activo: boolean;
  max_asesores_plan: number;
  max_asesores_override: number | null;
  asesores_utilizados: number;
  cupo_excedido: number;
}
export interface SuscripcionesResponse {
  items: SuscripcionItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface SimularPeriodoBody {
  desde: string;        // YYYY-MM-DD
  hasta: string;        // YYYY-MM-DD
  empresaId?: string;   // opcional
  overwrite?: boolean;  // opcional: borra simulados previos del rango/periodo
}
export interface SimularPeriodoResponse {
  inserted: number;
  skipped: number;
  overwritten: number;
  periodos: string[];
  detalles: Array<Record<string, any>>;
}

/** ==== Utils ==== */
async function handleJson<T>(res: Response): Promise<T> {
  const ct = res.headers.get("content-type");
  const isJson = ct && ct.includes("application/json");
  if (!res.ok) {
    if (isJson) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || `HTTP ${res.status}`);
    }
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (isJson) return (await res.json()) as T;
  return {} as T;
}

function q(params: Record<string, any>) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    usp.set(k, String(v));
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

/** ==== API (con init opcional para SSR) ==== */

/** KPIs: GET /api/admin/cashflow/kpis?desde&hasta&empresaId */
export async function getCashflowKpis(
  params: { desde: string; hasta: string; empresaId?: string; signal?: AbortSignal },
  init?: RequestInit
) {
  const url = `/api/admin/cashflow/kpis${q({
    desde: params.desde,
    hasta: params.hasta,
    empresaId: params.empresaId,
  })}`;
  const res = await fetch(url, {
    method: "GET",
    signal: params.signal,
    ...(init || {}),
  });
  return handleJson<CashflowKpisResponse>(res);
}

/** Movimientos: GET /api/admin/cashflow/movimientos?... */
export async function getCashflowMovimientos(
  params: {
    desde: string; hasta: string; empresaId?: string;
    pasarela?: string; estado?: "pending" | "paid" | "failed" | "refunded";
    tipo?: "subscription" | "extra_asesor" | "ajuste";
    page?: number; pageSize?: number; signal?: AbortSignal;
  },
  init?: RequestInit
) {
  const url = `/api/admin/cashflow/movimientos${q({
    desde: params.desde, hasta: params.hasta,
    empresaId: params.empresaId, pasarela: params.pasarela,
    estado: params.estado, tipo: params.tipo,
    page: params.page, pageSize: params.pageSize,
  })}`;
  const res = await fetch(url, {
    method: "GET",
    signal: params.signal,
    ...(init || {}),
  });
  return handleJson<MovimientosResponse>(res);
}

/** Suscripciones: GET /api/admin/cashflow/suscripciones?... */
export async function getCashflowSuscripciones(
  params: {
    desde: string; hasta: string; empresaId?: string;
    estado?: "activo" | "inactivo" | "todos";
    page?: number; pageSize?: number; signal?: AbortSignal;
  },
  init?: RequestInit
) {
  const url = `/api/admin/cashflow/suscripciones${q({
    desde: params.desde, hasta: params.hasta,
    empresaId: params.empresaId, estado: params.estado,
    page: params.page, pageSize: params.pageSize,
  })}`;
  const res = await fetch(url, {
    method: "GET",
    signal: params.signal,
    ...(init || {}),
  });
  return handleJson<SuscripcionesResponse>(res);
}

/** Simular período: POST /api/admin/cashflow/simular-periodo */
export async function postCashflowSimularPeriodo(
  body: SimularPeriodoBody,
  init?: RequestInit
) {
  const res = await fetch(`/api/admin/cashflow/simular-periodo`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    body: JSON.stringify(body),
    ...(init || {}),
  });
  return handleJson<SimularPeriodoResponse>(res);
}
