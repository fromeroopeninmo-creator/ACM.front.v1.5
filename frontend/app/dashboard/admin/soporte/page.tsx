// frontend/app/dashboard/admin/soporte/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";

export const dynamic = "force-dynamic";

type SoporteRow = {
  id: number;
  nombre: string | null;
  email: string;
  activo: boolean | null;
  created_at: string | null;
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

export default async function AdminSoportePage() {
  // 1) Guard de sesión + rol
  const supa = supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // role en profiles; fallback a user_metadata.role
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

  // 2) Fetch SSR del listado de soporte (solo lectura por ahora)
  let soportes: SoporteRow[] = [];
  let errorMsg: string | null = null;

  try {
    const { data, error } = await supa
      .from("soporte")
      .select("id, nombre, email, activo, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    soportes = data || [];
  } catch (e: any) {
    errorMsg = e?.message || "Error al cargar agentes de soporte.";
  }

  // 3) Render
  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Soporte (Administración)</h1>
          <p className="text-sm text-gray-500">
            Alta y gestión de agentes de soporte. En esta primera etapa, vista de solo lectura.
          </p>
        </div>

        {/* Próximamente: botón "Nuevo agente" abre modal / panel (creación/upsert) */}
        <button
          className="rounded-lg border px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
          title="Próximamente"
          disabled
        >
          + Nuevo agente
        </button>
      </header>

      {errorMsg ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {errorMsg}
        </section>
      ) : (
        <section className="rounded-2xl border p-0 overflow-hidden bg-white dark:bg-neutral-900">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-900">
                <tr className="text-left">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Alta</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {soportes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                      No hay agentes de soporte aún.
                    </td>
                  </tr>
                ) : (
                  soportes.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="px-3 py-2">{s.id}</td>
                      <td className="px-3 py-2">{s.nombre || "—"}</td>
                      <td className="px-3 py-2">{s.email}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            s.activo
                              ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700"
                              : "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"
                          }
                        >
                          {s.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{fmtDate(s.created_at)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {/* Ver logs por soporte (placeholder: filtraremos en /soporte/logs) */}
                          <a
                            href={`/dashboard/soporte/logs?soporteId=${encodeURIComponent(
                              String(s.id)
                            )}`}
                            className="text-blue-600 hover:underline"
                            title="Ver registros de acciones"
                          >
                            Ver registros
                          </a>

                          {/* Próximamente: toggle activo/inactivo */}
                          <button
                            className="text-gray-400 cursor-not-allowed"
                            title="Próximamente"
                            disabled
                          >
                            {s.activo ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Roadmap de la sección */}
      <section className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
        <h2 className="text-base font-semibold mb-1">Próximos pasos</h2>
        <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
          <li>Formulario de alta / edición de agente (email, nombre, apellido, activo).</li>
          <li>Toggle activo/inactivo con auditoría en <code>acciones_soporte</code>.</li>
          <li>Filtro por estado / búsqueda por nombre o email.</li>
          <li>Worklog por soporte y rango de fechas (reutilizando <code>acciones_soporte</code>).</li>
        </ul>
      </section>
    </main>
  );
}
