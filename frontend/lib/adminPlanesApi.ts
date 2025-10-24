// Cliente para endpoints de planes (ADMIN). Seguro para usar en SERVER y CLIENT.
// Usa URL absoluta + passthrough de cookies (cuando lo necesites).

type FetchOpts = {
  headers?: Record<string, string>;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
};

export type PlanRow = {
  id: string;
  nombre: string;
  max_asesores: number;
  duracion_dias: number | null;
  precio: number | null; // neto (ARS)
  activo: boolean;
  // opcional en tu schema:
  precio_extra_por_asesor?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type Paged<T> = {
  page: number;
  pageSize: number;
  total: number;
  items: T[];
};

export type ListPlanesParams = {
  q?: string;                 // búsqueda por nombre
  activo?: "" | "true" | "false";
  page?: number;
  pageSize?: number;          // 10/20/50
};

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

// ------- API calls --------
export async function listPlanes(
  params: ListPlanesParams,
  opts: FetchOpts = {}
): Promise<Paged<PlanRow>> {
  const base = getBaseUrl();
  const url = withQuery(`${base}/api/admin/planes`, params);
  const res = await fetch(url, {
    method: "GET",
    headers: { ...(opts.headers || {}) },
    cache: opts.cache ?? "no-store",
    next: opts.next,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`listPlanes ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}

export async function createPlan(
  input: Omit<PlanRow, "id" | "created_at" | "updated_at">,
  opts: FetchOpts = {}
): Promise<{ ok: true }> {
  const base = getBaseUrl();
  const url = `${base}/api/admin/planes`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`createPlan ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}

export async function updatePlan(
  id: string,
  input: Partial<Omit<PlanRow, "id" | "created_at" | "updated_at">>,
  opts: FetchOpts = {}
): Promise<{ ok: true }> {
  const base = getBaseUrl();
  const url = `${base}/api/admin/planes/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`updatePlan ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}

export async function deletePlan(
  id: string,
  opts: FetchOpts = {}
): Promise<{ ok: true }> {
  const base = getBaseUrl();
  const url = `${base}/api/admin/planes/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { ...(opts.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`deletePlan ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}
