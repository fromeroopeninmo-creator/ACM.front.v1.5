"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCashflowKpis,
  type CashflowKpisResponse,
} from "#lib/adminCashflowApi";

type EmpresaResumen = {
  empresa_id: string;
  empresa_nombre: string;
  cuit: string | null;
  plan_nombre: string | null;
  plan_activo: boolean;
  estado_acceso?: "activa" | "suspendida" | "sin_ciclo";
  fecha_inicio: string | null;
  fecha_fin: string | null;
  ingresos_neto_periodo: number;
  ingresos_con_iva_periodo: number;
  mrr_neto_actual: number;
  movimientos_count: number;
  ultimo_movimiento: string | null;
};

type EmpresasPaged = {
  page: number;
  pageSize: number;
  total: number;
  items: EmpresaResumen[];
};

type PeriodoRapido = "mes" | "3m" | "6m" | "12m" | "personalizado";

const pad = (n: number) => String(n).padStart(2, "0");

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function rangeFor(periodo: Exclude<PeriodoRapido, "personalizado">) {
  const now = new Date();
  const hasta = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (periodo === "mes") {
    return {
      desde: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
      hasta: toDateInput(hasta),
    };
  }
  const months = periodo === "3m" ? 3 : periodo === "6m" ? 6 : 12;
  const desde = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  return { desde: toDateInput(desde), hasta: toDateInput(hasta) };
}

const money = (n?: number | null) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(n ?? 0));

const date = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(parsed);
};

export default function CashflowClient() {
  const initial = rangeFor("mes");
  const [periodo, setPeriodo] = useState<PeriodoRapido>("mes");
  const [desde, setDesde] = useState(initial.desde);
  const [hasta, setHasta] = useState(initial.hasta);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [kpis, setKpis] = useState<CashflowKpisResponse | null>(null);
  const [empresas, setEmpresas] = useState<EmpresasPaged | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canQuery = useMemo(() => Boolean(desde && hasta), [desde, hasta]);

  function selectPeriodo(next: Exclude<PeriodoRapido, "personalizado">) {
    const range = rangeFor(next);
    setPeriodo(next);
    setPage(1);
    setDesde(range.desde);
    setHasta(range.hasta);
  }

  async function load() {
    if (!canQuery) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        desde,
        hasta,
        page: String(page),
        pageSize: String(pageSize),
        estado_plan: estado,
      });
      if (q.trim()) params.set("q", q.trim());

      const [nextKpis, response] = await Promise.all([
        getCashflowKpis({ desde, hasta }),
        fetch(`/api/admin/cashflow/empresas?${params.toString()}`, {
          cache: "no-store",
        }),
      ]);

      if (!response.ok) throw new Error(await response.text());
      setKpis(nextKpis);
      setEmpresas(await response.json());
    } catch (cause: any) {
      setError(cause?.message ?? "No se pudo cargar cashflow.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, estado, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil((empresas?.total ?? 0) / pageSize));

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border bg-white p-4 dark:bg-neutral-900">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-500">
            Período
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              ["mes", "Mes actual"],
              ["3m", "Últimos 3 meses"],
              ["6m", "Últimos 6 meses"],
              ["12m", "Último año"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  selectPeriodo(
                    value as Exclude<PeriodoRapido, "personalizado">,
                  )
                }
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  periodo === value
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "bg-white hover:bg-slate-50 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label>
            <span className="mb-1 block text-xs text-slate-500">Desde</span>
            <input
              type="date"
              value={desde}
              onChange={(event) => {
                setPeriodo("personalizado");
                setPage(1);
                setDesde(event.target.value);
              }}
              className="w-full rounded-xl border bg-transparent px-3 py-2.5"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs text-slate-500">Hasta</span>
            <input
              type="date"
              value={hasta}
              onChange={(event) => {
                setPeriodo("personalizado");
                setPage(1);
                setHasta(event.target.value);
              }}
              className="w-full rounded-xl border bg-transparent px-3 py-2.5"
            />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs text-slate-500">
              Buscar empresa
            </span>
            <input
              value={q}
              onChange={(event) => {
                setPage(1);
                setQ(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") load();
              }}
              placeholder="Nombre o CUIT"
              className="w-full rounded-xl border bg-transparent px-3 py-2.5"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs text-slate-500">Estado</span>
            <select
              value={estado}
              onChange={(event) => {
                setPage(1);
                setEstado(event.target.value);
              }}
              className="w-full rounded-xl border bg-transparent px-3 py-2.5"
            >
              <option value="todos">Todos</option>
              <option value="activo">Activa</option>
              <option value="inactivo">Suspendida / sin ciclo</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Aplicar filtros
          </button>
          {periodo === "personalizado" ? (
            <span className="self-center rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
              Período personalizado
            </span>
          ) : null}
          {loading ? (
            <span className="self-center text-xs text-slate-500">
              Cargando…
            </span>
          ) : null}
          {error ? (
            <span className="self-center text-xs text-red-600">{error}</span>
          ) : null}
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border bg-white p-4 dark:bg-neutral-900">
          <p className="text-xs text-slate-500">Ingresos netos acreditados</p>
          <p className="mt-2 text-2xl font-bold">
            {money(kpis?.ingresos_neto_total)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Dinero realmente cobrado en el período
          </p>
        </article>
        <article className="rounded-2xl border bg-white p-4 dark:bg-neutral-900">
          <p className="text-xs text-slate-500">Total cobrado</p>
          <p className="mt-2 text-2xl font-bold">
            {money(kpis?.ingresos_con_iva)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Incluye IVA cuando corresponde
          </p>
        </article>
        <article className="rounded-2xl border bg-white p-4 dark:bg-neutral-900">
          <p className="text-xs text-slate-500">
            Valor mensual de ciclos vigentes
          </p>
          <p className="mt-2 text-2xl font-bold">{money(kpis?.mrr_neto)}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Proyección mensual basada en ciclos pagos que hoy están activos. No
            representa dinero cobrado en el período.
          </p>
        </article>
        <article className="rounded-2xl border bg-white p-4 dark:bg-neutral-900">
          <p className="text-xs text-slate-500">Empresas que pagaron</p>
          <p className="mt-2 text-2xl font-bold">
            {kpis?.empresas_activas ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Con al menos un pago acreditado en el período
          </p>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="font-semibold">Empresas</h2>
            <p className="text-xs text-slate-500">
              Resumen mínimo; abrí cada empresa para ver movimientos y ciclos.
            </p>
          </div>
          <span className="text-xs text-slate-500">{empresas?.total ?? 0}</span>
        </div>
        <div className="divide-y">
          {(empresas?.items ?? []).length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Sin resultados.</p>
          ) : (
            (empresas?.items ?? []).map((empresa) => (
              <article
                key={empresa.empresa_id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-neutral-800"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold">
                      {empresa.empresa_nombre}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        empresa.estado_acceso === "activa"
                          ? "bg-emerald-50 text-emerald-700"
                          : empresa.estado_acceso === "suspendida"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {empresa.estado_acceso === "activa"
                        ? "Activa"
                        : empresa.estado_acceso === "suspendida"
                          ? "Suspendida"
                          : "Sin ciclo"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {empresa.plan_nombre || "Sin plan vigente"} · Ciclo hasta{" "}
                    {date(empresa.fecha_fin)}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                    Cobrado: {money(empresa.ingresos_neto_periodo)} ·{" "}
                    {empresa.movimientos_count} pago(s)
                  </p>
                </div>
                <a
                  href={`/dashboard/admin/cashflow/${encodeURIComponent(empresa.empresa_id)}?desde=${desde}&hasta=${hasta}`}
                  className="shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Ver detalle
                </a>
              </article>
            ))
          )}
        </div>
      </section>

      <footer className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">
            Página {page} de {totalPages}
          </span>
          <select
            value={pageSize}
            onChange={(event) => {
              setPage(1);
              setPageSize(Number(event.target.value));
            }}
            className="rounded-lg border bg-transparent px-2 py-1 text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
            className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </footer>
    </section>
  );
}
