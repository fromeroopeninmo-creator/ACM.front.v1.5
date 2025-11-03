"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCashflowKpis,
  postCashflowSimularPeriodo,
  type CashflowKpisResponse,
} from "#lib/adminCashflowApi";
import { supabase } from "#lib/supabaseClient";

/* ================= Helpers ================= */
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function monthRangeToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const desde = `${first.getFullYear()}-${pad2(first.getMonth() + 1)}-${pad2(first.getDate())}`;
  const hasta = `${last.getFullYear()}-${pad2(last.getMonth() + 1)}-${pad2(last.getDate())}`;
  return { desde, hasta };
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
function fmtDateISO(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(d);
}
function withQuery(url: string, params?: Record<string, any>) {
  if (!params) return url;
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    usp.set(k, String(v));
  });
  const qs = usp.toString();
  return qs ? `${url}?${qs}` : url;
}

/* ============== Tipos locales (empresas resumen) ============== */
type EmpresaResumen = {
  empresa_id: string;
  empresa_nombre: string;
  cuit: string | null;

  plan_nombre: string | null;
  plan_activo: boolean;
  fecha_inicio: string | null;
  fecha_fin: string | null;

  ingresos_neto_periodo: number;
  ingresos_con_iva_periodo: number;
  mrr_neto_actual: number;

  movimientos_count: number;
  ultimo_movimiento: string | null;

  asesores_usados: number;
  cupo_plan: number;
  override: number | null;
  exceso: number;
};
type EmpresasPaged = {
  page: number;
  pageSize: number;
  total: number;
  items: EmpresaResumen[];
};

type PlanInfo = {
  id: string;
  nombre: string;
  precio: number;
  precio_extra_por_asesor: number;
};

/* =================== Componente =================== */
export default function CashflowClient() {
  // ======= Filtros / estado =======
  const { desde: mesDesde, hasta: mesHasta } = monthRangeToday();
  const [desde, setDesde] = useState(mesDesde);
  const [hasta, setHasta] = useState(mesHasta);

  // filtros de índice (resumen de empresas)
  const [q, setQ] = useState<string>("");
  const [plan, setPlan] = useState<string>("");
  const [estadoPlan, setEstadoPlan] = useState<"" | "activo" | "inactivo" | "todos">("todos");

  // paginación índice
  const [empPage, setEmpPage] = useState(1);
  const [empPageSize, setEmpPageSize] = useState(20);

  // data
  const [kpis, setKpis] = useState<CashflowKpisResponse | null>(null);
  const [empresas, setEmpresas] = useState<EmpresasPaged | null>(null);

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // planes (para corregir "Personalizado")
  const [planes, setPlanes] = useState<PlanInfo[]>([]);

  const canQuery = useMemo(() => !!desde && !!hasta, [desde, hasta]);

  /* ========= Fetch de planes (para cálculo Personalizado) ========= */
  useEffect(() => {
    const fetchPlanes = async () => {
      try {
        const { data, error } = await supabase
          .from("planes")
          .select("id, nombre, precio, precio_extra_por_asesor");

        if (error) {
          console.error("Error cargando planes (cashflow):", error);
          return;
        }

        setPlanes(
          (data || []).map((p: any) => ({
            id: String(p.id),
            nombre: String(p.nombre),
            precio: Number(p.precio ?? 0),
            precio_extra_por_asesor: Number(p.precio_extra_por_asesor ?? 0),
          }))
        );
      } catch (err) {
        console.error("Error cargando planes (cashflow):", err);
      }
    };

    fetchPlanes();
  }, []);

  /* ========= Fetch de KPIs + Empresas (índice) ========= */
  async function fetchAll() {
    if (!canQuery) return;
    setLoading(true);
    setErrMsg(null);
    try {
      // KPIs (globales del período)
      const k = await getCashflowKpis({
        desde,
        hasta,
      });
      setKpis(k);

      // Empresas (resumen del período)
      const url = withQuery("/api/admin/cashflow/empresas", {
        desde,
        hasta,
        q: q || undefined,
        plan: plan || undefined,
        estado_plan: estadoPlan || undefined,
        page: empPage,
        pageSize: empPageSize,
      });
      const res = await fetch(url, { method: "GET", cache: "no-store" });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`GET ${url} → ${res.status} ${res.statusText} ${body}`.trim());
      }
      const list = (await res.json()) as EmpresasPaged;
      setEmpresas(list);
    } catch (e: any) {
      setErrMsg(e?.message || "Error al cargar datos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, q, plan, estadoPlan, empPage, empPageSize]);

  /* ========= Acciones ========= */
  async function onSimularPeriodo() {
    if (!desde || !hasta) return;
    setLoading(true);
    setErrMsg(null);
    try {
      await postCashflowSimularPeriodo({
        desde,
        hasta,
        overwrite: false,
      });
      await fetchAll();
    } catch (e: any) {
      setErrMsg(e?.message || "No se pudo simular el período.");
    } finally {
      setLoading(false);
    }
  }

  /* ========= Helpers UI ========= */
  const totalEmpresas = empresas?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalEmpresas / empPageSize));
  function empresaDetalleHref(empresaId: string) {
    const usp = new URLSearchParams({ desde, hasta });
    return `/dashboard/admin/cashflow/${encodeURIComponent(empresaId)}?${usp.toString()}`;
  }

  // helper para calcular visualmente MRR/ingresos de un registro,
  // corrigiendo el caso "Personalizado" sin romper lo que viene del backend
  function computeRowAmounts(e: EmpresaResumen) {
    let mrr = e.mrr_neto_actual;
    let ingresosNeto = e.ingresos_neto_periodo;
    let ingresosIVA = e.ingresos_con_iva_periodo;

    const isPersonalizado = (e.plan_nombre || "").toLowerCase() === "personalizado";

    if (isPersonalizado && planes.length > 0) {
      const premium = planes.find((p) => p.nombre === "Premium");
      const personalizado = planes.find((p) => p.nombre === "Personalizado");

      if (premium && personalizado) {
        const override = e.override ?? e.cupo_plan; // máx. asesores contratados
        const overrideNum = Number(override ?? 0);

        if (overrideNum > 0) {
          const basePremium = Number(premium.precio ?? 0);
          const unitExtra = Number(personalizado.precio_extra_por_asesor ?? 0);

          // Igual que en el front de /planes: primeros 20 cubiertos por Premium
          const extraUnits = Math.max(0, overrideNum - 20);
          const personalizadoPrecio = basePremium + extraUnits * unitExtra;

          if (personalizadoPrecio > 0) {
            mrr = personalizadoPrecio;
            // Para el resumen, usamos el mismo valor como ingreso del período (visual)
            ingresosNeto = personalizadoPrecio;
            ingresosIVA = Math.round(personalizadoPrecio * 1.21);
          }
        }
      }
    }

    return { mrr, ingresosNeto, ingresosIVA };
  }

  /* =================== Render =================== */
  return (
    <section className="space-y-6">
      {/* Filtros del índice (empresas resumen) */}
      <div className="rounded-2xl border bg-white dark:bg-neutral-900 p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              className="rounded-md border px-3 py-2 bg-transparent"
              value={desde}
              onChange={(e) => {
                setEmpPage(1);
                setDesde(e.target.value);
              }}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              className="rounded-md border px-3 py-2 bg-transparent"
              value={hasta}
              onChange={(e) => {
                setEmpPage(1);
                setHasta(e.target.value);
              }}
            />
          </div>

          <div className="flex flex-col md:col-span-2">
            <label className="text-xs text-gray-500 mb-1">Buscar (empresa o CUIT)</label>
            <input
              type="text"
              placeholder="Nombre, razón social o CUIT"
              className="rounded-md border px-3 py-2 bg-transparent"
              value={q}
              onChange={(e) => {
                setEmpPage(1);
                setQ(e.target.value);
              }}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Plan</label>
            <input
              type="text"
              placeholder="Nombre exacto del plan"
              className="rounded-md border px-3 py-2 bg-transparent"
              value={plan}
              onChange={(e) => {
                setEmpPage(1);
                setPlan(e.target.value);
              }}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Estado plan</label>
            <select
              className="rounded-md border px-3 py-2 bg-transparent"
              value={estadoPlan}
              onChange={(e) => {
                setEmpPage(1);
                setEstadoPlan(e.target.value as any);
              }}
            >
              <option value="todos">Todos</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={fetchAll}
            disabled={loading || !canQuery}
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 transition disabled:opacity-60"
          >
            Aplicar filtros
          </button>
          <button
            onClick={onSimularPeriodo}
            disabled={loading || !canQuery}
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 transition disabled:opacity-60"
            title="Inserta movimientos simulados (subscription/extra_asesor) en el ledger para el rango"
          >
            Simular período (ledger)
          </button>

          {/* Export CSV (mismos filtros del listado de empresas) */}
          {(() => {
            const exportUrl = withQuery("/api/admin/cashflow/empresas/export", {
              desde,
              hasta,
              q: q || undefined,
              plan: plan || undefined,
              estado_plan: estadoPlan || undefined,
              page: empPage,
              pageSize: empPageSize,
            });
            const disabled = loading || !canQuery;
            return (
              <a
                href={disabled ? undefined : exportUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={disabled}
                className={`rounded-md border px-3 py-2 text-sm transition ${
                  disabled
                    ? "opacity-60 pointer-events-none"
                    : "hover:bg-gray-50 dark:hover:bg-neutral-800"
                }`}
              >
                Export CSV
              </a>
            );
          })()}

          {loading ? <span className="text-xs text-gray-500">Cargando…</span> : null}
          {errMsg ? <span className="text-xs text-red-600">{errMsg}</span> : null}
        </div>
      </div>

      {/* KPIs (globales del período) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
          <div className="text-xs text-gray-500">MRR (neto)</div>
          <div className="text-2xl font-semibold mt-1">{fmtMoney(kpis?.mrr_neto ?? 0)}</div>
          <div className="text-xs text-gray-400 mt-1">
            Rango: {kpis?.rango?.desde} → {kpis?.rango?.hasta}
          </div>
        </div>
        <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
          <div className="text-xs text-gray-500">Ingresos (neto) en el período</div>
          <div className="text-2xl font-semibold mt-1">
            {fmtMoney(kpis?.ingresos_neto_total ?? 0)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Visual con IVA: {fmtMoney(kpis ? kpis.ingresos_con_iva : 0)}
          </div>
        </div>
        <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
          <div className="text-xs text-gray-500">ARPU (neto)</div>
          <div className="text-2xl font-semibold mt-1">{fmtMoney(kpis?.arpu_neto ?? 0)}</div>
          <div className="text-xs text-gray-400 mt-1">
            Empresas activas: {fmtNumber(kpis?.empresas_activas ?? 0)}
          </div>
        </div>
        <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
          <div className="text-xs text-gray-500">Cambios (mes)</div>
          <div className="text-2xl font-semibold mt-1">
            {fmtNumber((kpis?.upgrades ?? 0) + (kpis?.downgrades ?? 0))}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Up: {fmtNumber(kpis?.upgrades ?? 0)} · Down: {fmtNumber(kpis?.downgrades ?? 0)}
          </div>
        </div>
      </section>

      {/* Empresas (resumen del período) */}
      <section className="rounded-2xl border bg-white dark:bg-neutral-900">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-base font-semibold">Empresas (resumen)</h2>
          <div className="text-xs text-gray-500">
            {fmtNumber(empresas?.items.length ?? 0)} / {fmtNumber(empresas?.total ?? 0)}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Vigencia</th>
                <th className="px-4 py-3 text-right">MRR neto</th>
                <th className="px-4 py-3 text-right">Ingresos neto</th>
                <th className="px-4 py-3 text-right">Total c/ IVA</th>
                <th className="px-4 py-3 text-right">Movs</th>
                <th className="px-4 py-3">Último mov.</th>
                <th className="px-4 py-3 text-right">Asesores</th>
                <th className="px-4 py-3 text-right">Cupo</th>
                <th className="px-4 py-3 text-right">Override</th>
                <th className="px-4 py-3 text-right">Exceso</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(empresas?.items ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={13}>
                    Sin resultados.
                  </td>
                </tr>
              ) : (
                empresas!.items.map((e) => {
                  const { mrr, ingresosNeto, ingresosIVA } = computeRowAmounts(e);

                  return (
                    <tr key={e.empresa_id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{e.empresa_nombre || "—"}</div>
                        <div className="text-xs text-gray-500">{e.cuit || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{e.plan_nombre || "—"}</span>
                          <span
                            className={
                              e.plan_activo
                                ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700"
                                : "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"
                            }
                          >
                            {e.plan_activo ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          {fmtDateISO(e.fecha_inicio)} → {fmtDateISO(e.fecha_fin)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">{fmtMoney(mrr)}</td>
                      <td className="px-4 py-3 text-right">{fmtMoney(ingresosNeto)}</td>
                      <td className="px-4 py-3 text-right">{fmtMoney(ingresosIVA)}</td>
                      <td className="px-4 py-3 text-right">{fmtNumber(e.movimientos_count)}</td>
                      <td className="px-4 py-3">{fmtDateISO(e.ultimo_movimiento)}</td>
                      <td className="px-4 py-3 text-right">{fmtNumber(e.asesores_usados)}</td>
                      <td className="px-4 py-3 text-right">{fmtNumber(e.cupo_plan)}</td>
                      <td className="px-4 py-3 text-right">{fmtNumber(e.override ?? 0)}</td>
                      <td className="px-4 py-3 text-right">
                        {e.exceso > 0 ? (
                          <span className="text-red-600 font-medium">
                            {fmtNumber(e.exceso)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={empresaDetalleHref(e.empresa_id)}
                          className="text-blue-600 hover:underline"
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

        {/* Paginación índice */}
        <div className="px-4 py-3 flex items-center justify-between border-t text-sm">
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border px-3 py-1 disabled:opacity-50"
              onClick={() => setEmpPage((p) => Math.max(1, p - 1))}
              disabled={loading || empPage <= 1}
            >
              ← Anterior
            </button>
            <span className="text-xs text-gray-600">
              Página {empPage} de {totalPages}
            </span>
            <button
              className="rounded-md border px-3 py-1 disabled:opacity-50"
              onClick={() => setEmpPage((p) => Math.min(totalPages, p + 1))}
              disabled={
                loading || (empresas?.items.length ?? 0) === 0 || empPage >= totalPages
              }
            >
              Siguiente →
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs">Por página</span>
            <select
              className="rounded-md border px-2 py-1 bg-transparent text-xs"
              value={empPageSize}
              onChange={(e) => {
                setEmpPage(1);
                setEmpPageSize(Number(e.target.value));
              }}
            >
              {[10, 20, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>
    </section>
  );
}
