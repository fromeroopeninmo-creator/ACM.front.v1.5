// frontend/lib/adminApi.ts
// Cliente para endpoints de Admin (SERVER + CLIENT safe)
// Usa URL absoluta para evitar "Failed to parse URL" en SSR/RSC

type FetchOpts = {
  headers?: Record<string, string>;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
};

// Tipado laxo/seguro para no romper si la API agrega/quita claves.
export type AdminKPIs = {
  empresas_activas?: number | null;
  asesores_activos?: number | null;
  informes_totales?: number | null;
  mrr?: number | null;
  ingresos_30d?: number | null;   // opcional, por si tu endpoint ya lo envía
  churn_30d?: number | null;       // opcional
  [key: string]: number | null | undefined; // tolerante a claves nuevas
};

function getBaseUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL;

  if (envUrl) {
    return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  }
  return "http://localhost:3000";
}

export async function getAdminKPIs(opts: FetchOpts = {}): Promise<AdminKPIs> {
  const base = getBaseUrl();
  const url = `${base}/api/admin/kpis`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...(opts.headers || {}),
    },
    cache: opts.cache ?? "no-store",
    next: opts.next,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`getAdminKPIs ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}

// ⚠️ Más adelante podemos sumar aquí planes, cashflow, ABM, etc.
// export async function listPlanes() { ... }
// export async function createPlan(input) { ... }
// export async function updatePlan(id, input) { ... }
// export async function deletePlan(id) { ... }
// export async function getCashflow(params) { ... }
