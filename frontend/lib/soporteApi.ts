// frontend/lib/soporteApi.ts
export type Paged<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type ListEmpresasParams = {
  page?: number;
  pageSize?: number;
  search?: string;       // razón social o CUIT
  estado?: "activo" | "suspendido" | "todos";
  provincia?: string;
};

export type EmpresaListItem = {
  id: string;
  razon_social: string;
  cuit: string;
  provincia?: string | null;
  planNombre?: string | null;
  maxAsesoresBase?: number | null;
  maxAsesoresOverride?: number | null;
  asesoresCount?: number | null;
  informesCount?: number | null;
  estadoPlan?: "activo" | "suspendido";
  fechaFin?: string | null; // ISO date
  ultimaActividadAt?: string | null; // ISO date
};

export type ActionResult = {
  ok: boolean;
  message?: string;
};

export type EmpresaDetalle = {
  empresa: {
    id: string;
    razon_social: string;
    cuit: string;
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

/** Utilities */
function buildQuery(params?: Record<string, any>) {
  const q = new URLSearchParams();
  if (!params) return "";
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "" || v === "todos") return;
    q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const msg = await safeError(res);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function safeError(res: Response) {
  try {
    const data = await res.json();
    return data?.error || data?.message || res.statusText;
  } catch {
    return res.statusText;
  }
}

/**
 * listEmpresas
 * - Cliente o SSR. En SSR podés pasar headers (e.g., Cookie).
 */
export async function listEmpresas(
  params?: ListEmpresasParams,
  init?: RequestInit
): Promise<Paged<EmpresaListItem>> {
  const qs = buildQuery(params);
  const res = await fetch(`/api/soporte/empresas${qs}`, {
    method: "GET",
    cache: "no-store",
    ...init,
  });
  return handleJson<Paged<EmpresaListItem>>(res);
}

/** getEmpresaDetalle */
export async function getEmpresaDetalle(
  empresaId: string,
  init?: RequestInit
): Promise<EmpresaDetalle> {
  const res = await fetch(`/api/soporte/empresas/${empresaId}`, {
    method: "GET",
    cache: "no-store",
    ...init,
  });
  return handleJson<EmpresaDetalle>(res);
}

/** postResetPassword */
export async function postResetPassword(
  payload: { email: string },
  init?: RequestInit
): Promise<ActionResult> {
  const res = await fetch(`/api/soporte/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    body: JSON.stringify(payload),
    cache: "no-store",
    ...init,
  });
  return handleJson<ActionResult>(res);
}

/** postTogglePlan */
export async function postTogglePlan(
  payload: { empresaId: string; activar: boolean },
  init?: RequestInit
): Promise<ActionResult> {
  const res = await fetch(`/api/soporte/plan-visual-toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    body: JSON.stringify(payload),
    cache: "no-store",
    ...init,
  });
  return handleJson<ActionResult>(res);
}
