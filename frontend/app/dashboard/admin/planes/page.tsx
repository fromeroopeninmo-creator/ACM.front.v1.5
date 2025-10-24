import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import PlanesClient from "./PlanesClient";
import {
  listPlanes,
  type Paged,
  type PlanRow,
} from "#lib/adminPlanesApi";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  activo?: "" | "true" | "false";
  page?: string;
  pageSize?: string;
  new?: string; // para abrir modal de creación
};

function buildCookieHeader(): string {
  const jar = cookies();
  const all = jar.getAll();
  if (!all?.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

export default async function AdminPlanesPage({ searchParams }: { searchParams: SearchParams }) {
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

  // 2) Filtros + paginación
  const q = (searchParams.q || "").trim();
  const activo = (searchParams.activo || "") as "" | "true" | "false";
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const pageSize = [10, 20, 50].includes(parseInt(searchParams.pageSize || "", 10))
    ? parseInt(searchParams.pageSize!, 10)
    : 10;

  // 3) SSR fetch (primer página con cookie)
  const cookieHeader = buildCookieHeader();
  let initial: Paged<PlanRow>;
  try {
    initial = await listPlanes(
      { q: q || undefined, activo: activo || undefined, page, pageSize },
      { headers: { cookie: cookieHeader } }
    );
  } catch (e: any) {
    return (
      <main className="p-4 md:p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-semibold">Planes (Administración)</h1>
            <p className="text-sm text-gray-500">Error al cargar planes.</p>
          </div>
        </header>
        <section className="rounded-2xl border p-4 text-red-700 bg-red-50">{e?.message || String(e)}</section>
      </main>
    );
  }

  // 4) Render
  const qs = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(activo ? { activo } : {}),
    page: String(page),
    pageSize: String(pageSize),
    new: "1", // para abrir modal de alta en el cliente
  }).toString();

  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Planes (Administración)</h1>
          <p className="text-sm text-gray-500">Listado, filtros y ABM de planes.</p>
        </div>

        {/* Botón para abrir modal de creación (vía ?new=1) */}
        <a
          href={`/dashboard/admin/planes?${qs}`}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + Nuevo plan
        </a>
      </header>

      {/* Filtros (GET) */}
      <section className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
        <form className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Buscar</label>
            <input
              name="q"
              defaultValue={q}
              placeholder="Nombre de plan"
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Estado</label>
            <select
              name="activo"
              defaultValue={activo}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
            >
              <option value="">Todos</option>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="rounded-xl border px-4 py-2 text-sm bg-gray-50 hover:bg-gray-100">
              Aplicar
            </button>
            <a href="/dashboard/admin/planes" className="rounded-xl border px-4 py-2 text-sm bg-white hover:bg-gray-50">
              Limpiar
            </a>
          </div>
        </form>
      </section>

      {/* Tabla + acciones (cliente) */}
      <PlanesClient initial={initial} />
    </main>
  );
}
