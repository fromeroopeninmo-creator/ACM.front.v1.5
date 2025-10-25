// frontend/app/dashboard/admin/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";

export const dynamic = "force-dynamic";

type KpisResponse = {
  empresas_activas?: number | null;
  asesores_activos?: number | null;
  informes_totales?: number | null;
  mrr?: number | null; // ingreso mensual recurrente
};

type CashflowKpisResponse = {
  rango: { desde: string; hasta: string };
  mrr_neto: number;
  ingresos_neto_total: number;
  ingresos_con_iva: number;
  arpu_neto: number;
  empresas_activas: number;
  churn_empresas: number;
  upgrades: number;
  downgrades: number;
};

function buildCookieHeader(): string {
  const jar = cookies();
  const all = jar.getAll();
  if (!all?.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

function getBaseUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL;
  if (envUrl) return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  return "http://localhost:3000";
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

function currentMonthRange(): { desde: string; hasta: string } {
  // Mes actual en formato YYYY-MM-DD
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-11
  const first = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(y, m + 1, 0));
  const pad = (x: number) => String(x).padStart(2, "0");
  const desde = `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(first.getUTCDate())}`;
  const hasta = `${last.getUTCFullYear()}-${pad(last.getUTCMonth() + 1)}-${pad(last.getUTCDate())}`;
  return { desde, hasta };
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

  // 2) Fetch SSR de KPIs
  const cookieHeader = buildCookieHeader();
  const base = getBaseUrl();

  let kpis: KpisResponse | null = null;
  let errorMsg: string | null = null;

  try {
    const res = await fetch(`${base}/api/admin/kpis`, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GET /api/admin/kpis → ${res.status} ${res.statusText} ${body}`);
    }
    kpis = (await res.json()) as KpisResponse;
  } catch (e: any) {
    errorMsg = e?.message || "Error al cargar KPIs.";
  }

  // 2.b) Fetch SSR de KPIs de Cashflow (mes actual) para mostrar mini-dato en la card
  let cashflowMini: CashflowKpisResponse | null = null;
  try {
    const { desde, hasta } = currentMonthRange();
    const res = await fetch(`${base}/api/admin/cashflow/kpis?desde=${desde}&hasta=${hasta}`, {
      method: "GET",
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (res.ok) {
      cashflowMini = (await res.json()) as CashflowKpisResponse;
    }
  } catch {
    // Silencioso: si falla, simplemente no mostramos el mini-dato
  }

  // 3) Render
  return (
    <main className="p-4 md:p-6 space-y-5">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Panel de Administración</h1>
          <p className="text-sm text-gray-500">
            Resumen general del sistema: empresas, asesores, informes y métricas de ingresos.
          </p>
        </div>
      </header>

      {/* KPIs */}
      {errorMsg ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {errorMsg}
        </section>
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
            <div className="text-xs text-gray-500">Empresas activas</div>
            <div className="text-2xl font-semibold mt-1">
              {fmtNumber((kpis?.empresas_activas ?? 0))}
            </div>
          </div>
          <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
            <div className="text-xs text-gray-500">Asesores activos</div>
            <div className="text-2xl font-semibold mt-1">
              {fmtNumber((kpis?.asesores_activos ?? 0))}
            </div>
          </div>
          <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
            <div className="text-xs text-gray-500">Informes totales</div>
            <div className="text-2xl font-semibold mt-1">
              {fmtNumber((kpis?.informes_totales ?? 0))}
            </div>
          </div>
          <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
            <div className="text-xs text-gray-500">MRR</div>
            <div className="text-2xl font-semibold mt-1">
              {fmtMoney((kpis?.mrr ?? 0))}
            </div>
          </div>
        </section>
      )}

      {/* Accesos / módulos */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <a
          href="/dashboard/admin/empresas"
          className="rounded-2xl border p-5 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
        >
          <h2 className="text-base font-semibold">Empresas</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Listado y gestión integral de empresas.
          </p>
        </a>

        <a
          href="/dashboard/admin/soporte"
          className="rounded-2xl border p-5 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
        >
          <h2 className="text-base font-semibold">Soporte</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Alta de agentes, estados y auditoría de acciones.
          </p>
        </a>

        <a
          href="/dashboard/admin/planes"
          className="rounded-2xl border p-5 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
        >
          <h2 className="text-base font-semibold">Planes</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            ABM de planes (precios netos) y auditoría.
          </p>
        </a>

        {/* Card conectada a la futura página de Cashflow */}
        <a
          href="/dashboard/admin/cashflow"
          className="rounded-2xl border p-5 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
        >
          <h2 className="text-base font-semibold">Cashflow / Pagos</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Flujo de ingresos y estado de suscripciones.
          </p>
          {cashflowMini ? (
            <div className="mt-3 inline-flex items-center gap-2 text-sm">
              <span className="px-2 py-0.5 rounded-full border bg-gray-50 dark:bg-neutral-800">
                MRR (mes): <strong className="ml-1">{fmtMoney(cashflowMini.mrr_neto)}</strong>
              </span>
            </div>
          ) : null}
        </a>
      </section>
    </main>
  );
}
