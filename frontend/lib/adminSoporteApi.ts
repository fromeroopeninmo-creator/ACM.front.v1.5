// frontend/lib/adminSoporteApi.ts
// Cliente Admin Soporte (server/client-safe) con URL absoluta en SSR

type FetchOpts = {
  headers?: Record<string, string>;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
};

export type SoporteItem = {
  id: number;
  nombre: string | null;
  email: string;
  activo: boolean | null;
  created_at: string | null;
};

function getBaseUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL;

  if (envUrl) return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  return "http://localhost:3000";
}

export async function listSoporte(
  opts: FetchOpts = {}
): Promise<{ items: SoporteItem[] }> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/admin/soporte`, {
    method: "GET",
    headers: { ...(opts.headers || {}) },
    cache: opts.cache ?? "no-store",
    next: opts.next,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`listSoporte ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}

export async function upsertSoporte(
  payload: { email: string; nombre?: string; apellido?: string },
  opts: FetchOpts = {}
): Promise<{ ok: true }> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/admin/soporte`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`upsertSoporte ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}

export async function toggleSoporte(
  payload: { id?: number; email?: string; activo: boolean },
  opts: FetchOpts = {}
): Promise<{ ok: true }> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/admin/soporte/toggle`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`toggleSoporte ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}
