// frontend/lib/soporteApi.ts
// Cliente para endpoints de soporte (SERVER + CLIENT safe)
// Usa URL absoluta para evitar "Failed to parse URL" en SSR/RSC

type FetchOpts = {
  headers?: Record<string, string>;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
};

export type Paged<T> = {
  page: number;
  pageSize: number;
  total: number;
  items: T[];
};

// 🔎 TIPADO: incluir ambas variantes (snake y camel) para compatibilidad con tu UI
export type EmpresaListItem = {
  id: string;

  // Nombre/identidad
  razon_social: string;
  plan_nombre?: string | null;     // snake
  planNombre?: string | null;      // camel

  // Localización / fiscales
  cuit?: string | null;
  ciudad?: string | null;
  provincia?: string | null;

  // Cupos (plan / override)
  max_asesores?: number | null;            // snake (plan base)
  maxAsesoresBase?: number | null;         // camel (UI usa este)
  max_asesores_override?: number | null;   // snake
  maxAsesoresOverride?: number | null;     // camel (UI usa este)

  // Métricas
  asesores_activos?: number | null;  // snake
  asesoresCount?: number | null;     // camel (UI usa este)
  informes_30d?: number | null;      // snake
  informes30d?: number | null;       // camel (UI usa este)

  // Auditoría
  created_at?: string | null;  // snake
  createdAt?: string | null;   // camel
};

export type EmpresaDetalle = {
  empresa: {
    id: string;
    razon_social: string;
    cuit?: string | null;
    condicion_fiscal?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    localidad?: string | null;
    provincia?: string | null;
    logo_url?: string | null;
    color?: string | null;
    plan?: {
      id: string;
      nombre: string;
      max_asesores: number;
      duracion_dias?: number | null;
      precio?: number | null;
    } | null;
    override?: {
      max_asesores_override?: number | null;
      fecha_inicio?: string | null;
      fecha_fin?: string | null;
      activo?: boolean | null;
    } | null;
  };
  metrics: {
    asesores_count: number;
    informes_30d: number;
    ultima_actividad_at?: string | null;
  };
  asesores: Array<{
    id: string;
    nombre: string;
    apellido?: string | null;
    email: string;
    activo: boolean;
    fecha_creacion?: string | null;
  }>;
  informes: Array<{
    id: string;
    titulo?: string | null;
    estado: string;
    fecha_creacion: string;
  }>;
  acciones_soporte: Array<{
    soporte?: string | null;
    descripcion: string;
    timestamp: string;
  }>;
};

// --------- Tipo exportado que espera EmpresasTable ----------
export type ListEmpresasParams = {
  page: number;
  pageSize: number;
  estado?: "todos" | "activos" | "inactivos";
  /** Búsqueda libre (alias histórico) */
  q?: string;
  /** Búsqueda libre (lo que manda EmpresasTable) */
  search?: string;
  /** Filtro por provincia (lo que manda EmpresasTable) */
  provincia?: string;
};

// ---------- helpers ----------
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

function withQuery(url: string, params?: Record<string, any>) {
  if (!params) return url;
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    usp.set(k, String(v));
  });
  const qs = usp.toString();
  return qs ? `${url}?${qs}` : url;
}

// ---------- API calls ----------
export async function listEmpresas(
  params: ListEmpresasParams,
  opts: FetchOpts = {}
): Promise<Paged<EmpresaListItem>> {
  const base = getBaseUrl();
  const url = withQuery(`${base}/api/soporte/empresas`, params);
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
    throw new Error(`listEmpresas ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}

export async function getEmpresaDetalle(
  empresaId: string,
  opts: FetchOpts = {}
) {
  const base = getBaseUrl();
  const url = `${base}/api/soporte/empresas/${encodeURIComponent(empresaId)}`;
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
    throw new Error(`getEmpresaDetalle ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}

export async function postResetPassword(
  email: string,
  opts: FetchOpts = {}
): Promise<{ ok: true }> {
  const base = getBaseUrl();
  const url = `${base}/api/soporte/reset-password`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.headers || {}),
    },
    body: JSON.stringify({ email }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`postResetPassword ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}

export async function postTogglePlan(
  empresaId: string,
  action: "activar" | "suspender",
  opts: FetchOpts = {}
): Promise<{ ok: true }> {
  const base = getBaseUrl();
  const url = `${base}/api/soporte/plan-visual-toggle`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.headers || {}),
    },
    body: JSON.stringify({ empresaId, action }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`postTogglePlan ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}
