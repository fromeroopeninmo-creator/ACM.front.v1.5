// frontend/app/dashboard/admin/planes/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";

export const dynamic = "force-dynamic";

type PlanRow = {
  id: string;
  nombre: string;
  precio: number | null; // 💰 neto
  duracion_dias: number | null;
  max_asesores: number | null;
  precio_extra_por_asesor: number | null; // 💰 neto
  created_at: string | null;
  updated_at: string | null;
};

// ===== Helpers UI =====
function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}
function fmtNumber(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR").format(n);
}
function money(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}
function withIVA(n?: number | null, ivaPct = 0.21) {
  if (n === null || n === undefined) return { neto: null, iva: null, total: null };
  const iva = Math.round(n * ivaPct);
  const total = n + iva;
  return { neto: n, iva, total };
}

export default async function AdminPlanesPage() {
  // 1) Guard de sesión + rol admin
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

  // 2) Traer planes (solo lectura por ahora). El ABM lo conectamos después
  let planes: PlanRow[] = [];
  let errorMsg: string | null = null;

  try {
    const { data, error } = await supa
      .from("planes")
      .select(
        "id, nombre, precio, duracion_dias, max_asesores, precio_extra_por_asesor, created_at, updated_at"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    planes = data || [];
  } catch (e: any) {
    errorMsg = e?.message || "Error al cargar planes.";
  }

  // 3) Render
  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Planes (Administración)</h1>
          <p className="text-sm text-gray-500">
            ABM de planes con precios netos; en UI se muestra Neto + IVA (21%) y total.
          </p>
        </div>

        {/* Próximamente: alta/edición desde modal (usaremos /api/admin/planes) */}
        <button
          className="rounded-lg border px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
          title="Próximamente"
          disabled
        >
          + Nuevo plan
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
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Precio Neto</th>
                  <th className="px-3 py-2">IVA (21%)</th>
                  <th className="px-3 py-2">Total c/IVA</th>
                  <th className="px-3 py-2">Duración (días)</th>
                  <th className="px-3 py-2">Cupo base</th>
                  <th className="px-3 py-2">Extra por asesor (Neto)</th>
                  <th className="px-3 py-2">Extra IVA</th>
                  <th className="px-3 py-2">Extra Total</th>
                  <th className="px-3 py-2">Actualizado</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {planes.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-6 text-center text-gray-500">
                      No hay planes definidos todavía.
                    </td>
                  </tr>
                ) : (
                  planes.map((p) => {
                    const base = withIVA(p.precio ?? null);
                    const extra = withIVA(p.precio_extra_por_asesor ?? null);
                    return (
                      <tr key={p.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{p.nombre}</td>
                        <td className="px-3 py-2">{money(base.neto)}</td>
                        <td className="px-3 py-2">{money(base.iva)}</td>
                        <td className="px-3 py-2">{money(base.total)}</td>
                        <td className="px-3 py-2">{fmtNumber(p.duracion_dias)}</td>
                        <td className="px-3 py-2">{fmtNumber(p.max_asesores)}</td>
                        <td className="px-3 py-2">{money(extra.neto)}</td>
                        <td className="px-3 py-2">{money(extra.iva)}</td>
                        <td className="px-3 py-2">{money(extra.total)}</td>
                        <td className="px-3 py-2">{fmtDate(p.updated_at || p.created_at)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              className="text-gray-400 cursor-not-allowed"
                              title="Editar (próximamente)"
                              disabled
                            >
                              Editar
                            </button>
                            <button
                              className="text-gray-300 cursor-not-allowed"
                              title="Eliminar (próximamente)"
                              disabled
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Roadmap / ayuda de uso */}
      <section className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
        <h2 className="text-base font-semibold mb-1">Próximos pasos</h2>
        <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
          <li>
            Conectar <code>/api/admin/planes</code> para alta/edición/baja (ABM completo + auditoría).
          </li>
          <li>
            Validar reglas: precios netos en BD, mostrar siempre Neto + IVA + Total en UI.
          </li>
          <li>
            Auditoría de cambios (tabla <code>webhook_events</code> o específica de planes).
          </li>
        </ul>
      </section>
    </main>
  );
}
