// frontend/app/dashboard/admin/admins/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import AdminsClient from "./AdminsClient";
import {
  listAdmins,
  type Paged,
  type AdminRow,
} from "#lib/adminUsersApi";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  role?: "" | "super_admin" | "super_admin_root";
  page?: string;
  pageSize?: string;
  sortBy?: "nombre" | "email" | "role" | "created_at";
  sortDir?: "asc" | "desc";
  new?: string; // abrir modal de creación
};

function buildCookieHeader(): string {
  const jar = cookies();
  const all = jar.getAll();
  if (!all?.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  // 1) Guard de sesión + rol
  const supa = supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supa
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role || (user.user_metadata as any)?.role || null;
  const isAdmin = role === "super_admin" || role === "super_admin_root";

  if (!isAdmin) {
    switch (role) {
      case "soporte":
        redirect("/dashboard/soporte");
      case "empresa":
        redirect("/dashboard/empresa");
      case "asesor":
        redirect("/dashboard/asesor");
      default:
        redirect("/");
    }
  }

  // 2) Filtros + paginación + orden
  const q = (searchParams.q || "").trim();
  const fRole = (searchParams.role || "") as "" | "super_admin" | "super_admin_root";
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const pageSize = [10, 20, 50].includes(parseInt(searchParams.pageSize || "", 10))
    ? parseInt(searchParams.pageSize!, 10)
    : 10;
  const sortBy = (searchParams.sortBy || "created_at") as "nombre" | "email" | "role" | "created_at";
  const sortDir = (searchParams.sortDir || "desc") as "asc" | "desc";

  // 3) SSR fetch (primer página con cookie)
  const cookieHeader = buildCookieHeader();
  let initial: Paged<AdminRow>;
  try {
    initial = await listAdmins(
      {
        q: q || undefined,
        role: fRole || undefined,
        page,
        pageSize,
        sortBy,
        sortDir,
      },
      { headers: { cookie: cookieHeader } }
    );
  } catch (e: any) {
    return (
      <main className="p-4 md:p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-semibold">Administradores</h1>
            <p className="text-sm text-gray-500">Error al cargar administradores.</p>
          </div>
        </header>
        <section className="rounded-2xl border p-4 text-red-700 bg-red-50">{e?.message || String(e)}</section>
      </main>
    );
  }

  // 4) Render
  const qsNew = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(fRole ? { role: fRole } : {}),
    page: String(page),
    pageSize: String(pageSize),
    sortBy,
    sortDir,
    new: "1",
  }).toString();

  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Administradores</h1>
          <p className="text-sm text-gray-500">ABM de administradores (root/admin), con reset de contraseña.</p>
        </div>

        <a
          href={`/dashboard/admin/admins?${qsNew}`}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + Nuevo admin
        </a>
      </header>

      {/* Filtros */}
      <section className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
        <form className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Buscar</label>
            <input
              name="q"
              defaultValue={q}
              placeholder="nombre / apellido / email"
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Rol</label>
            <select
              name="role"
              defaultValue={fRole}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
            >
              <option value="">Todos</option>
              <option value="super_admin">Admin</option>
              <option value="super_admin_root">Root</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Ordenar por</label>
            <select
              name="sortBy"
              defaultValue={sortBy}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
            >
              <option value="created_at">Creación</option>
              <option value="nombre">Nombre</option>
              <option value="email">Email</option>
              <option value="role">Rol</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Dirección</label>
            <select
              name="sortDir"
              defaultValue={sortDir}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>

          <div className="md:col-span-5 flex items-end gap-2">
            <button type="submit" className="rounded-xl border px-4 py-2 text-sm bg-gray-50 hover:bg-gray-100">
              Aplicar
            </button>
            <a href="/dashboard/admin/admins" className="rounded-xl border px-4 py-2 text-sm bg-white hover:bg-gray-50">
              Limpiar
            </a>
          </div>
        </form>
      </section>

      {/* Tabla + acciones (cliente) */}
      <AdminsClient initial={initial} />
    </main>
  );
}
