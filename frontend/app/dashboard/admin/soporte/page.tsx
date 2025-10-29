import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import SoporteClient from "./SoporteClient";
import type { SoporteItem } from "#lib/adminSoporteApi";

export const dynamic = "force-dynamic";

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

/** Reenvía cookies al fetch SSR para que /api admin valide rol y use service-role internamente */
function buildCookieHeader(): string {
  const jar = cookies();
  const all = jar.getAll();
  if (!all?.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

export default async function AdminSoportePage() {
  // 1) Guard de sesión + rol (misma lógica original)
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

  const role = (profile?.role || (user.user_metadata as any)?.role || null) as Role | null;
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

  // 2) SSR: obtener listado vía API interna (usa service-role con autorización por rol)
  let initialItems: SoporteItem[] = [];
  let errorMsg: string | null = null;

  try {
    const base =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_VERCEL_URL ||
      process.env.VERCEL_URL ||
      "";
    const origin = base.startsWith("http") ? base : `https://${base}`;
    const res = await fetch(`${origin}/api/admin/soporte`, {
      method: "GET",
      headers: {
        cookie: buildCookieHeader(),
      },
      cache: "no-store",
      // @ts-ignore next hinting
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText} ${txt}`.trim());
    }
    const data = (await res.json()) as { items: SoporteItem[] };
    initialItems = data?.items ?? [];
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

        {/* Ancla al formulario del componente cliente */}
        <a
          href="#nuevo-agente"
          className="rounded-lg border px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700"
          title="Crear/actualizar agente"
        >
          + Nuevo agente
        </a>
      </header>

      {errorMsg ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {errorMsg}
        </section>
      ) : (
        <>
          {/* ✅ UI cliente (ABM + toggle) con datos reales */}
          <SoporteClient initialItems={initialItems} />

          {/* 🔒 Tabla SSR original, oculta como fallback (se conserva 1:1) */}
          <section className="rounded-2xl border p-0 overflow-hidden bg-white dark:bg-neutral-900 hidden">
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
                  {initialItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                        No hay agentes de soporte aún.
                      </td>
                    </tr>
                  ) : (
                    initialItems.map((s) => (
                      <tr key={`${s.id}-${s.email}`} className="border-t">
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
                            <a
                              href={`/dashboard/soporte/logs?soporteId=${encodeURIComponent(
                                String(s.id)
                              )}`}
                              className="text-blue-600 hover:underline"
                              title="Ver registros de acciones"
                            >
                              Ver registros
                            </a>
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
        </>
      )}

      {/* Roadmap de la sección (1:1) */}
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
