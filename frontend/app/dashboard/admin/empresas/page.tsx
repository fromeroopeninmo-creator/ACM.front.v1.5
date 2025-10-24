// frontend/app/dashboard/admin/empresas/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  plan?: string;
  estado?: "activo" | "inactivo" | "";
  page?: string;
  pageSize?: string;
};

type EmpresaRow = {
  empresa_id: string;
  empresa_nombre: string | null;
  cuit: string | null;
  plan_nombre: string | null;
  max_asesores: number | null;
  max_asesores_override: number | null;
  plan_activo: boolean | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  logo_url?: string | null;
  color?: string | null;
};

function fmtNumber(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR").format(n);
}
function fmtDateOnly(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString();
}

export default async function AdminEmpresasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // 1) Guard de sesión + rol
  const supa = supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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

  // 2) Filtros + paginación desde URL
  const q = (searchParams.q || "").trim() || null;
  const plan = (searchParams.plan || "").trim() || null;
  const estado = (searchParams.estado || "") as "activo" | "inactivo" | "";
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const pageSize = [10, 20, 50].includes(parseInt(searchParams.pageSize || "", 10))
    ? parseInt(searchParams.pageSize!, 10)
    : 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // 3) Query a la vista segura
  let query = supa
    .from("v_empresas_soporte")
    .select(
      "empresa_id, empresa_nombre, cuit, plan_nombre, max_asesores, max_asesores_override, plan_activo, fecha_inicio, fecha_fin, logo_url, color",
      { count: "exact" }
    );

  if (q) {
    query = query.or(
      `empresa_nombre.ilike.%${q}%,cuit.ilike.%${q}%`
    );
  }
  if (plan) query = query.eq("plan_nombre", plan);
  if (estado === "activo") query = query.eq("plan_activo", true);
  if (estado === "inactivo") query = query.eq("plan_activo", false);

  query = query.order("empresa_nombre", { ascending: true }).range(from, to);

  const { data, error, count } = await query;

  const items: EmpresaRow[] = data || [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 4) Render
  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Empresas (Administración)</h1>
          <p className="text-sm text-gray-500">
            Listado general, filtros y acceso al detalle. (Datos leídos desde <code>v_empresas_soporte</code>)
          </p>
        </div>
      </header>

      {/* Filtros */}
      <section className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
        <form className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Buscar</label>
            <input
              name="q"
              defaultValue={q || ""}
              placeholder="Razón social o CUIT"
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Plan</label>
            <input
              name="plan"
              defaultValue={plan || ""}
              placeholder="Ej: Premium"
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Estado</label>
            <select
              name="estado"
              defaultValue={estado || ""}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
            >
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-xl border px-4 py-2 text-sm bg-gray-50 hover:bg-gray-100"
            >
              Aplicar
            </button>
            <a
              href="/dashboard/admin/empresas"
              className="rounded-xl border px-4 py-2 text-sm bg-white hover:bg-gray-50"
            >
              Limpiar
            </a>
          </div>
        </form>
      </section>

      {/* Tabla */}
      <section className="rounded-2xl border p-0 overflow-hidden bg-white dark:bg-neutral-900">
        {error ? (
          <div className="p-4 text-red-700">
            Error al cargar empresas: {error.message}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-900">
                <tr className="text-left">
                  <th className="px-3 py-2">Razón social</th>
                  <th className="px-3 py-2">CUIT</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Cupo (base → override)</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Inicio</th>
                  <th className="px-3 py-2">Fin</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                      Sin resultados.
                    </td>
                  </tr>
                ) : (
                  items.map((e) => {
                    const cupoBase = e.max_asesores ?? 0;
                    const cupoOv = e.max_asesores_override ?? 0;
                    const cupo = cupoOv > 0 ? `${cupoBase} → ${cupoOv}` : `${cupoBase}`;
                    return (
                      <tr key={e.empresa_id} className="border-t">
                        <td className="px-3 py-2">{e.empresa_nombre || "—"}</td>
                        <td className="px-3 py-2">{e.cuit || "—"}</td>
                        <td className="px-3 py-2">{e.plan_nombre || "—"}</td>
                        <td className="px-3 py-2">{cupo}</td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              e.plan_activo
                                ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700"
                                : "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"
                            }
                          >
                            {e.plan_activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-3 py-2">{fmtDateOnly(e.fecha_inicio)}</td>
                        <td className="px-3 py-2">{fmtDateOnly(e.fecha_fin)}</td>
                        <td className="px-3 py-2">
                          <a
                            href={`/dashboard/soporte/${encodeURIComponent(e.empresa_id)}`}
                            className="text-blue-600 hover:underline"
                            title="Ver detalle de la empresa (vista Soporte)"
                          >
                            Ver detalle
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Paginación */}
      <section className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {`Mostrando ${items.length} de ${total} • Página ${page} de ${totalPages}`}
        </p>
        <div className="flex items-center gap-2">
          <a
            href={`/dashboard/admin/empresas?${new URLSearchParams({
              q: q || "",
              plan: plan || "",
              estado: estado || "",
              page: String(Math.max(1, page - 1)),
              pageSize: String(pageSize),
            }).toString()}`}
            className={`rounded-xl border px-3 py-1 text-sm ${
              page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-gray-50"
            }`}
          >
            Anterior
          </a>
          <a
            href={`/dashboard/admin/empresas?${new URLSearchParams({
              q: q || "",
              plan: plan || "",
              estado: estado || "",
              page: String(Math.min(totalPages, page + 1)),
              pageSize: String(pageSize),
            }).toString()}`}
            className={`rounded-xl border px-3 py-1 text-sm ${
              page >= totalPages ? "pointer-events-none opacity-50" : "hover:bg-gray-50"
            }`}
          >
            Siguiente
          </a>
        </div>
      </section>
    </main>
  );
}
