"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCashflowKpis,
  getCashflowMovimientos,
  getCashflowSuscripciones,
  postCashflowSimularPeriodo,
  type CashflowKpisResponse,
  type MovimientosResponse,
  type SuscripcionesResponse,
  type MovimientoItem,
  type SuscripcionItem,
} from "@/lib/adminCashflowApi";

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

type Estado = "pending" | "paid" | "failed" | "refunded" | "";
type Tipo = "subscription" | "extra_asesor" | "ajuste" | "";

export default function CashflowClient() {
  // ======= Filtros / estado =======
  const { desde: mesDesde, hasta: mesHasta } = monthRangeToday();
  const [desde, setDesde] = useState(mesDesde);
  const [hasta, setHasta] = useState(mesHasta);

  const [empresaId, setEmpresaId] = useState<string>("");
  const [pasarela, setPasarela] = useState<string>("");
  const [estado, setEstado] = useState<Estado>("");
  const [tipo, setTipo] = useState<Tipo>("");

  // paginación
  const [movPage, setMovPage] = useState(1);
  const [movPageSize, setMovPageSize] = useState(20);

  const [subPage, setSubPage] = useState(1);
  const [subPageSize, setSubPageSize] = useState(20);

  // data
  const [kpis, setKpis] = useState<CashflowKpisResponse | null>(null);
  const [movs, setMovs] = useState<MovimientosResponse | null>(null);
  const [subs, setSubs] = useState<SuscripcionesResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // ======= Fetch principal =======
  const canQuery = useMemo(() => !!desde && !!hasta, [desde, hasta]);

  async function fetchAll() {
    if (!canQuery) return;
    setLoading(true);
    setErrMsg(null);
    try {
      const [k, m, s] = await Promise.all([
        getCashflowKpis({ desde, hasta, empresaId: empresaId || undefined }),
        getCashflowMovimientos({
          desde,
          hasta,
          empresaId: empresaId || undefined,
          pasarela: pasarela || undefined,
          estado: (estado || undefined) as any,
          tipo: (tipo || undefined) as any,
          page: movPage,
          pageSize: movPageSize,
        }),
        getCashflowSuscripciones({
          desde,
          hasta,
          empresaId: empresaId || undefined,
          estado: "todos",
          page: subPage,
          pageSize: subPageSize,
        }),
      ]);
      setKpis(k);
      setMovs(m);
      setSubs(s);
    } catch (e: any) {
      setErrMsg(e?.message || "Error al cargar datos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, empresaId, pasarela, estado, tipo, movPage, movPageSize, subPage, subPageSize]);

  // ======= Acciones =======
  async function onSimularPeriodo() {
    if (!desde || !hasta) return;
    setLoading(true);
    setErrMsg(null);
    try {
      // inserta movimientos simulados (subscription/extra_asesor) en ledger
      await postCashflowSimularPeriodo({
        desde,
        hasta,
        empresaId: empresaId || undefined,
        overwrite: false,
      });
      // recargar
      await fetchAll();
    } catch (e: any) {
      setErrMsg(e?.message || "No se pudo simular el período.");
    } finally {
      setLoading(false);
    }
  }

  // ======= Render =======
  return (
    <section className="space-y-6">
      {/* Filtros */}
      <div className="rounded-2xl border bg-white dark:bg-neutral-900 p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              className="rounded-md border px-3 py-2 bg-transparent"
              value={desde}
              onChange={(e) => {
                setMovPage(1);
                setSubPage(1);
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
                setMovPage(1);
                setSubPage(1);
                setHasta(e.target.value);
              }}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Empresa ID (opcional)</label>
            <input
              type="text"
              placeholder="uuid empresa"
              className="rounded-md border px-3 py-2 bg-transparent"
              value={empresaId}
              onChange={(e) => {
                setMovPage(1);
                setSubPage(1);
                setEmpresaId(e.target.value.trim());
              }}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Pasarela</label>
            <select
              className="rounded-md border px-3 py-2 bg-transparent"
              value={pasarela}
              onChange={(e) => {
                setMovPage(1);
                setPasarela(e.target.value);
              }}
            >
              <option value="">Todas</option>
              <option value="simulada">Simulada</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="stripe">Stripe</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Estado</label>
            <select
              className="rounded-md border px-3 py-2 bg-transparent"
              value={estado}
              onChange={(e) => {
                setMovPage(1);
                setEstado(e.target.value as Estado);
              }}
            >
              <option value="">Todos</option>
              <option value="paid">Pagado</option>
              <option value="pending">Pendiente</option>
              <option value="failed">Fallido</option>
              <option value="refunded">Reembolsado</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Tipo</label>
            <select
              className="rounded-md border px-3 py-2 bg-transparent"
              value={tipo}
              onChange={(e) => {
                setMovPage(1);
                setTipo(e.target.value as Tipo);
              }}
            >
              <option value="">Todos</option>
              <option value="subscription">Subscription</option>
              <option value="extra_asesor">Extra asesor</option>
              <option value="ajuste">Ajuste</option>
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
          {loading ? <span className="text-xs text-gray-500">Cargando…</span> : null}
          {errMsg ? <span className="text-xs text-red-600">{errMsg}</span> : null}
        </div>
      </div>

      {/* KPIs */}
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
          <div className="text-2xl font-semibold mt-1">{fmtMoney(kpis?.ingresos_neto_total ?? 0)}</div>
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

      {/* Movimientos */}
      <section className="rounded-2xl border bg-white dark:bg-neutral-900">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-base font-semibold">Movimientos</h2>
          <div className="text-xs text-gray-500">
            {fmtNumber(movs?.items.length ?? 0)} / {fmtNumber(movs?.total ?? 0)}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Concepto</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Neto</th>
                <th className="px-4 py-3 text-right">IVA 21%</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(movs?.items ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={8}>
                    Sin movimientos.
                  </td>
                </tr>
              ) : (
                movs!.items.map((m: MovimientoItem) => (
                  <tr key={(m.id || `${m.empresa_id}-${m.fecha}-${m.tipo}`)} className="border-b last:border-0">
                    <td className="px-4 py-3">{fmtDateISO(m.fecha)}</td>
                    <td className="px-4 py-3">{m.empresa_nombre || "—"}</td>
                    <td className="px-4 py-3 capitalize">{m.tipo}</td>
                    <td className="px-4 py-3">{m.concepto || "—"}</td>
                    <td className="px-4 py-3 uppercase text-xs">{m.estado}</td>
                    <td className="px-4 py-3 text-right">{fmtMoney(m.monto_neto)}</td>
                    <td className="px-4 py-3 text-right">{fmtMoney(m.iva_21)}</td>
                    <td className="px-4 py-3 text-right">{fmtMoney(m.total_con_iva)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Paginación movimientos */}
        <div className="px-4 py-3 flex items-center justify-between border-t text-sm">
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border px-3 py-1 disabled:opacity-50"
              onClick={() => setMovPage((p) => Math.max(1, p - 1))}
              disabled={loading || (movPage <= 1)}
            >
              ← Anterior
            </button>
            <span className="text-xs text-gray-600">Página {movPage}</span>
            <button
              className="rounded-md border px-3 py-1 disabled:opacity-50"
              onClick={() => {
                const total = movs?.total ?? 0;
                const maxPage = Math.max(1, Math.ceil(total / movPageSize));
                setMovPage((p) => Math.min(maxPage, p + 1));
              }}
              disabled={loading || ((movs?.items.length ?? 0) === 0)}
            >
              Siguiente →
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs">Por página</span>
            <select
              className="rounded-md border px-2 py-1 bg-transparent text-xs"
              value={movPageSize}
              onChange={(e) => {
                setMovPage(1);
                setMovPageSize(Number(e.target.value));
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

      {/* Suscripciones */}
      <section className="rounded-2xl border bg-white dark:bg-neutral-900">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-base font-semibold">Suscripciones</h2>
          <div className="text-xs text-gray-500">
            {fmtNumber(subs?.items.length ?? 0)} / {fmtNumber(subs?.total ?? 0)}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Inicio</th>
                <th className="px-4 py-3">Fin</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Cupo plan</th>
                <th className="px-4 py-3 text-right">Override</th>
                <th className="px-4 py-3 text-right">Usados</th>
                <th className="px-4 py-3 text-right">Exceso</th>
              </tr>
            </thead>
            <tbody>
              {(subs?.items ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={9}>
                    Sin suscripciones.
                  </td>
                </tr>
              ) : (
                subs!.items.map((s: SuscripcionItem) => (
                  <tr key={`${s.empresa_id}-${s.plan_id}-${s.fecha_inicio || "null"}`} className="border-b last:border-0">
                    <td className="px-4 py-3">{s.empresa_nombre}</td>
                    <td className="px-4 py-3">{s.plan_nombre}</td>
                    <td className="px-4 py-3">{fmtDateISO(s.fecha_inicio)}</td>
                    <td className="px-4 py-3">{fmtDateISO(s.fecha_fin)}</td>
                    <td className="px-4 py-3">
                      {s.activo ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-xs">activo</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-xs">inactivo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{fmtNumber(s.max_asesores_plan)}</td>
                    <td className="px-4 py-3 text-right">{fmtNumber(s.max_asesores_override ?? 0)}</td>
                    <td className="px-4 py-3 text-right">{fmtNumber(s.asesores_utilizados)}</td>
                    <td className="px-4 py-3 text-right">
                      {s.cupo_excedido > 0 ? (
                        <span className="text-red-600 font-medium">{fmtNumber(s.cupo_excedido)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Paginación suscripciones */}
        <div className="px-4 py-3 flex items-center justify-between border-t text-sm">
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border px-3 py-1 disabled:opacity-50"
              onClick={() => setSubPage((p) => Math.max(1, p - 1))}
              disabled={loading || (subPage <= 1)}
            >
              ← Anterior
            </button>
            <span className="text-xs text-gray-600">Página {subPage}</span>
            <button
              className="rounded-md border px-3 py-1 disabled:opacity-50"
              onClick={() => {
                const total = subs?.total ?? 0;
                const maxPage = Math.max(1, Math.ceil(total / subPageSize));
                setSubPage((p) => Math.min(maxPage, p + 1));
              }}
              disabled={loading || ((subs?.items.length ?? 0) === 0)}
            >
              Siguiente →
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs">Por página</span>
            <select
              className="rounded-md border px-2 py-1 bg-transparent text-xs"
              value={subPageSize}
              onChange={(e) => {
                setSubPage(1);
                setSubPageSize(Number(e.target.value));
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
