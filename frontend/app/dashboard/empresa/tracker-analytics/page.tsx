"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

type Range = "30d" | "90d" | "180d" | "365d";
type AnalyticsTab = "resumen" | "tipologias" | "ingresos" | "actividades";

interface TrackerPropiedad {
  id: string;
  empresa_id: string;
  contacto_id: string | null;
  tipologia: string | null;
  tipo_operacion: string | null;
  direccion: string | null;
  zona: string | null;
  m2_lote: number | null;
  m2_cubiertos: number | null;
  precio_lista_inicial: number | null;
  precio_actual: number | null;
  precio_cierre: number | null;
  moneda: string | null;
  fecha_inicio_comercializacion: string | null;
  fecha_cierre: string | null;
  created_at: string;
  updated_at: string;
  honorarios_comprador_pct: number | null;
  honorarios_vendedor_pct: number | null;
  empresa_share_pct: number | null;
}

interface TrackerActividad {
  id: string;
  empresa_id: string;
  contacto_id: string | null;
  titulo: string;
  tipo:
    | "seguimiento"
    | "reunion"
    | "muestra"
    | "prelisting"
    | "vai"
    | "factibilidad"
    | "reserva"
    | "cierre";
  fecha_programada: string; // YYYY-MM-DD
  hora: string | null; // HH:mm
  notas: string | null;
  created_at: string;
  updated_at: string;
}

function startOfRange(range: Range): Date {
  const now = new Date();
  const d = new Date(now);
  if (range === "30d") d.setDate(d.getDate() - 30);
  if (range === "90d") d.setDate(d.getDate() - 90);
  if (range === "180d") d.setDate(d.getDate() - 180);
  if (range === "365d") d.setDate(d.getDate() - 365);
  return d;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

function diffDays(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function fmtCurrencyARS(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPercent(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function EmpresaTrackerAnalyticsPage() {
  const { user } = useAuth();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [propiedades, setPropiedades] = useState<TrackerPropiedad[]>([]);
  const [actividades, setActividades] = useState<TrackerActividad[]>([]);

  const [range, setRange] = useState<Range>("180d");
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("resumen");
  const [mensaje, setMensaje] = useState<string | null>(null);

  const showMessage = (text: string) => {
    setMensaje(text);
    setTimeout(() => setMensaje(null), 3200);
  };

  // 1) Buscar empresa_id desde profile
  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!user?.id) {
        setEmpresaId(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error buscando empresa para tracker analítico:", error);
        setEmpresaId(null);
        setLoading(false);
        showMessage("❌ No se pudo obtener la empresa.");
        return;
      }

      setEmpresaId(data?.id ?? null);
      setLoading(false);
    };

    fetchEmpresa();
  }, [user]);

  // 2) Carga de datos del tracker (propiedades + actividades)
  useEffect(() => {
    if (!empresaId) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        const [{ data: pData, error: pError }, { data: aData, error: aError }] =
          await Promise.all([
            supabase
              .from("tracker_propiedades")
              .select(
                `
              id,
              empresa_id,
              contacto_id,
              tipologia,
              tipo_operacion,
              direccion,
              zona,
              m2_lote,
              m2_cubiertos,
              precio_lista_inicial,
              precio_actual,
              precio_cierre,
              moneda,
              fecha_inicio_comercializacion,
              fecha_cierre,
              created_at,
              updated_at,
              honorarios_comprador_pct,
              honorarios_vendedor_pct,
              empresa_share_pct
            `
              )
              .eq("empresa_id", empresaId),

            supabase
              .from("tracker_actividades")
              .select(
                `
              id,
              empresa_id,
              contacto_id,
              titulo,
              tipo,
              fecha_programada,
              hora,
              notas,
              created_at,
              updated_at
            `
              )
              .eq("empresa_id", empresaId),
          ]);

        if (pError) {
          console.error("Error cargando propiedades para tracker analítico:", pError);
          showMessage("❌ No se pudieron cargar las propiedades.");
        } else {
          setPropiedades((pData as TrackerPropiedad[]) ?? []);
        }

        if (aError) {
          console.error("Error cargando actividades para tracker analítico:", aError);
          showMessage("❌ No se pudieron cargar las actividades.");
        } else {
          setActividades((aData as TrackerActividad[]) ?? []);
        }
      } catch (err) {
        console.error("Error general cargando datos del tracker analítico:", err);
        showMessage("❌ Error inesperado al cargar datos.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [empresaId]);

  const startDate = useMemo(() => startOfRange(range), [range]);
  const endDate = useMemo(() => new Date(), []);
  const startKey = useMemo(() => toDateKey(startDate), [startDate]);
  const endKey = useMemo(() => toDateKey(endDate), [endDate]);

  // --- Filtrados base ---

  // Propiedades listadas en el período (para tasa de absorción)
  const propiedadesListadasEnRango = useMemo(() => {
    return propiedades.filter((p) => {
      const inicio = parseDate(p.fecha_inicio_comercializacion);
      if (!inicio) return false;
      // listadas si el inicio es <= fin y (no cerrada o cierre >= inicio del rango)
      const cierre = parseDate(p.fecha_cierre);
      const inicioKey = toDateKey(inicio);
      const cierreKey = cierre ? toDateKey(cierre) : null;

      const condicionInicio = inicioKey <= endKey;
      const condicionCierre =
        !cierreKey || cierreKey >= startKey;

      return condicionInicio && condicionCierre;
    });
  }, [propiedades, startKey, endKey]);

  // Propiedades cerradas en el período
  const propiedadesCerradasEnRango = useMemo(() => {
    return propiedades.filter((p) => {
      if (!p.fecha_cierre) return false;
      const cierre = parseDate(p.fecha_cierre);
      if (!cierre) return false;
      const cierreKey = toDateKey(cierre);
      return cierreKey >= startKey && cierreKey <= endKey;
    });
  }, [propiedades, startKey, endKey]);

  // Actividades en el período (por fecha_programada)
  const actividadesEnRango = useMemo(() => {
    return actividades.filter((a) => {
      if (!a.fecha_programada) return false;
      const key = a.fecha_programada;
      return key >= startKey && key <= endKey;
    });
  }, [actividades, startKey, endKey]);

  // --- KPIs principales ---

  const kpis = useMemo(() => {
    let volumenTotal = 0;
    let honorariosTotales = 0;
    let honorariosEmpresa = 0;
    let honorariosAsesores = 0;
    let sumaDiasEnVenta = 0;
    let countDiasEnVenta = 0;

    for (const p of propiedadesCerradasEnRango) {
      const precioCierre = p.precio_cierre ?? 0;
      if (precioCierre > 0) {
        volumenTotal += precioCierre;

        const pctComprador = p.honorarios_comprador_pct ?? 0;
        const pctVendedor = p.honorarios_vendedor_pct ?? 0;
        const totalPct = pctComprador + pctVendedor;

        if (totalPct > 0) {
          const honorariosProp = (precioCierre * totalPct) / 100;
          const shareEmpresaPct = p.empresa_share_pct ?? 40; // default 40% empresa
          const shareEmpresa = shareEmpresaPct / 100;

          const empresaProp = honorariosProp * shareEmpresa;
          const asesorProp = honorariosProp - empresaProp;

          honorariosTotales += honorariosProp;
          honorariosEmpresa += empresaProp;
          honorariosAsesores += asesorProp;
        }
      }

      const inicio = parseDate(p.fecha_inicio_comercializacion);
      const cierre = parseDate(p.fecha_cierre);
      if (inicio && cierre) {
        const dias = diffDays(inicio, cierre);
        if (dias >= 0) {
          sumaDiasEnVenta += dias;
          countDiasEnVenta += 1;
        }
      }
    }

    const promedioDiasEnVenta =
      countDiasEnVenta > 0 ? sumaDiasEnVenta / countDiasEnVenta : 0;

    const totalListadas = propiedadesListadasEnRango.length;
    const totalCerradas = propiedadesCerradasEnRango.length;
    const tasaAbsorcion =
      totalListadas > 0 ? (totalCerradas / totalListadas) * 100 : 0;

    return {
      operaciones: totalCerradas,
      volumenTotal,
      honorariosTotales,
      honorariosEmpresa,
      honorariosAsesores,
      promedioDiasEnVenta,
      tasaAbsorcion,
      listadas: totalListadas,
    };
  }, [propiedadesCerradasEnRango, propiedadesListadasEnRango]);

  // --- “Market share interno” por tipología ---

  const tipologiaStats = useMemo(() => {
    const map = new Map<
      string,
      { count: number; volumen: number; honorariosTotal: number }
    >();

    for (const p of propiedadesCerradasEnRango) {
      const key = p.tipologia || "Sin tipología";
      const precioCierre = p.precio_cierre ?? 0;
      const pctComprador = p.honorarios_comprador_pct ?? 0;
      const pctVendedor = p.honorarios_vendedor_pct ?? 0;
      const totalPct = pctComprador + pctVendedor;
      const honorariosProp =
        totalPct > 0 && precioCierre > 0
          ? (precioCierre * totalPct) / 100
          : 0;

      const prev = map.get(key) || { count: 0, volumen: 0, honorariosTotal: 0 };
      prev.count += 1;
      prev.volumen += precioCierre;
      prev.honorariosTotal += honorariosProp;
      map.set(key, prev);
    }

    const totalCount = Array.from(map.values()).reduce(
      (acc, v) => acc + v.count,
      0
    );

    const entries = Array.from(map.entries()).map(([tipologia, v]) => ({
      tipologia,
      ...v,
      porcentaje: totalCount > 0 ? (v.count / totalCount) * 100 : 0,
    }));

    entries.sort((a, b) => b.count - a.count);
    return entries;
  }, [propiedadesCerradasEnRango]);

  // --- Ingresos por mes ---

  const ingresosPorMes = useMemo(() => {
    const map = new Map<
      string,
      {
        volumen: number;
        honorariosTotales: number;
        honorariosEmpresa: number;
        honorariosAsesores: number;
      }
    >();

    for (const p of propiedadesCerradasEnRango) {
      const cierre = parseDate(p.fecha_cierre);
      if (!cierre) continue;
      const key = monthKey(cierre);

      const precioCierre = p.precio_cierre ?? 0;
      const pctComprador = p.honorarios_comprador_pct ?? 0;
      const pctVendedor = p.honorarios_vendedor_pct ?? 0;
      const totalPct = pctComprador + pctVendedor;
      const honorariosProp =
        totalPct > 0 && precioCierre > 0
          ? (precioCierre * totalPct) / 100
          : 0;

      const shareEmpresaPct = p.empresa_share_pct ?? 40;
      const shareEmpresa = shareEmpresaPct / 100;
      const empresaProp = honorariosProp * shareEmpresa;
      const asesorProp = honorariosProp - empresaProp;

      const prev =
        map.get(key) || {
          volumen: 0,
          honorariosTotales: 0,
          honorariosEmpresa: 0,
          honorariosAsesores: 0,
        };

      prev.volumen += precioCierre;
      prev.honorariosTotales += honorariosProp;
      prev.honorariosEmpresa += empresaProp;
      prev.honorariosAsesores += asesorProp;

      map.set(key, prev);
    }

    const entries = Array.from(map.entries())
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => (a.month < b.month ? -1 : 1));

    return entries;
  }, [propiedadesCerradasEnRango]);

  // --- Actividades diarias ---

  const actividadesPorDia = useMemo(() => {
    const map = new Map<string, number>();

    for (const a of actividadesEnRango) {
      const key = a.fecha_programada;
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    const entries = Array.from(map.entries())
      .map(([fecha, count]) => ({ fecha, count }))
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

    return entries;
  }, [actividadesEnRango]);

  if (loading && !empresaId) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-500">
        Cargando tracker de resultados…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Encabezado */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Tracker de resultados de la empresa
            </h1>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              Analizá tus cierres, honorarios y velocidad de venta. Toda la
              información viene de tu Agenda de Actividades y de las propiedades
              captadas/cerradas.
            </p>
          </div>

          {/* Filtros rápidos */}
          <div className="flex flex-col items-end gap-2">
            <label className="text-[11px] text-slate-500">
              Rango de análisis
            </label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as Range)}
              className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700"
            >
              <option value="30d">Últimos 30 días</option>
              <option value="90d">Últimos 3 meses</option>
              <option value="180d">Últimos 6 meses</option>
              <option value="365d">Último año</option>
            </select>
          </div>
        </header>

        {/* Tabs de vista */}
        <nav className="flex flex-wrap gap-2 text-sm">
          {[
            { id: "resumen", label: "Resumen general" },
            { id: "tipologias", label: "Tipologías / Mix" },
            { id: "ingresos", label: "Ingresos empresa vs asesores" },
            { id: "actividades", label: "Actividades diarias" },
          ].map((tab) => {
            const isActive = activeTab === (tab.id as AnalyticsTab);
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AnalyticsTab)}
                className={`rounded-full px-4 py-1.5 border text-sm transition ${
                  isActive
                    ? "bg-black text-white border-black"
                    : "bg-white text-slate-700 border-gray-300 hover:bg-gray-100"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* TAB: RESUMEN */}
        {activeTab === "resumen" && (
          <section className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-slate-500">Operaciones cerradas</p>
                <p className="mt-1 text-3xl font-semibold text-slate-900">
                  {kpis.operaciones}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  En el período seleccionado.
                </p>
              </div>

              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-slate-500">
                  Volumen total de cierres
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {fmtCurrencyARS(kpis.volumenTotal)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Suma de precios de cierre.
                </p>
              </div>

              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-slate-500">
                  Tasa de absorción del período
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {fmtPercent(kpis.tasaAbsorcion)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {kpis.listadas} propiedades listadas /{" "}
                  {kpis.operaciones} cierres.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-slate-500">
                  Honorarios totales (comprador + vendedor)
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {fmtCurrencyARS(kpis.honorariosTotales)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Calculados sobre el precio de cierre y % cargados.
                </p>
              </div>

              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-slate-500">Para la empresa</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-700">
                  {fmtCurrencyARS(kpis.honorariosEmpresa)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Según porcentaje de participación de la empresa en cada
                  operación.
                </p>
              </div>

              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-slate-500">Para asesores</p>
                <p className="mt-1 text-2xl font-semibold text-sky-700">
                  {fmtCurrencyARS(kpis.honorariosAsesores)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Honorarios netos para los agentes.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-slate-500">
                  Días promedio en venta (desde inicio comercialización a
                  cierre)
                </p>
                <p className="mt-1 text-3xl font-semibold text-slate-900">
                  {kpis.promedioDiasEnVenta > 0
                    ? `${Math.round(kpis.promedioDiasEnVenta)} días`
                    : "—"}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Solo se consideran propiedades con fecha de inicio y fecha de
                  cierre cargadas.
                </p>
              </div>

              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-slate-500">
                  Mix de tipologías (ver detalle en la pestaña Tipologías)
                </p>
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto text-[11px]">
                  {tipologiaStats.length === 0 && (
                    <p className="text-slate-500 text-xs">
                      Todavía no hay cierres en el período.
                    </p>
                  )}
                  {tipologiaStats.map((t) => (
                    <div key={t.tipologia} className="flex items-center gap-2">
                      <span className="w-32 truncate text-slate-700">
                        {t.tipologia}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(t.porcentaje, 100)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-slate-500">
                        {t.count} ({t.porcentaje.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB: TIPOLOGÍAS */}
        {activeTab === "tipologias" && (
          <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Mix por tipología (cierres)
                </h2>
                <p className="text-xs text-slate-500">
                  No es un market share de todo el mercado, sino la
                  distribución interna de tus operaciones cerradas en el
                  período.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {tipologiaStats.length === 0 && (
                <p className="text-xs text-slate-500">
                  No hay operaciones cerradas en el período seleccionado.
                </p>
              )}

              {tipologiaStats.map((t) => (
                <div
                  key={t.tipologia}
                  className="rounded-xl border border-gray-100 p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium text-xs text-slate-900">
                      {t.tipologia}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {t.count} operaciones · {t.porcentaje.toFixed(1)}%
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-emerald-500"
                        style={{
                          width: `${Math.min(t.porcentaje, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-[11px] text-slate-600">
                    <span>
                      Volumen:{" "}
                      <strong>{fmtCurrencyARS(t.volumen)}</strong>
                    </span>
                    <span>
                      Honorarios totales:{" "}
                      <strong>{fmtCurrencyARS(t.honorariosTotal)}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB: INGRESOS */}
        {activeTab === "ingresos" && (
          <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Ingresos por mes: empresa vs asesores
                </h2>
                <p className="text-xs text-slate-500">
                  Basado en el porcentaje de honorarios cargados en cada
                  propiedad y en el % de participación de la empresa.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-[11px] text-slate-500">
                    <th className="px-3 py-2 text-left font-medium">Mes</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Volumen cierres
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Honorarios totales
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Empresa
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Asesores
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ingresosPorMes.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-xs text-slate-500"
                      >
                        No hay cierres en el período seleccionado.
                      </td>
                    </tr>
                  )}
                  {ingresosPorMes.map((row) => (
                    <tr
                      key={row.month}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-3 py-2 align-top text-slate-800">
                        {row.month}
                      </td>
                      <td className="px-3 py-2 align-top text-right text-slate-700">
                        {fmtCurrencyARS(row.volumen)}
                      </td>
                      <td className="px-3 py-2 align-top text-right text-slate-700">
                        {fmtCurrencyARS(row.honorariosTotales)}
                      </td>
                      <td className="px-3 py-2 align-top text-right text-emerald-700">
                        {fmtCurrencyARS(row.honorariosEmpresa)}
                      </td>
                      <td className="px-3 py-2 align-top text-right text-sky-700">
                        {fmtCurrencyARS(row.honorariosAsesores)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {ingresosPorMes.length > 0 && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-[11px] text-slate-500 mb-2">
                    Empresa vs asesores (último mes con datos)
                  </p>
                  {(() => {
                    const last = ingresosPorMes[ingresosPorMes.length - 1];
                    const total =
                      last.honorariosEmpresa + last.honorariosAsesores || 1;
                    const pctEmp =
                      (last.honorariosEmpresa / total) * 100 || 0;
                    const pctAses =
                      (last.honorariosAsesores / total) * 100 || 0;

                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-700">
                            {last.month}
                          </span>
                          <span className="text-slate-500">
                            Total:{" "}
                            {fmtCurrencyARS(last.honorariosTotales)}
                          </span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-4 overflow-hidden flex">
                          <div
                            className="h-4 bg-emerald-500"
                            style={{ width: `${pctEmp}%` }}
                          />
                          <div
                            className="h-4 bg-sky-500"
                            style={{ width: `${pctAses}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] mt-1">
                          <span className="text-emerald-700">
                            Empresa: {pctEmp.toFixed(1)}%
                          </span>
                          <span className="text-sky-700">
                            Asesores: {pctAses.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3 text-[11px] text-slate-600">
                  <p className="font-medium text-xs mb-1">
                    Cómo leer esta vista
                  </p>
                  <p className="mb-1">
                    Cada fila muestra el volumen de cierres y los honorarios
                    generados ese mes. El split empresa / asesores sale del %
                    de honorarios cargado en cada propiedad y del{" "}
                    <strong>% empresa</strong> definido en la operación.
                  </p>
                  <p>
                    Más adelante se puede extender para ver por asesor (requiere
                    guardar referencia de asesor en cada operación).
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB: ACTIVIDADES */}
        {activeTab === "actividades" && (
          <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Actividades diarias
                </h2>
                <p className="text-xs text-slate-500">
                  Cuenta cuántas actividades programadas hay por día en el
                  período seleccionado (seguimientos, reuniones, muestras,
                  prelisting, etc.).
                </p>
              </div>
            </div>

            {actividadesPorDia.length === 0 ? (
              <p className="text-xs text-slate-500">
                No hay actividades registradas en el período seleccionado.
              </p>
            ) : (
              <div className="space-y-2">
                {actividadesPorDia.map((d) => (
                  <div
                    key={d.fecha}
                    className="flex items-center gap-3 text-[11px]"
                  >
                    <span className="w-24 text-slate-700">
                      {d.fecha.substring(8, 10)}/{d.fecha.substring(5, 7)}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-indigo-500"
                        style={{
                          width: `${Math.min(d.count * 10, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-slate-600">
                      {d.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Mensaje flotante */}
        {mensaje && (
          <div className="fixed bottom-4 right-4 rounded-full bg-black text-white px-4 py-2 text-xs shadow-lg">
            {mensaje}
          </div>
        )}
      </div>
    </div>
  );
}
