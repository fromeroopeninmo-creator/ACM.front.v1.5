import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";

export const dynamic = "force-dynamic";

type DashboardData = {
  generatedAt: string;
  kpis: {
    empresasTotal: number; empresasConAcceso: number; clientesPagos: number; trials: number;
    desarrollo: number; suspendidas: number; sinCiclo: number; vencen7d: number;
    acuerdosPorVencer: number; ingresosMes: number;
  };
  ingresosMensuales: Array<{ mes: string; monto: number }>;
  distribucion: Array<{ label: string; value: number }>;
};

function cookieHeader() { return cookies().getAll().map((c) => `${c.name}=${c.value}`).join("; "); }
function baseUrl() {
  const v = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL;
  return v ? (v.startsWith("http") ? v : `https://${v}`) : "http://localhost:3000";
}
function money(n: number) { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0); }
function num(n: number) { return new Intl.NumberFormat("es-AR").format(n || 0); }

async function guard() {
  const s = supabaseServer();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await s.from("profiles").select("role").or(`id.eq.${user.id},user_id.eq.${user.id}`).limit(1).maybeSingle();
  const role = p?.role ?? (user.user_metadata as any)?.role;
  if (role !== "super_admin" && role !== "super_admin_root") redirect("/");
}

export default async function AdminHomePage() {
  await guard();
  let data: DashboardData | null = null;
  let error: string | null = null;
  try {
    const res = await fetch(`${baseUrl()}/api/admin/dashboard`, { headers: { cookie: cookieHeader() }, cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    data = await res.json();
  } catch (e: any) { error = e?.message ?? "No se pudo cargar el panel."; }

  const k = data?.kpis;
  const maxIncome = Math.max(1, ...(data?.ingresosMensuales ?? []).map((x) => x.monto));
  const totalDist = Math.max(1, ...(data?.distribucion ?? []).map((x) => x.value));

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6 xl:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-600">VAI Prop · Administración</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white md:text-3xl">Centro de control</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Acceso, renovaciones, acuerdos e ingresos reales en una sola vista.</p>
        </div>
        <nav className="grid grid-cols-2 gap-2 sm:flex">
          <a href="/dashboard/admin/empresas" className="rounded-xl bg-slate-950 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-slate-800">Gestionar empresas</a>
          <a href="/dashboard/admin/cashflow" className="rounded-xl border bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:bg-neutral-900 dark:text-white">Ver cashflow</a>
        </nav>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-6">
        {[
          ["Clientes pagos", k?.clientesPagos ?? 0, "Ciclo vigente"],
          ["Con acceso", k?.empresasConAcceso ?? 0, `${k?.empresasTotal ?? 0} empresas`],
          ["Ingresos del mes", money(k?.ingresosMes ?? 0), "Pagos acreditados"],
          ["Acuerdos por vencer", k?.acuerdosPorVencer ?? 0, "Próximos 30 días"],
          ["Ciclos por vencer", k?.vencen7d ?? 0, "Próximos 7 días"],
          ["Suspendidas", k?.suspendidas ?? 0, `${k?.sinCiclo ?? 0} sin ciclo`],
        ].map(([label, value, hint]) => (
          <article key={String(label)} className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm dark:bg-neutral-900">
            <p className="truncate text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-2 break-words text-2xl font-bold text-slate-950 dark:text-white">{typeof value === "number" ? num(value) : value}</p>
            <p className="mt-1 text-xs text-slate-400">{hint}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <article className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-neutral-900 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-semibold">Ingresos acreditados</h2><p className="text-xs text-slate-500">Últimos seis meses</p></div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Sin simulaciones</span>
          </div>
          <div className="mt-6 flex h-56 items-end gap-2 overflow-x-auto pb-2 sm:gap-4">
            {(data?.ingresosMensuales ?? []).map((x) => (
              <div key={x.mes} className="flex h-full min-w-[58px] flex-1 flex-col justify-end gap-2 text-center">
                <span className="text-[10px] font-medium text-slate-500">{money(x.monto)}</span>
                <div className="mx-auto w-full max-w-20 rounded-t-xl bg-slate-900/90 transition-all dark:bg-amber-500" style={{ height: `${Math.max(4, (x.monto / maxIncome) * 100)}%` }} />
                <span className="text-xs text-slate-500">{x.mes.slice(5)}/{x.mes.slice(2,4)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-neutral-900 md:p-5">
          <h2 className="font-semibold">Estado de cartera</h2>
          <p className="text-xs text-slate-500">Distribución operativa actual</p>
          <div className="mt-6 space-y-5">
            {(data?.distribucion ?? []).map((x) => (
              <div key={x.label}>
                <div className="mb-2 flex items-center justify-between text-sm"><span>{x.label}</span><strong>{num(x.value)}</strong></div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-neutral-800"><div className="h-full rounded-full bg-amber-500" style={{ width: `${(x.value / totalDist) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 border-t pt-4 text-center">
            <div><p className="text-xl font-bold">{num(k?.trials ?? 0)}</p><p className="text-xs text-slate-500">Trials</p></div>
            <div><p className="text-xl font-bold">{num(k?.desarrollo ?? 0)}</p><p className="text-xs text-slate-500">Desarrollo</p></div>
          </div>
        </article>
      </section>

      {(k?.acuerdosPorVencer ?? 0) > 0 || (k?.vencen7d ?? 0) > 0 ? (
        <section className="grid gap-3 md:grid-cols-2">
          {(k?.acuerdosPorVencer ?? 0) > 0 ? <a href="/dashboard/admin/empresas?acuerdo_hasta=proximos30" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 hover:bg-amber-100"><strong>{k?.acuerdosPorVencer} acuerdo(s) próximos a finalizar</strong><p className="mt-1 text-sm">Conviene iniciar la renegociación antes del vencimiento.</p></a> : null}
          {(k?.vencen7d ?? 0) > 0 ? <a href="/dashboard/admin/empresas?ciclo_hasta=proximos7" className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900 hover:bg-blue-100"><strong>{k?.vencen7d} ciclo(s) próximos a vencer</strong><p className="mt-1 text-sm">Revisá renovaciones y pagos pendientes.</p></a> : null}
        </section>
      ) : null}
    </main>
  );
}
