// frontend/lib/adminCashflowApi.ts
// Cliente para endpoints de Cashflow (ADMIN). Seguro para usar en SERVER y CLIENT.
// Usa URL absoluta + passthrough de cookies (cuando lo necesites), igual que adminPlanesApi.

export type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

type FetchOpts = {
  headers?: Record<string, string>;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
};

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
  overwrite?: boolean;  // opcional
}
export interface SimularPeriodoResponse {
  inserted: number;
  skipped: number;
  overwritten: number;
  periodos: string[];
  detalles: Array<Record<string, any>>;
}

/** ==== Utils (mismo patrón que adminPlanesApi) ==== */
function getBaseUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL;

  if (envUrl) return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  return "http://localhost:3000";
}
function withQuery(url: string, params?: Record<string, any>) {
  if (!params) return url;
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    usp.set(k, String(v));
  });
  const qs = usp.toString();
  return qs ? `${url}?${qs}` : url;
}
async function handleJson<T>(res: Response): Promise<T> {
  const ct = res.headers.get("content-type");
  const isJson = ct && ct.includes("application/json");
  if (!res.ok) {
    const body = isJson ? await res.text().catch(() => "") : await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} ${body}`.trim());
  }
  return (isJson ? res.json() : ({} as any)) as T;
}

/** ==== API calls (URL absoluta + opts.headers para cookie) ==== */

// KPIs
export async function getCashflowKpis(
  params: { desde: string; hasta: string; empresaId?: string },
  opts: FetchOpts = {}
): Promise<CashflowKpisResponse> {
  const base = getBaseUrl();
  const url = withQuery(`${base}/api/admin/cashflow/kpis`, params);
  const res = await fetch(url, {
    method: "GET",
    headers: { ...(opts.headers || {}) },
    cache: opts.cache ?? "no-store",
    next: opts.next,
  });
  return handleJson<CashflowKpisResponse>(res);
}

// Movimientos
export async function getCashflowMovimientos(
  params: {
    desde: string; hasta: string; empresaId?: string;
    pasarela?: string; estado?: "pending" | "paid" | "failed" | "refunded";
    tipo?: "subscription" | "extra_asesor" | "ajuste";
    page?: number; pageSize?: number;
  },
  opts: FetchOpts = {}
): Promise<MovimientosResponse> {
  const base = getBaseUrl();
  const url = withQuery(`${base}/api/admin/cashflow/movimientos`, params);
  const res = await fetch(url, {
    method: "GET",
    headers: { ...(opts.headers || {}) },
    cache: opts.cache ?? "no-store",
    next: opts.next,
  });
  return handleJson<MovimientosResponse>(res);
}

// Suscripciones
export async function getCashflowSuscripciones(
  params: {
    desde: string; hasta: string; empresaId?: string;
    estado?: "activo" | "inactivo" | "todos";
    page?: number; pageSize?: number;
  },
  opts: FetchOpts = {}
): Promise<SuscripcionesResponse> {
  const base = getBaseUrl();
  const url = withQuery(`${base}/api/admin/cashflow/suscripciones`, params);
  const res = await fetch(url, {
    method: "GET",
    headers: { ...(opts.headers || {}) },
    cache: opts.cache ?? "no-store",
    next: opts.next,
  });
  return handleJson<SuscripcionesResponse>(res);
}

// Simular período (ledger)
export async function postCashflowSimularPeriodo(
  body: SimularPeriodoBody,
  opts: FetchOpts = {}
): Promise<SimularPeriodoResponse> {
  const base = getBaseUrl();
  const url = `${base}/api/admin/cashflow/simular-periodo`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    body: JSON.stringify(body),
    cache: "no-store",
    next: opts.next,
  });
  return handleJson<SimularPeriodoResponse>(res);
}
