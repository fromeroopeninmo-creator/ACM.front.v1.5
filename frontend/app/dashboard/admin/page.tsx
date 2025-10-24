// frontend/app/dashboard/admin/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import { getAdminKPIs, type AdminKPIs } from "#lib/adminApi";

export const dynamic = "force-dynamic";

function buildCookieHeader(): string {
  const jar = cookies();
  const all = jar.getAll();
  if (!all?.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

function fmtNumber(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR").format(n);
}

function fmtMoney(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function AdminHomePage() {
  // 1) Guard de sesión + rol
  const supa = supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Buscamos el role en profiles; fallback a user_metadata.role
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

  // 2) Fetch SSR de KPIs admin
  const cookieHeader = buildCookieHeader();

  let kpis: AdminKPIs | null = null;
  let errorMsg: string | null = null;

  try {
    kpis = await getAdminKPIs({
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
  } catch (e: any) {
    errorMsg = e?.message || "Error al cargar KPIs de administración.";
  }

  // 3) Render
  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Panel de Administración</h1>
          <p className="text-sm text-gray-500">
            Resumen general del sistema: empresas, asesores, informes y métricas de ingresos.
          </p>
        </div>
      </header>

      {errorMsg ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {errorMsg}
        </section>
      ) : !kpis ? (
        <section className="rounded-2xl border p-4">Cargando…</section>
      ) : (
        <>
          {/* KPIs principales */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <article className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
              <div className="text-xs text-gray-500">Empresas activas</div>
              <div className="mt-1 text-2xl font-semibold">
                {fmtNumber(kpis.empresas_activas)}
              </div>
            </article>

            <article className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
              <div className="text-xs text-gray-500">Asesores activos</div>
              <div className="mt-1 text-2xl font-semibold">
                {fmtNumber(kpis.asesores_activos)}
              </div>
            </article>

            <article className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
              <div className="text-xs text-gray-500">Informes totales</div>
              <div className="mt-1 text-2xl font-semibold">
                {fmtNumber(kpis.informes_totales)}
              </div>
            </article>

            <article className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
              <div className="text-xs text-gray-500">MRR</div>
              <div className="mt-1 text-2xl font-semibold">{fmtMoney(kpis.mrr)}</div>
            </article>
          </section>

          {/* Accesos rápidos */}
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <a
              href="/dashboard/admin/empresas"
              className="rounded-2xl border p-4 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
            >
              <div className="text-sm font-medium">Empresas</div>
              <p className="text-xs text-gray-500 mt-1">
                Listado y gestión integral de empresas.
              </p>
            </a>

            <a
              href="/dashboard/admin/soporte"
              className="rounded-2xl border p-4 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
            >
              <div className="text-sm font-medium">Soporte</div>
              <p className="text-xs text-gray-500 mt-1">
                Alta de agentes, estados y auditoría de acciones.
              </p>
            </a>

            <a
              href="/dashboard/admin/planes"
              className="rounded-2xl border p-4 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
            >
              <div className="text-sm font-medium">Planes</div>
              <p className="text-xs text-gray-500 mt-1">
                ABM de planes (precios netos) y auditoría.
              </p>
            </a>

            <a
              href="/dashboard/admin/cashflow"
              className="rounded-2xl border p-4 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
            >
              <div className="text-sm font-medium">Cashflow / Pagos</div>
              <p className="text-xs text-gray-500 mt-1">
                Flujo de ingresos y estado de suscripciones.
              </p>
            </a>
          </section>

          {/* Actividad reciente / Auditoría (placeholder inicial) */}
          <section className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold">Actividad reciente</h2>
              <a
                href="/dashboard/soporte/logs"
                className="text-xs text-blue-600 hover:underline"
              >
                Ver todo
              </a>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Próximamente: feed unificado de auditoría (acciones de soporte, cambios de
              plan, altas/bajas, pagos).
            </p>
          </section>
        </>
      )}
    </main>
  );
}
