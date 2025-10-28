// frontend/lib/adminEmpresasApi.ts
// Helpers para acciones administrativas sobre Empresas (suspender / reactivar / eliminar lógico)

type FetchOpts = {
  headers?: Record<string, string>;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
};

function getBaseUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL;
  if (envUrl) return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  return "http://localhost:3000";
}

export async function suspendEmpresa(
  empresaId: string,
  motivo: string | null = null,
  opts: FetchOpts = {}
): Promise<{ ok: true }> {
  const base = getBaseUrl();
  const url = `${base}/api/admin/empresas/${encodeURIComponent(empresaId)}/suspend`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    body: JSON.stringify({ motivo }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`suspendEmpresa ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}

export async function unsuspendEmpresa(
  empresaId: string,
  opts: FetchOpts = {}
): Promise<{ ok: true }> {
  const base = getBaseUrl();
  const url = `${base}/api/admin/empresas/${encodeURIComponent(empresaId)}/unsuspend`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...(opts.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`unsuspendEmpresa ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}

export async function deleteEmpresa(
  empresaId: string,
  opts: FetchOpts = {}
): Promise<{ ok: true }> {
  const base = getBaseUrl();
  const url = `${base}/api/admin/empresas/${encodeURIComponent(empresaId)}/delete`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...(opts.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`deleteEmpresa ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}
