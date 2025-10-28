// frontend/lib/adminUsersApi.ts

export type AdminRow = {
  id: string;
  email: string;
  role: "super_admin" | "super_admin_root";
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type Paged<T> = {
  page: number;
  pageSize: number;
  total: number;
  items: T[];
};

export type ListAdminsParams = {
  q?: string;
  // ⬇️ Agrego "soporte" para que el page.tsx compile cuando filtra ese rol
  role?: "super_admin" | "super_admin_root" | "soporte" | "todos";
  page?: number;
  pageSize?: number;
  sortBy?: "nombre" | "email" | "role" | "created_at";
  sortDir?: "asc" | "desc";
};

type FetchOpts = {
  headers?: Record<string, string>;
  cache?: RequestCache;
  // evitar dependencia de tipos internos de Next
  next?: any;
};

/* =============== Helpers únicos (sin duplicados) =============== */
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

/* ======================= API calls ======================= */

export async function listAdmins(
  params: ListAdminsParams,
  opts: FetchOpts = {}
): Promise<Paged<AdminRow>> {
  const base = getBaseUrl();
  const url = withQuery(`${base}/api/admin/admins`, params);
  const res = await fetch(url, {
    method: "GET",
    headers: { ...(opts.headers || {}) },
    cache: opts.cache ?? "no-store",
    next: opts.next,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`listAdmins ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}

export async function createAdmin(
  input: {
    email: string;
    nombre?: string | null;
    apellido?: string | null;
    role: "super_admin" | "super_admin_root";
    // opcional: crear y devolver link de invitación
    sendInvite?: boolean;
    // opcional: crear con password directo
    password?: string;
  },
  opts: FetchOpts = {}
): Promise<{ ok: true; user_id: string; invite_link?: string | null }> {
  const base = getBaseUrl();
  const url = `${base}/api/admin/admins`;

  // 🔁 Mapear a lo que espera el backend:
  // - password (si tiene ≥6)
  // - generate_recovery_link (si sendInvite === true y no mandamos password)
  const payload: Record<string, any> = {
    email: input.email,
    role: input.role,
  };
  if (input.nombre !== undefined) payload.nombre = input.nombre;
  if (input.apellido !== undefined) payload.apellido = input.apellido;

  const pwd = (input.password || "").trim();
  if (pwd.length >= 6) {
    payload.password = pwd;
  } else if (input.sendInvite === true) {
    payload.generate_recovery_link = true;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`createAdmin ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}

export async function updateAdmin(
  id: string,
  input: Partial<Pick<AdminRow, "email" | "nombre" | "apellido" | "role">>,
  opts: FetchOpts = {}
): Promise<{ ok: true }> {
  const base = getBaseUrl();
  const url = `${base}/api/admin/admins/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`updateAdmin ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}

/* 👇 Wrapper para compatibilidad con la UI existente */
export async function updateAdminIdentity(
  id: string,
  input: Partial<Pick<AdminRow, "email" | "nombre" | "apellido" | "role">>,
  opts: FetchOpts = {}
): Promise<{ ok: true }> {
  return updateAdmin(id, input, opts);
}

export async function deleteAdmin(
  id: string,
  opts: FetchOpts = {}
): Promise<{ ok: true }> {
  const base = getBaseUrl();
  const url = `${base}/api/admin/admins/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { ...(opts.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`deleteAdmin ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}

export async function resetAdminPassword(
  id: string,
  input: {} | { newPassword: string }, // {} => genera link de recuperación; { newPassword } => set directo (solo root)
  opts: FetchOpts = {}
): Promise<
  | { ok: true; mode: "recovery_link"; email: string; action_link: string | null; message: string }
  | { ok: true; mode: "direct"; message: string }
> {
  const base = getBaseUrl();
  const url = `${base}/api/admin/admins/${encodeURIComponent(id)}/reset`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`resetAdminPassword ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}
