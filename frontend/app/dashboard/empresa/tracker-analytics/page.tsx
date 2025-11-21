"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

type Scope = "empresa" | "asesores" | "global";
type DateRangeKey = "90d" | "180d" | "365d";

interface TrackerPropiedad {
  id: string;
  empresa_id: string;
  asesor_id: string | null;
  tipologia: string | null;
  tipo_operacion: string | null;
  precio_cierre: number | null;
  moneda: string | null;
  fecha_cierre: string | null;
  fecha_inicio_comercializacion: string | null;
  honorarios_pct_comprador: number | null;
  honorarios_pct_vendedor: number | null;
  porcentaje_asesor: number | null; // % del honorario que va al asesor (ej: 60)
  precio_lista_inicial: number | null; // para calcular GAP
}

interface TrackerActividad {
  id: string;
  empresa_id: string;
  asesor_id: string | null;
  tipo: string;
  fecha_programada: string | null;
  created_at: string;
}

interface Asesor {
  id: string;
  nombre: string | null;
  apellido: string | null;
}

// Helpers fechas
function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function subDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function rangeStart(key: DateRangeKey): Date {
  const today = startOfDay(new Date());
  if (key === "90d") return subDays(today, 90);
  if (key === "180d") return subDays(today, 180);
  return subDays(today, 365);
}

// Helpers labels
function labelTipologia(t: string | null): string {
  if (!t) return "Sin tipología";
  switch (t) {
    case "casa":
      return "Casa";
    case "departamento":
      return "Departamento";
    case "duplex":
      return "Dúplex";
    case "local":
      return "Local";
    case "terreno":
      return "Terreno";
    case "cochera":
      return "Cochera";
    case "campo":
      return "Campo";
    default:
      return t;
  }
}

function labelTipoActividad(t: string): string {
  switch (t) {
    case "seguimiento":
      return "Seguimiento";
    case "reunion":
      return "Reunión";
    case "muestra":
      return "Muestra";
    case "prelisting":
      return "Prelisting";
    case "vai":
      return "VAI";
    case "factibilidad":
      return "Factibilidad";
    case "reserva":
      return "Reserva";
    case "cierre":
      return "Cierre";
    default:
      return t;
  }
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(n);
}

const PIE_COLORS = [
  "#E6A930",
  "#0EA5E9",
  "#22C55E",
  "#F97316",
  "#EC4899",
  "#6366F1",
  "#A855F7",
];

export default function EmpresaTrackerAnaliticoPage() {
  const { user } = useAuth();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [propiedades, setPropiedades] = useState<TrackerPropiedad[]>([]);
  const [actividades, setActividades] = useState<TrackerActividad[]>([]);
  const [asesores, setAsesores] = useState<Asesor[]>([]);

  const [scope, setScope] = useState<Scope>("empresa");
  const [selectedAsesorId, setSelectedAsesorId] = useState<string>("");
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("90d");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ==== Cargar empresa_id a partir del user (EMPRESA) ====
  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!user?.id) {
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
        setErrorMsg("No se pudo obtener la empresa.");
        setLoading(false);
        return;
      }

      setEmpresaId(data?.id ?? null);
      setLoading(false);
    };

    fetchEmpresa();
  }, [user]);

  // ==== Cargar propiedades + actividades + asesores ====
  useEffect(() => {
    if (!empresaId) return;

    const fetchAll = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const [
          { data: pData, error: pErr },
          { data: aData, error: aErr },
          { data: asData, error: asErr },
        ] = await Promise.all([
          supabase
            .from("tracker_propiedades")
            .select(
              `
                id,
                empresa_id,
                asesor_id,
                tipologia,
                tipo_operacion,
                precio_cierre,
                moneda,
                fecha_cierre,
                fecha_inicio_comercializacion,
                honorarios_pct_comprador,
                honorarios_pct_vendedor,
                porcentaje_asesor,
                precio_lista_inicial
              `
            )
            .eq("empresa_id", empresaId),
          supabase
            .from("tracker_actividades")
            .select(
              `
                id,
                empresa_id,
                asesor_id,
                tipo,
                fecha_programada,
                created_at
              `
            )
            .eq("empresa_id", empresaId),
          supabase
            .from("asesores")
            .select("id, nombre, apellido")
            .eq("empresa_id", empresaId),
        ]);

        if (pErr || aErr || asErr) {
          console.error("Errores cargando tracker analítico:", {
            pErr,
            aErr,
            asErr,
          });
          setErrorMsg("No se pudieron cargar todos los datos del tracker.");
        }

        setPropiedades((pData as TrackerPropiedad[]) ?? []);
        setActividades((aData as TrackerActividad[]) ?? []);
        setAsesores((asData as Asesor[]) ?? []);
      } catch (err) {
        console.error("Error inesperado cargando tracker analítico:", err);
        setErrorMsg("Error inesperado al cargar datos del tracker.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [empresaId]);

  const rangeStartDate = useMemo(() => rangeStart(rangeKey), [rangeKey]);

  // ==== Helpers de filtro por scope ====
  const filterPropertyByScope = (p: TrackerPropiedad) => {
    if (scope === "global") return true;

    if (scope === "empresa") {
      // Operaciones sin asesor_id => las consideramos "Empresa"
      return !p.asesor_id;
    }

    // scope === "asesores"
    if (!p.asesor_id) return false;
    if (!selectedAsesorId) return true; // todos los asesores
    return p.asesor_id === selectedAsesorId;
  };

  const filterActivityByScope = (a: TrackerActividad) => {
    if (scope === "global") return true;

    if (scope === "empresa") {
      return !a.asesor_id;
    }

    // scope === "asesores"
    if (!a.asesor_id) return false;
    if (!selectedAsesorId) return true;
    return a.asesor_id === selectedAsesorId;
  };

  // ==== Filtrar propiedades y actividades por RANGO + SCOPE ====
  const propiedadesFiltradas = useMemo(() => {
    const start = rangeStartDate;
    return propiedades.filter((p) => {
      if (!filterPropertyByScope(p)) return false;

      // Tomamos la fecha de referencia:
      // si tiene fecha_cierre => esa; sino, inicio de comercialización
      const refDateStr =
        p.fecha_cierre || p.fecha_inicio_comercializacion || null;
      if (!refDateStr) return false;

      const refDate = new Date(refDateStr);
      return refDate >= start;
    });
  }, [propiedades, rangeStartDate, scope, selectedAsesorId]);

  const actividadesFiltradas = useMemo(() => {
    const start = rangeStartDate;
    return actividades.filter((a) => {
      if (!filterActivityByScope(a)) return false;

      const refStr = a.fecha_programada || a.created_at;
      if (!refStr) return false;
      const d = new Date(refStr);
      return d >= start;
    });
  }, [actividades, rangeStartDate, scope, selectedAsesorId]);

  // ==== Honorarios estimados (default 3% + 3% y 60% asesor / 40% empresa) ====
  const ingresos = useMemo(() => {
    let total = 0;
    let asesorTotal = 0;
    let empresaTotal = 0;

    for (const p of propiedadesFiltradas) {
      if (!p.precio_cierre || !p.fecha_cierre) continue;

      const pctComprador =
        p.honorarios_pct_comprador != null
          ? Number(p.honorarios_pct_comprador)
          : 3;
      const pctVendedor =
        p.honorarios_pct_vendedor != null
          ? Number(p.honorarios_pct_vendedor)
          : 3;

      const totalPct = pctComprador + pctVendedor;
      if (totalPct <= 0) continue;

      const bruto = (Number(p.precio_cierre) * totalPct) / 100;

      const pctAsesor =
        p.porcentaje_asesor != null ? Number(p.porcentaje_asesor) / 100 : 0.6;
      const pctEmpresa = 1 - pctAsesor;

      const asesorMonto = bruto * pctAsesor;
      const empresaMonto = bruto * pctEmpresa;

      total += bruto;
      asesorTotal += asesorMonto;
      empresaTotal += empresaMonto;
    }

    return {
      total,
      asesor: asesorTotal,
      empresa: empresaTotal,
    };
  }, [propiedadesFiltradas]);

  const maxIngreso = Math.max(
    ingresos.total,
    ingresos.asesor,
    ingresos.empresa,
    1
  );

  const barHeight = (value: number) =>
    `${Math.max(8, (value / maxIngreso) * 140)}px`;

  // ==== Marketshare por tipología (solo propiedades con cierre) ====
  const tipologiaStats = useMemo(() => {
    const counts = new Map<string, number>();

    for (const p of propiedadesFiltradas) {
      if (!p.tipologia) continue;
      if (!p.fecha_cierre) continue; // consideramos sólo las cerradas
      const key = p.tipologia;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const entries = Array.from(counts.entries());
    const total = entries.reduce((acc, [, count]) => acc + count, 0) || 1;

    return entries.map(([tipologia, count]) => ({
      tipologia,
      count,
      porcentaje: (count / total) * 100,
    }));
  }, [propiedadesFiltradas]);

  const pieSegments = useMemo(() => {
    let cursor = 0;
    return tipologiaStats.map((item, idx) => {
      const start = cursor;
      const end = start + item.porcentaje;
      cursor = end;
      return {
        ...item,
        start,
        end,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      };
    });
  }, [tipologiaStats]);

  const pieBackground =
    pieSegments.length === 0
      ? "conic-gradient(#e5e7eb 0 100%)"
      : `conic-gradient(${pieSegments
          .map(
            (s) => `${s.color} ${s.start.toFixed(2)}% ${s.end.toFixed(2)}%`
          )
          .join(", ")})`;

  // ==== Marketshare por tipología por volumen de cierre + GAP ====
  const {
    tipologiaCierreStats,
    avgGapGlobal,
  }: {
    tipologiaCierreStats: {
      tipologia: string;
      sumCierre: number;
      sharePct: number;
      avgGap: number | null;
    }[];
    avgGapGlobal: number | null;
  } = useMemo(() => {
    const map = new Map<
      string,
      { sumCierre: number; sumGapPct: number; countGap: number }
    >();
    let globalGapSum = 0;
    let globalGapCount = 0;

    for (const p of propiedadesFiltradas) {
      if (!p.fecha_cierre || !p.precio_cierre) continue;

      const key = p.tipologia || "sin_tipologia";
      const current = map.get(key) ?? {
        sumCierre: 0,
        sumGapPct: 0,
        countGap: 0,
      };

      current.sumCierre += Number(p.precio_cierre);

      if (
        p.precio_lista_inicial != null &&
        p.precio_lista_inicial > 0 &&
        p.precio_cierre != null
      ) {
        const gapPct =
          ((Number(p.precio_lista_inicial) - Number(p.precio_cierre)) /
            Number(p.precio_lista_inicial)) *
          100;

        if (!Number.isNaN(gapPct)) {
          current.sumGapPct += gapPct;
          current.countGap += 1;

          globalGapSum += gapPct;
          globalGapCount += 1;
        }
      }

      map.set(key, current);
    }

    const entries = Array.from(map.entries());
    const totalCierre =
      entries.reduce((acc, [, v]) => acc + v.sumCierre, 0) || 1;

    const stats = entries
      .map(([tipologia, v]) => ({
        tipologia,
        sumCierre: v.sumCierre,
        sharePct: (v.sumCierre / totalCierre) * 100,
        avgGap: v.countGap > 0 ? v.sumGapPct / v.countGap : null,
      }))
      .sort((a, b) => b.sharePct - a.sharePct);

    const avgGapGlobal =
      globalGapCount > 0 ? globalGapSum / globalGapCount : null;

    return { tipologiaCierreStats: stats, avgGapGlobal };
  }, [propiedadesFiltradas]);

  // ==== Actividades por tipo ====
  const actividadesPorTipo = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of actividadesFiltradas) {
      const key = a.tipo || "sin_tipo";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([tipo, count]) => ({
      tipo,
      count,
    }));
  }, [actividadesFiltradas]);

  // ==== Actividades por asesor ====
  const actividadesPorAsesor = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of actividadesFiltradas) {
      const id = a.asesor_id ?? "__empresa__";
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([id, count]) => ({
      id,
      count,
    }));
  }, [actividadesFiltradas]);

  const nombreAsesor = (id: string | null) => {
    if (!id) return "Empresa / Sin asesor";
    const found = asesores.find((a) => a.id === id);
    if (!found) return "Sin nombre";
    const nombre = [found.nombre, found.apellido].filter(Boolean).join(" ");
    return nombre || "Sin nombre";
  };

  // ==== KPIs generales ====
  const totalCaptaciones = propiedadesFiltradas.length;
  const totalCierres = propiedadesFiltradas.filter(
    (p) => p.fecha_cierre && p.precio_cierre
  ).length;
  const totalActividades = actividadesFiltradas.length;

  if (loading && !empresaId) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-500">
        Cargando tracker analítico…
      </div>
    );
  }

  // Para el donut interior: top 3 tipologías + "Otros"
  const topPieSegments = pieSegments.slice(0, 3);
  const otrosPct =
    pieSegments.reduce((acc, s) => acc + s.porcentaje, 0) -
    topPieSegments.reduce((acc, s) => acc + s.porcentaje, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Título + filtros */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Tracker de ventas y actividad
            </h1>
            <p className="mt-1 text-sm text-slate-600 max-w-xl">
              Tablero tipo Power BI para ver marketshare por tipología,
              honorarios estimados, GAP y nivel de actividad de tu equipo.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 items-center justify-start md:justify-end text-xs">
            {/* Rango de fechas */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Período:</span>
              <select
                value={rangeKey}
                onChange={(e) => setRangeKey(e.target.value as DateRangeKey)}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700"
              >
                <option value="90d">Últimos 3 meses</option>
                <option value="180d">Últimos 6 meses</option>
                <option value="365d">Último año</option>
              </select>
            </div>

            {/* Scope principal */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Vista:</span>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as Scope)}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700"
              >
                <option value="empresa">Empresa</option>
                <option value="asesores">Asesores</option>
                <option value="global">Global (empresa + asesores)</option>
              </select>
            </div>

            {/* Filtro asesor (solo cuando vista = Asesores) */}
            {scope === "asesores" && (
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Asesor:</span>
                <select
                  value={selectedAsesorId}
                  onChange={(e) => setSelectedAsesorId(e.target.value)}
                  className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700 max-w-[200px]"
                >
                  <option value="">Todos</option>
                  {asesores.map((a) => (
                    <option key={a.id} value={a.id}>
                      {nombreAsesor(a.id)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </header>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
            {errorMsg}
          </div>
        )}

        {/* KPIs principales */}
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Propiedades en análisis</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {totalCaptaciones}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Captaciones y operaciones en el período.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Cierres</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {totalCierres}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Operaciones con precio de cierre cargado.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Actividades</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {totalActividades}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Llamados, reuniones, muestras, prelisting, etc.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Honorarios estimados</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatNumber(ingresos.total)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Suma estimada de honorarios brutos (sin discriminar moneda).
            </p>
          </div>
        </section>

        {/* FILA PRINCIPAL DE GRÁFICOS */}
        <section className="grid gap-6 md:grid-cols-2 items-start">
          {/* Pie: Marketshare por tipología */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Marketshare por Tipología
                </h2>
                <p className="text-[11px] text-slate-500">
                  Distribución de operaciones cerradas por tipo de propiedad.
                </p>
              </div>
            </div>

            {tipologiaStats.length === 0 ? (
              <p className="text-xs text-slate-500">
                Todavía no tenés operaciones cerradas en este período.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Donut con porcentajes dentro */}
                <div className="relative w-40 h-40 flex-shrink-0">
                  <div
                    className="absolute inset-0 rounded-full border border-gray-200 shadow-inner"
                    style={{ backgroundImage: pieBackground }}
                  />
                  <div className="absolute inset-5 rounded-full bg-white/85 flex flex-col items-center justify-center text-[10px] text-slate-700 px-2 text-center">
                    <p className="font-semibold mb-1 text-[11px]">
                      % por tipología
                    </p>
                    {topPieSegments.map((seg) => (
                      <div key={seg.tipologia} className="leading-tight">
                        {labelTipologia(seg.tipologia)}{" "}
                        <span className="font-semibold">
                          {seg.porcentaje.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                    {otrosPct > 0.5 && (
                      <div className="mt-1 leading-tight text-slate-500">
                        Otros{" "}
                        <span className="font-semibold">
                          {otrosPct.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Leyenda lado derecho */}
                <div className="flex-1 space-y-1">
                  {pieSegments.map((seg) => (
                    <div
                      key={seg.tipologia}
                      className="flex items-center justify-between text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="text-slate-700">
                          {labelTipologia(seg.tipologia)}
                        </span>
                      </div>
                      <div className="text-slate-500">
                        {seg.count} op. · {seg.porcentaje.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Barras verticales: Honorarios brutos vs asesor vs empresa */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Ingresos por honorarios
                </h2>
                <p className="text-[11px] text-slate-500">
                  Comparación entre honorarios brutos, neto asesor y neto
                  empresa.
                </p>
              </div>
            </div>

            {ingresos.total <= 0 ? (
              <p className="text-xs text-slate-500">
                Cargá precios de cierre y porcentajes de honorarios para ver
                esta gráfica.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row items-end justify-around h-48 gap-4">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-10 rounded-t-lg bg-slate-900"
                    style={{ height: barHeight(ingresos.total) }}
                  />
                  <span className="text-[11px] text-slate-700 text-center">
                    Total
                    <br />
                    honorarios
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {formatNumber(ingresos.total)}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-10 rounded-t-lg"
                    style={{
                      height: barHeight(ingresos.asesor),
                      background:
                        "linear-gradient(to top, rgba(56,189,248,0.9), rgba(56,189,248,0.4))",
                    }}
                  />
                  <span className="text-[11px] text-slate-700 text-center">
                    Neto
                    <br />
                    asesor
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {formatNumber(ingresos.asesor)}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-10 rounded-t-lg"
                    style={{
                      height: barHeight(ingresos.empresa),
                      background:
                        "linear-gradient(to top, rgba(34,197,94,0.9), rgba(34,197,94,0.4))",
                    }}
                  />
                  <span className="text-[11px] text-slate-700 text-center">
                    Neto
                    <br />
                    empresa
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {formatNumber(ingresos.empresa)}
                  </span>
                </div>
              </div>
            )}

            <p className="mt-3 text-[10px] text-slate-400">
              ⚠️ Por ahora no se convierten monedas (ARS / USD), se suman los
              montos nominales según el precio de cierre.
            </p>
          </div>
        </section>

        {/* NUEVO: Marketshare por precios de cierre + GAP */}
        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Marketshare por Tipología (volumen de cierre) + GAP
              </h2>
              <p className="text-[11px] text-slate-500 max-w-xl">
                Distribución del volumen de precios de cierre por tipología y
                GAP promedio (diferencia entre precio de lista inicial y precio
                de cierre).
              </p>
            </div>
            {avgGapGlobal != null && (
              <div className="rounded-full bg-amber-50 px-3 py-1 text-[11px] text-amber-900 border border-amber-200">
                GAP promedio global:{" "}
                <span className="font-semibold">
                  {avgGapGlobal.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {tipologiaCierreStats.length === 0 ? (
            <p className="text-xs text-slate-500">
              No hay operaciones con precio de cierre para analizar volumen y
              GAP en este período.
            </p>
          ) : (
            <div className="space-y-2">
              {tipologiaCierreStats.map((row) => {
                const maxSum = Math.max(
                  ...tipologiaCierreStats.map((x) => x.sumCierre),
                  1
                );
                const widthPct = Math.min(
                  100,
                  (row.sumCierre / maxSum) * 100
                );

                return (
                  <div
                    key={row.tipologia}
                    className="flex flex-col gap-1 text-[11px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700">
                        {labelTipologia(row.tipologia)}
                      </span>
                      <span className="text-slate-500">
                        {row.sharePct.toFixed(1)}% del volumen ·{" "}
                        {row.avgGap != null
                          ? `GAP prom. ${row.avgGap.toFixed(1)}%`
                          : "GAP sin datos"}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[rgba(230,169,48,0.9)]"
                        style={{ width: `${widthPct.toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-2 text-[10px] text-slate-400">
            GAP = (Precio lista inicial – Precio de cierre) / Precio lista
            inicial. Valores positivos indican cierres por debajo del precio
            inicial publicado.
          </p>
        </section>

        {/* Actividad por tipo + por asesor */}
        <section className="grid gap-6 md:grid-cols-2">
          {/* Actividades por tipo */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">
              Actividades por tipo
            </h2>
            {actividadesPorTipo.length === 0 ? (
              <p className="text-xs text-slate-500">
                No hay actividades registradas en este período.
              </p>
            ) : (
              <div className="space-y-2">
                {actividadesPorTipo.map((item) => (
                  <div
                    key={item.tipo}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="text-slate-700">
                      {labelTipoActividad(item.tipo)}
                    </span>
                    <div className="flex-1 mx-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-900"
                        style={{
                          width: `${Math.min(
                            100,
                            (item.count /
                              Math.max(
                                1,
                                Math.max(
                                  ...actividadesPorTipo.map((x) => x.count)
                                )
                              )) *
                              100
                          ).toFixed(1)}%`,
                        }}
                      />
                    </div>
                    <span className="text-slate-500">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actividades por asesor */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">
              Actividad por asesor
            </h2>
            {actividadesPorAsesor.length === 0 ? (
              <p className="text-xs text-slate-500">
                No hay actividades registradas en este período.
              </p>
            ) : (
              <div className="space-y-2">
                {actividadesPorAsesor.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="text-slate-700">
                      {row.id === "__empresa__"
                        ? "Empresa / sin asignar"
                        : nombreAsesor(row.id)}
                    </span>
                    <div className="flex-1 mx-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[rgba(230,169,48,0.9)]"
                        style={{
                          width: `${Math.min(
                            100,
                            (row.count /
                              Math.max(
                                1,
                                Math.max(
                                  ...actividadesPorAsesor.map((x) => x.count)
                                )
                              )) *
                              100
                          ).toFixed(1)}%`,
                        }}
                      />
                    </div>
                    <span className="text-slate-500">{row.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
