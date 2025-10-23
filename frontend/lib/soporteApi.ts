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
): Promise<EmpresaDetalle> {
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

  // 🔁 Mapeo del contrato actual del backend → contrato esperado por la UI
  // Backend actual devuelve:
  // {
  //   empresa: { id, nombre, cuit, logoUrl, color, condicion_fiscal, telefono, direccion, localidad, provincia },
  //   plan: { nombre, maxAsesores, override, activo, fechaInicio, fechaFin },
  //   kpis: { asesoresTotales, informesTotales },
  //   ultimasAccionesSoporte: [{ id, soporteId, empresaId, descripcion, timestamp }]
  // }
  const raw = await res.json();

  const empresaPlan =
    raw?.plan
      ? {
          id: undefined as unknown as string, // no lo expone el backend; mantenemos shape
          nombre: raw.plan.nombre ?? null,
          max_asesores: raw.plan.maxAsesores ?? null,
          duracion_dias: null,
          precio: null,
        }
      : null;

  const empresaOverride =
    raw?.plan
      ? {
          max_asesores_override: raw.plan.override ?? null,
          fecha_inicio: raw.plan.fechaInicio ?? null,
          fecha_fin: raw.plan.fechaFin ?? null,
          activo: raw.plan.activo ?? null,
        }
      : null;

  const mapped: EmpresaDetalle = {
    empresa: {
      id: raw?.empresa?.id,
      razon_social: raw?.empresa?.nombre ?? null,
      cuit: raw?.empresa?.cuit ?? null,
      // ✅ Ajuste: completar campos que ahora expone el endpoint
      condicion_fiscal: raw?.empresa?.condicion_fiscal ?? null,
      telefono: raw?.empresa?.telefono ?? null,
      direccion: raw?.empresa?.direccion ?? null,
      localidad: raw?.empresa?.localidad ?? null,
      provincia: raw?.empresa?.provincia ?? null,
      logo_url: raw?.empresa?.logoUrl ?? null,
      color: raw?.empresa?.color ?? null,
      plan: empresaPlan,
      override: empresaOverride,
    },
    metrics: {
      asesores_count: raw?.kpis?.asesoresTotales ?? 0,
      informes_30d: raw?.kpis?.informesTotales ?? 0,
      ultima_actividad_at: null,
    },
    asesores: [], // aún no expuesto por el endpoint; la UI lo tolera vacío
    informes: [], // aún no expuesto por el endpoint; la UI lo tolera vacío
    acciones_soporte:
      (raw?.ultimasAccionesSoporte || []).map((a: any) => ({
        soporte: a.soporteId ? String(a.soporteId) : null,
        descripcion: a.descripcion,
        timestamp: a.timestamp,
      })) ?? [],
  };

  return mapped;
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
