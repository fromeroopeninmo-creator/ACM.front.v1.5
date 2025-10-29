// frontend/lib/adminSoporteApi.ts
// Cliente Admin Soporte (server/client-safe) con URL absoluta en SSR
// ⚠ Importante: no dependemos de tipos/objetos de Next (p.ej. NextFetchRequestConfig) para evitar
// arrastrar módulos server-only a componentes cliente. Este archivo es 100% isomórfico.

// ================================================================
// Tipos
// ================================================================
export type SoporteItem = {
  id: number;
  nombre: string | null;
  email: string;
  activo: boolean | null;
  created_at: string | null;
};

export type SoporteListResponse = {
  items: SoporteItem[];
};

export type SoporteUpsertInput = {
  email: string;
  nombre?: string;
  apellido?: string;
  // opcional: permitir alta directa con contraseña
  password?: string;
};

export type SoporteToggleInput = {
  id?: number;
  email?: string;
  activo: boolean;
};

export type FetchOpts = {
  headers?: Record<string, string>;
  cache?: RequestCache;
  // usamos any para no acoplar a Next (puede pasarse {revalidate:...} si estás en Server Components)
  next?: any;
};

// ================================================================
// Helpers
// ================================================================

/**
 * Devuelve la base URL absoluta (sirve en SSR y CSR).
 * Usa NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_VERCEL_URL / VERCEL_URL y fallback a localhost.
 */
function getBaseUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL;

  if (envUrl) return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  return "http://localhost:3000";
}

/**
 * Serializa parámetros de consulta omitiendo vacíos.
 */
function withQuery(url: string, params?: Record<string, unknown>): string {
  if (!params) return url;
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * Wrapper de fetch con manejo de errores consistente.
 */
async function jsonFetch<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    // Intentamos devolver el cuerpo textual para facilitar debugging
    const body = await res.text().catch(() => "");
    const msg = `${res.status} ${res.statusText} ${body}`.trim();
    throw new Error(msg);
  }
  // Puede devolver JSON o vacío
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Si no es JSON válido, lo devolvemos como texto bajo una clave estándar
    return { raw: text } as unknown as T;
  }
}

// ================================================================
// API: Soporte (Admin)
// Endpoints disponibles en tu repo:
//   - GET  /api/admin/soporte            → lista de agentes
//   - POST /api/admin/soporte            → upsert (alta/edición básica)
//   - POST /api/admin/soporte/toggle     → activar / desactivar
// ================================================================

/**
 * Lista agentes de soporte.
 * Actualmente el endpoint no recibe filtros; dejamos la firma preparada.
 */
export async function listSoporte(
  opts: FetchOpts = {}
): Promise<SoporteListResponse> {
  const base = getBaseUrl();
  const url = `${base}/api/admin/soporte`;
  return jsonFetch<SoporteListResponse>(url, {
    method: "GET",
    headers: { ...(opts.headers || {}) },
    cache: opts.cache ?? "no-store",
    // @ts-ignore - compat opcional con Next (no importamos tipos)
    next: opts.next,
  });
}

/**
 * Alta/Upsert de agente de soporte (idempotente por email).
 * Si se provee `password`, el API backend intentará crear el usuario en Auth con esa contraseña.
 */
export async function upsertSoporte(
  payload: SoporteUpsertInput,
  opts: FetchOpts = {}
): Promise<{ ok: true }> {
  const base = getBaseUrl();
  const url = `${base}/api/admin/soporte`;
  return jsonFetch<{ ok: true }>(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.headers || {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    // @ts-ignore
    next: opts.next,
  });
}

/**
 * Activa/Desactiva un agente de soporte por id o por email.
 */
export async function toggleSoporte(
  payload: SoporteToggleInput,
  opts: FetchOpts = {}
): Promise<{ ok: true }> {
  const base = getBaseUrl();
  const url = `${base}/api/admin/soporte/toggle`;
  return jsonFetch<{ ok: true }>(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.headers || {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    // @ts-ignore
    next: opts.next,
  });
}

// ================================================================
// Utilidades opcionales (no cambian la lógica, sólo ayudan en UI)
// ================================================================

/**
 * Formatea fecha ISO (usado en vistas cliente).
 */
export function fmtDateISO(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

/**
 * Normaliza email en minúsculas y trim.
 */
export function normEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

/**
 * Devuelve contadores útiles para cabeceras (total, activos, inactivos).
 */
export function resumenSoporte(items: SoporteItem[]) {
  const total = items.length;
  const activos = items.filter((i) => !!i.activo).length;
  const inactivos = total - activos;
  return { total, activos, inactivos };
}

/**
 * Filtro in-memory (nombre/email + estado) para clientes React.
 */
export function filtrarSoporte(
  items: SoporteItem[],
  q: string,
  estado: "" | "activos" | "inactivos"
): SoporteItem[] {
  const text = (q || "").trim().toLowerCase();
  return items.filter((i) => {
    const passText =
      !text ||
      (i.nombre || "").toLowerCase().includes(text) ||
      i.email.toLowerCase().includes(text);
    const passEstado =
      estado === ""
        ? true
        : estado === "activos"
        ? !!i.activo
        : !i.activo;
    return passText && passEstado;
  });
}
