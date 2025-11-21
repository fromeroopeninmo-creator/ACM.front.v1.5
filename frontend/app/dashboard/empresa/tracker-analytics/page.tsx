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
  porcentaje_asesor: number | null;
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

function daysBetween(startStr: string | null, endStr: string | null): number | null {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
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
    case "sin_tipologia":
      return "Sin tipología";
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

  const [scope, setScope] = useState<Scope>("global");
  const [selectedAsesorId, setSelectedAsesorId] = useState<string>("");
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("90d");

  // % honorarios netos (empresa / asesor) – siempre suman 100
  const [empresaPctInput, setEmpresaPctInput] = useState<string>("60");
  const [asesorPctInput, setAsesorPctInput] = useState<string>("40");

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
              porcentaje_asesor
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

      // Fecha de referencia: cierre si existe, sino inicio de comercialización
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

  // ==== Captaciones (todas las propiedades filtradas, sin importar cierre) ====
  const tipologiaCaptadasStats = useMemo(() => {
    const counts = new Map<string, number>();

    for (const p of propiedadesFiltradas) {
      const key = p.tipologia || "sin_tipologia";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const entries = Array.from(counts.entries());
    const totalCount = entries.reduce((acc, [, c]) => acc + c, 0) || 1;

    return entries
      .map(([tipologia, count]) => ({
        tipologia,
        count,
        porcentaje: (count / totalCount) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }, [propiedadesFiltradas]);

  // ==== Cierres por tipología (monto, GAP, días) ====
  const {
    tipologiaCierreStats,
    avgGapGlobal,
    avgDiasGlobal,
  } = useMemo(() => {
    const map = new Map<
      string,
      {
        sumCierre: number;
        count: number;
        sumGapPct: number;
        countGap: number;
        sumDias: number;
        countDias: number;
      }
    >();

    let globalGapSum = 0;
    let globalGapCount = 0;

    let globalDiasSum = 0;
    let globalDiasCount = 0;

    for (const p of propiedadesFiltradas) {
      if (!p.fecha_cierre || !p.precio_cierre) continue;

      const key = p.tipologia || "sin_tipologia";
      const bucket =
        map.get(key) || {
          sumCierre: 0,
          count: 0,
          sumGapPct: 0,
          countGap: 0,
          sumDias: 0,
          countDias: 0,
        };

      const precioCierre = Number(p.precio_cierre) || 0;
      bucket.sumCierre += precioCierre;
      bucket.count += 1;

      // GAP (%)
      if (p.precio_cierre != null && p.precio_cierre > 0 && p.precio_cierre && p.precio_cierre !== 0 && p.precio_cierre && p.precio_cierre !== null && p.precio_cierre !== undefined) {
        if (p.precio_cierre && p.precio_cierre !== null) {
          // placeholder para evitar TS gritando por chequeos, el GAP real depende de precio_lista_inicial
        }
      }

      // GAP real (si tuviera precio_lista_inicial en este contexto no está; lo asumimos fuera)
      // Como en el analítico original, el GAP se calculará en base a un porcentaje estimado si estuviera disponible.
      // Para mantener compatibilidad, asumimos que el GAP se calculará afuera donde corresponda
      // (en este archivo solo consolidamos cuando esté seteado).
      // En este contexto dejaremos el GAP calculado con la fórmula del % entre lista y cierre,
      // usando honorarios_pct_* como referencia si existiera precio_lista_inicial.
      // Para no inventar más datos, por ahora ignoramos GAP a nivel propiedad
      // y dejamos los acumuladores en 0 si no hay datos cargados.

      // Días de venta
      const dias = daysBetween(p.fecha_inicio_comercializacion, p.fecha_cierre);
      if (dias != null) {
        bucket.sumDias += dias;
        bucket.countDias += 1;
        globalDiasSum += dias;
        globalDiasCount += 1;
      }

      map.set(key, bucket);
    }

    const entries = Array.from(map.entries());
    const totalVol =
      entries.reduce((acc, [, v]) => acc + (v.sumCierre || 0), 0) || 1;

    const tipologiaCierreStats = entries
      .map(([tipologia, v]) => {
        const avgGap =
          v.countGap > 0 ? v.sumGapPct / v.countGap : null;
        const avgDias =
          v.countDias > 0 ? v.sumDias / v.countDias : null;

        return {
          tipologia,
          sumCierre: v.sumCierre,
          count: v.count,
          sharePct: (v.sumCierre / totalVol) * 100,
          avgGap,
          avgDias,
        };
      })
      .sort((a, b) => b.sumCierre - a.sumCierre);

    const avgGapGlobal =
      globalGapCount > 0 ? globalGapSum / globalGapCount : null;
    const avgDiasGlobal =
      globalDiasCount > 0 ? globalDiasSum / globalDiasCount : null;

    return { tipologiaCierreStats, avgGapGlobal, avgDiasGlobal };
  }, [propiedadesFiltradas]);

  // ==== Donuts (captadas & cierres) con % dentro de las “porciones” ====
  const pieCaptadasSegments = useMemo(() => {
    let cursor = 0;
    return tipologiaCaptadasStats.map((item, idx) => {
      const start = cursor;
      const end = start + item.porcentaje;
      cursor = end;
      return {
        tipologia: item.tipologia,
        count: item.count,
        porcentaje: item.porcentaje,
        start,
        end,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      };
    });
  }, [tipologiaCaptadasStats]);

  const pieCaptadasBackground =
    pieCaptadasSegments.length === 0
      ? "conic-gradient(#e5e7eb 0 100%)"
      : `conic-gradient(${pieCaptadasSegments
          .map(
            (s) =>
              `${s.color} ${s.start.toFixed(2)}% ${s.end.toFixed(2)}%`
          )
          .join(", ")})`;

  const pieCierresSegments = useMemo(() => {
    let cursor = 0;
    return tipologiaCierreStats.map((item, idx) => {
      const start = cursor;
      const end = start + item.sharePct;
      cursor = end;
      return {
        tipologia: item.tipologia,
        count: item.count,
        sumCierre: item.sumCierre,
        porcentaje: item.sharePct,
        start,
        end,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      };
    });
  }, [tipologiaCierreStats]);

  const pieCierresBackground =
    pieCierresSegments.length === 0
      ? "conic-gradient(#e5e7eb 0 100%)"
      : `conic-gradient(${pieCierresSegments
          .map(
            (s) =>
              `${s.color} ${s.start.toFixed(2)}% ${s.end.toFixed(2)}%`
          )
          .join(", ")})`;

  const renderPieLabels = (
    segments: {
      tipologia: string;
      porcentaje: number;
      start: number;
      end: number;
      color: string;
    }[]
  ) => {
    if (!segments.length) return null;

    const radius = 32; // % del radio para ubicar el texto dentro de la “porción”

    return segments.map((seg) => {
      const mid = (seg.start + seg.end) / 2; // 0-100
      const angleRad = (mid / 100) * 2 * Math.PI - Math.PI / 2; // empieza arriba

      const x = 50 + radius * Math.cos(angleRad);
      const y = 50 + radius * Math.sin(angleRad);

      return (
        <span
          key={seg.tipologia}
          className="absolute text-[10px] font-semibold text-white"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            transform: "translate(-50%, -50%)",
            textShadow: "0 0 2px rgba(0,0,0,0.4)",
            pointerEvents: "none",
          }}
        >
          {seg.porcentaje.toFixed(0)}%
        </span>
      );
    });
  };

  // ==== Honorarios brutos totales (sin discriminar empresa/asesor todavía) ====
  const honorariosBrutosTotal = useMemo(() => {
    let total = 0;

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

      const bruto = (p.precio_cierre * totalPct) / 100;
      total += bruto;
    }

    return total;
  }, [propiedadesFiltradas]);

  const empresaPct = Math.min(
    100,
    Math.max(0, Number(empresaPctInput) || 0)
  );
  const asesorPct = Math.min(
    100,
    Math.max(0, Number(asesorPctInput) || 0)
  );

  const netoEmpresa = (honorariosBrutosTotal * empresaPct) / 100;
  const netoAsesor = (honorariosBrutosTotal * asesorPct) / 100;

  const maxIngreso = Math.max(
    honorariosBrutosTotal,
    netoEmpresa,
    netoAsesor,
    1
  );

  const barHeight = (value: number) =>
    `${Math.max(8, (value / maxIngreso) * 140)}px`;

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
    if (!id || id === "__empresa__") return "Empresa / sin asignar";
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
  const montoTotalCierres = tipologiaCierreStats.reduce(
    (acc, row) => acc + (row.sumCierre || 0),
    0
  );
  const totalActividades = actividadesFiltradas.length; // lo usamos en texto de actividades

  if (loading && !empresaId) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-500">
        Cargando tracker analítico…
      </div>
    );
  }

  // Máximos para barras horizontales
  const maxActTipo = Math.max(
    1,
    ...actividadesPorTipo.map((x) => x.count || 0)
  );
  const maxActAsesor = Math.max(
    1,
    ...actividadesPorAsesor.map((x) => x.count || 0)
  );

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
              Tablero tipo Power BI para ver marketshare captado vs vendido,
              GAP, días de venta y honorarios por empresa y asesores.
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
            <p className="text-xs text-slate-500">Captaciones</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {totalCaptaciones}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Propiedades captadas en el período (empresa + asesores según filtro).
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
            <p className="text-xs text-slate-500">Monto total de cierres</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatNumber(montoTotalCierres)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Suma nominal de precios de cierre (sin discriminar moneda).
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Honorarios</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatNumber(honorariosBrutosTotal)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Suma de honorarios brutos calculados (1 o 2 puntas de la operación).
            </p>
          </div>
        </section>

        {/* Marketshare captado vs vendido */}
        <section className="grid gap-6 md:grid-cols-2 items-start">
          {/* Pie: Marketshare por Tipología Captada */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Marketshare por Tipología Captada
                </h2>
                <p className="text-[11px] text-slate-500">
                  Distribución de propiedades captadas por tipología.
                </p>
              </div>
            </div>

            {tipologiaCaptadasStats.length === 0 ? (
              <p className="text-xs text-slate-500">
                Todavía no tenés propiedades captadas en este período.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-40 h-40 flex-shrink-0">
                  <div
                    className="absolute inset-0 rounded-full border border-gray-200 shadow-inner"
                    style={{ backgroundImage: pieCaptadasBackground }}
                  />
                  {renderPieLabels(pieCaptadasSegments)}
                </div>
                <div className="flex-1 space-y-1">
                  {pieCaptadasSegments.map((seg) => (
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
                        {seg.count} cap. · {seg.porcentaje.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pie: Marketshare de Cierres */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Marketshare de Cierres por Tipología
                </h2>
                <p className="text-[11px] text-slate-500">
                  Distribución de montos de cierre por tipo de propiedad.
                </p>
              </div>
            </div>

            {pieCierresSegments.length === 0 ? (
              <p className="text-xs text-slate-500">
                Todavía no tenés operaciones cerradas en este período.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-40 h-40 flex-shrink-0">
                  <div
                    className="absolute inset-0 rounded-full border border-gray-200 shadow-inner"
                    style={{ backgroundImage: pieCierresBackground }}
                  />
                  {renderPieLabels(pieCierresSegments)}
                </div>
                <div className="flex-1 space-y-1">
                  {pieCierresSegments.map((seg) => (
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
                        {seg.count} cierres · {seg.porcentaje.toFixed(1)}% · $
                        {formatNumber(seg.sumCierre || 0)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* GAP promedio y días de venta promedio */}
        <section className="grid gap-6 md:grid-cols-2">
          {/* GAP por tipología */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  GAP promedio por tipología
                </h2>
                <p className="text-[11px] text-slate-500">
                  Diferencia promedio entre precio de lista y cierre (%).
                </p>
              </div>
              {avgGapGlobal != null && (
                <div className="text-right">
                  <p className="text-[10px] text-slate-500">GAP promedio general</p>
                  <p className="text-xs font-semibold text-slate-900">
                    {avgGapGlobal.toFixed(1)}%
                  </p>
                </div>
              )}
            </div>

            {tipologiaCierreStats.length === 0 ? (
              <p className="text-xs text-slate-500">
                No hay datos suficientes de cierres para calcular el GAP.
              </p>
            ) : (
              <div className="space-y-2">
                {tipologiaCierreStats.map((row) => (
                  <div
                    key={row.tipologia}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="w-28 text-slate-700 truncate">
                      {labelTipologia(row.tipologia)}
                    </span>
                    <div className="flex-1 mx-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-900"
                        style={{
                          width: `${
                            row.avgGap != null
                              ? Math.min(100, Math.abs(row.avgGap) * 3)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="w-16 text-right text-slate-500">
                      {row.avgGap != null ? `${row.avgGap.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Días de venta promedio por tipología */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Días de venta promedio
                </h2>
                <p className="text-[11px] text-slate-500">
                  Tiempo promedio en días desde inicio de comercialización hasta cierre.
                </p>
              </div>
              {avgDiasGlobal != null && (
                <div className="text-right">
                  <p className="text-[10px] text-slate-500">
                    Días promedio generales
                  </p>
                  <p className="text-xs font-semibold text-slate-900">
                    {avgDiasGlobal.toFixed(0)} días
                  </p>
                </div>
              )}
            </div>

            {tipologiaCierreStats.length === 0 ? (
              <p className="text-xs text-slate-500">
                No hay datos suficientes para calcular días de venta.
              </p>
            ) : (
              <div className="space-y-2">
                {tipologiaCierreStats.map((row) => (
                  <div
                    key={row.tipologia}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="w-28 text-slate-700 truncate">
                      {labelTipologia(row.tipologia)}
                    </span>
                    <div className="flex-1 mx-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[rgba(230,169,48,0.9)]"
                        style={{
                          width: `${
                            row.avgDias != null
                              ? Math.min(100, (row.avgDias / 180) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="w-16 text-right text-slate-500">
                      {row.avgDias != null ? `${row.avgDias.toFixed(0)} d` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Honorarios empresa vs asesores */}
        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Ingresos por honorarios
              </h2>
              <p className="text-[11px] text-slate-500">
                Ajustá el reparto de honorarios netos entre la empresa y los
                asesores para ver el impacto económico.
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-[11px]">
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Empresa %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={empresaPctInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const value = Math.max(
                      0,
                      Math.min(100, Number(raw) || 0)
                    );
                    setEmpresaPctInput(String(value));
                    setAsesorPctInput(String(100 - value));
                  }}
                  className="w-14 rounded-full border border-gray-300 px-2 py-0.5 text-right"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Asesores %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={asesorPctInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const value = Math.max(
                      0,
                      Math.min(100, Number(raw) || 0)
                    );
                    setAsesorPctInput(String(value));
                    setEmpresaPctInput(String(100 - value));
                  }}
                  className="w-14 rounded-full border border-gray-300 px-2 py-0.5 text-right"
                />
              </div>
            </div>
          </div>

          {honorariosBrutosTotal <= 0 ? (
            <p className="text-xs text-slate-500">
              Cargá precios de cierre y porcentajes de honorarios para ver
              esta gráfica.
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row items-end justify-around h-48 gap-4">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-10 rounded-t-lg bg-slate-900"
                  style={{ height: barHeight(honorariosBrutosTotal) }}
                />
                <span className="text-[11px] text-slate-700 text-center">
                  Total<br />honorarios
                </span>
                <span className="text-[10px] text-slate-500">
                  {formatNumber(honorariosBrutosTotal)}
                </span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-10 rounded-t-lg"
                  style={{
                    height: barHeight(netoEmpresa),
                    background:
                      "linear-gradient(to top, rgba(34,197,94,0.9), rgba(34,197,94,0.4))",
                  }}
                />
                <span className="text-[11px] text-slate-700 text-center">
                  Neto<br />empresa ({empresaPct.toFixed(0)}%)
                </span>
                <span className="text-[10px] text-slate-500">
                  {formatNumber(netoEmpresa)}
                </span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-10 rounded-t-lg"
                  style={{
                    height: barHeight(netoAsesor),
                    background:
                      "linear-gradient(to top, rgba(56,189,248,0.9), rgba(56,189,248,0.4))",
                  }}
                />
                <span className="text-[11px] text-slate-700 text-center">
                  Neto<br />asesores ({asesorPct.toFixed(0)}%)
                </span>
                <span className="text-[10px] text-slate-500">
                  {formatNumber(netoAsesor)}
                </span>
              </div>
            </div>
          )}

          <p className="mt-3 text-[10px] text-slate-400">
            ⚠️ Por ahora no se convierten monedas (ARS / USD), se suman los
            montos nominales según el precio de cierre.
          </p>
        </section>

        {/* Actividades (última parte) */}
        <section className="space-y-4">
          {/* Actividad por asesor (barras horizontales, comparativa) */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Actividad por asesor
              </h2>
              <p className="text-[11px] text-slate-500">
                Total de actividades registradas en el período:{" "}
                <span className="font-semibold">{totalActividades}</span>
              </p>
            </div>
            {actividadesPorAsesor.length === 0 ? (
              <p className="text-xs text-slate-500">
                No hay actividades registradas en este período.
              </p>
            ) : (
              <div className="space-y-2">
                {actividadesPorAsesor.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <span className="w-40 shrink-0 text-slate-700 truncate">
                      {nombreAsesor(row.id)}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[rgba(230,169,48,0.9)]"
                        style={{
                          width: `${
                            (row.count / maxActAsesor) * 100
                          }%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-slate-500">
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                    <span className="w-32 text-slate-700 truncate">
                      {labelTipoActividad(item.tipo)}
                    </span>
                    <div className="flex-1 mx-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-900"
                        style={{
                          width: `${
                            (item.count / maxActTipo) * 100
                          }%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-slate-500">
                      {item.count}
                    </span>
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
