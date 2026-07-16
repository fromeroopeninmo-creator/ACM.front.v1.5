import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";

export const dynamic = "force-dynamic";

type Params = {
  q?: string;
  estado?: string;
  ordenar?: string;
  creada_desde?: string;
  creada_hasta?: string;
  ciclo_hasta?: string;
  acuerdo_hasta?: string;
  page?: string;
  pageSize?: string;
};

type Row = {
  id: string;
  nombre: string;
  razonSocial?: string | null;
  cuit?: string | null;
  ubicacion?: string | null;
  creadaEn?: string | null;
  suspendida: boolean;
  suspensionMotivo?: string | null;
  acceso: boolean;
  estado: "activa" | "suspendida";
  plan?: string | null;
  esTrial?: boolean;
  cicloInicio?: string | null;
  cicloFin?: string | null;
  diasParaVencer?: number | null;
  acuerdo?: {
    id: string;
    tipo?: string | null;
    fechaFin?: string | null;
    precioNeto?: number | null;
    maxAsesores?: number | null;
    diasParaVencer?: number | null;
  } | null;
};

type Response = {
  page: number;
  pageSize: number;
  total: number;
  items: Row[];
};

function cookieHeader() {
  return cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

function baseUrl() {
  const value =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL;
  return value
    ? value.startsWith("http")
      ? value
      : `https://${value}`
    : "http://localhost:3000";
}

function date(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(parsed);
}

function money(value?: number | null) {
  return value == null
    ? "—"
    : new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
      }).format(value);
}

function isoFromOffset(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function EstadoBadge({ row }: { row: Row }) {
  const active = row.estado === "activa";
  return (
    <div className="min-w-0">
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
          active
            ? "bg-emerald-50 text-emerald-700"
            : "bg-red-50 text-red-700"
        }`}
      >
        {active ? "Activo" : "Suspendido"}
      </span>
      {!active && row.suspensionMotivo ? (
        <p className="mt-1.5 break-words text-xs leading-5 text-red-600">
          {row.suspensionMotivo}
        </p>
      ) : null}
    </div>
  );
}

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle();

  const role = profile?.role ?? (user.user_metadata as any)?.role;
  if (role !== "super_admin" && role !== "super_admin_root") redirect("/");

  const normalized = { ...searchParams };
  if (searchParams.ciclo_hasta === "proximos7") {
    normalized.ciclo_hasta = isoFromOffset(7);
  }
  if (searchParams.acuerdo_hasta === "proximos30") {
    normalized.acuerdo_hasta = isoFromOffset(30);
  }

  const query = new URLSearchParams();
  Object.entries(normalized).forEach(([key, value]) => {
    if (value) query.set(key, String(value));
  });

  let data: Response = { page: 1, pageSize: 20, total: 0, items: [] };
  let error: string | null = null;

  try {
    const response = await fetch(
      `${baseUrl()}/api/admin/empresas/resumen?${query.toString()}`,
      { headers: { cookie: cookieHeader() }, cache: "no-store" }
    );
    if (!response.ok) throw new Error(await response.text());
    data = (await response.json()) as Response;
  } catch (cause: any) {
    error = cause?.message ?? "No se pudo cargar empresas.";
  }

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const href = (page: number) => {
    const next = new URLSearchParams(query);
    next.set("page", String(page));
    return `/dashboard/admin/empresas?${next.toString()}`;
  };

  return (
    <main className="mx-auto w-full max-w-[1700px] overflow-x-hidden p-4 md:p-6 xl:p-8">
      <div className="min-w-0 space-y-5">
        <header className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-600">
              Administración comercial
            </p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Empresas</h1>
            <p className="mt-1 text-sm text-slate-500">
              Estado real de acceso, ciclos vigentes y acuerdos comerciales.
            </p>
          </div>
          <a
            href="/dashboard/admin"
            className="w-full rounded-xl border bg-white px-4 py-2.5 text-center text-sm font-semibold hover:bg-slate-50 dark:bg-neutral-900 sm:w-auto"
          >
            ← Volver al panel
          </a>
        </header>

        <section className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm dark:bg-neutral-900">
          <form className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-8">
            <label className="min-w-0 sm:col-span-2 lg:col-span-3 2xl:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Buscar
              </span>
              <input
                name="q"
                defaultValue={searchParams.q}
                placeholder="Empresa, CUIT o ubicación"
                className="w-full min-w-0 rounded-xl border bg-transparent px-3 py-2.5 text-sm"
              />
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Estado
              </span>
              <select
                name="estado"
                defaultValue={searchParams.estado ?? "todos"}
                className="w-full min-w-0 rounded-xl border bg-transparent px-3 py-2.5 text-sm"
              >
                <option value="todos">Todos</option>
                <option value="activa">Activos</option>
                <option value="suspendida">Suspendidos</option>
              </select>
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Ordenar por
              </span>
              <select
                name="ordenar"
                defaultValue={searchParams.ordenar ?? "prioridad"}
                className="w-full min-w-0 rounded-xl border bg-transparent px-3 py-2.5 text-sm"
              >
                <option value="prioridad">Alertas primero</option>
                <option value="ultimas">Últimas empresas</option>
                <option value="antiguas">Más antiguas</option>
                <option value="nombre">Nombre A–Z</option>
              </select>
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Creada desde
              </span>
              <input
                type="date"
                name="creada_desde"
                defaultValue={searchParams.creada_desde}
                className="w-full min-w-0 rounded-xl border bg-transparent px-3 py-2.5 text-sm"
              />
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Creada hasta
              </span>
              <input
                type="date"
                name="creada_hasta"
                defaultValue={searchParams.creada_hasta}
                className="w-full min-w-0 rounded-xl border bg-transparent px-3 py-2.5 text-sm"
              />
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Ciclo vence hasta
              </span>
              <input
                type="date"
                name="ciclo_hasta"
                defaultValue={normalized.ciclo_hasta}
                className="w-full min-w-0 rounded-xl border bg-transparent px-3 py-2.5 text-sm"
              />
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Acuerdo vence hasta
              </span>
              <input
                type="date"
                name="acuerdo_hasta"
                defaultValue={normalized.acuerdo_hasta}
                className="w-full min-w-0 rounded-xl border bg-transparent px-3 py-2.5 text-sm"
              />
            </label>

            <div className="flex min-w-0 flex-col gap-2 sm:col-span-2 sm:flex-row lg:col-span-3 2xl:col-span-8">
              <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
                Aplicar filtros
              </button>
              <a
                href="/dashboard/admin/empresas"
                className="rounded-xl border px-4 py-2.5 text-center text-sm font-semibold"
              >
                Limpiar
              </a>
            </div>
          </form>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex min-w-0 items-center justify-between">
          <p className="text-sm text-slate-500">
            <strong className="text-slate-900 dark:text-white">{data.total}</strong>{" "}
            empresas encontradas
          </p>
        </div>

        <section className="grid min-w-0 gap-3 xl:hidden">
          {data.items.map((row) => (
            <article
              key={row.id}
              className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm dark:bg-neutral-900"
            >
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="break-words font-semibold">{row.nombre}</h2>
                  <p className="mt-1 break-words text-xs text-slate-500">
                    {row.cuit || "Sin CUIT"} · {row.ubicacion || "Sin ubicación"}
                  </p>
                </div>
                <div className="shrink-0 sm:max-w-[45%]">
                  <EstadoBadge row={row} />
                </div>
              </div>

              <dl className="mt-4 grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-neutral-950">
                  <dt className="text-xs text-slate-500">Plan</dt>
                  <dd className="mt-1 break-words font-semibold">
                    {row.plan || "Sin plan"}
                  </dd>
                </div>
                <div className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-neutral-950">
                  <dt className="text-xs text-slate-500">
                    {row.esTrial ? "Ciclo de prueba" : "Ciclo vigente"}
                  </dt>
                  <dd className="mt-1 break-words font-semibold">
                    {row.cicloInicio ? `${date(row.cicloInicio)} → ` : ""}
                    {date(row.cicloFin)}
                  </dd>
                </div>
                <div className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-neutral-950">
                  <dt className="text-xs text-slate-500">Acuerdo</dt>
                  <dd className="mt-1 break-words font-semibold">
                    {row.acuerdo ? date(row.acuerdo.fechaFin) : "Sin acuerdo"}
                  </dd>
                </div>
                <div className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-neutral-950">
                  <dt className="text-xs text-slate-500">Precio acordado</dt>
                  <dd className="mt-1 font-semibold">
                    {money(row.acuerdo?.precioNeto)}
                  </dd>
                </div>
              </dl>

              {row.acuerdo?.diasParaVencer != null &&
              row.acuerdo.diasParaVencer <= 30 ? (
                <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-xs font-medium text-amber-800">
                  Acuerdo por vencer en {row.acuerdo.diasParaVencer} día(s).
                </p>
              ) : null}

              <a
                href={`/dashboard/admin/empresas/${row.id}`}
                className="mt-4 block rounded-xl bg-slate-950 px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                Abrir empresa
              </a>
            </article>
          ))}
        </section>

        <section className="hidden min-w-0 overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-neutral-900 xl:block">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-neutral-950">
              <tr>
                <th className="w-[23%] px-4 py-3">Empresa</th>
                <th className="w-[17%] px-4 py-3">Estado</th>
                <th className="w-[22%] px-4 py-3">Plan / ciclo</th>
                <th className="w-[20%] px-4 py-3">Acuerdo</th>
                <th className="w-[10%] px-4 py-3">Alta</th>
                <th className="w-[8%] px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr
                  key={row.id}
                  className="border-t align-top hover:bg-slate-50/70 dark:hover:bg-neutral-800"
                >
                  <td className="min-w-0 px-4 py-4">
                    <p className="break-words font-semibold">{row.nombre}</p>
                    <p className="mt-1 break-words text-xs text-slate-500">
                      {row.cuit || "Sin CUIT"} · {row.ubicacion || "Sin ubicación"}
                    </p>
                  </td>
                  <td className="min-w-0 px-4 py-4">
                    <EstadoBadge row={row} />
                  </td>
                  <td className="min-w-0 px-4 py-4">
                    <p className="break-words font-semibold">
                      {row.plan || "Sin plan"}
                    </p>
                    <p className="mt-1 break-words text-xs text-slate-500">
                      {row.esTrial ? "Trial" : "Ciclo"}: {date(row.cicloInicio)} → {date(row.cicloFin)}
                    </p>
                    {row.diasParaVencer != null && row.diasParaVencer <= 7 ? (
                      <p className="mt-1 text-xs font-semibold text-blue-700">
                        Vence en {row.diasParaVencer} día(s)
                      </p>
                    ) : null}
                  </td>
                  <td className="min-w-0 px-4 py-4">
                    {row.acuerdo ? (
                      <>
                        <p className="font-medium">{money(row.acuerdo.precioNeto)}</p>
                        <p className="mt-1 break-words text-xs text-slate-500">
                          Hasta {date(row.acuerdo.fechaFin)}
                        </p>
                        {row.acuerdo.diasParaVencer != null &&
                        row.acuerdo.diasParaVencer <= 30 ? (
                          <p className="mt-1 break-words text-xs font-semibold text-amber-700">
                            Renegociar · {row.acuerdo.diasParaVencer} día(s)
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-slate-400">Sin acuerdo</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-slate-500">{date(row.creadaEn)}</td>
                  <td className="px-4 py-4 text-right">
                    <a
                      href={`/dashboard/admin/empresas/${row.id}`}
                      className="inline-flex rounded-lg border px-3 py-2 font-semibold hover:bg-slate-50"
                    >
                      Ver
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-slate-500">
            Página {data.page} de {pages}
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <a
              aria-disabled={data.page <= 1}
              href={data.page <= 1 ? "#" : href(data.page - 1)}
              className={`flex-1 rounded-xl border px-4 py-2 text-center text-sm sm:flex-none ${
                data.page <= 1 ? "pointer-events-none opacity-40" : ""
              }`}
            >
              Anterior
            </a>
            <a
              aria-disabled={data.page >= pages}
              href={data.page >= pages ? "#" : href(data.page + 1)}
              className={`flex-1 rounded-xl border px-4 py-2 text-center text-sm sm:flex-none ${
                data.page >= pages ? "pointer-events-none opacity-40" : ""
              }`}
            >
              Siguiente
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
