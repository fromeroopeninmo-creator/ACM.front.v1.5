"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

type Scope = "empresa" | "asesores" | "global";
type DateRangeKey = "30d" | "90d" | "180d" | "365d";

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
  precio_lista_inicial: number | null;
}

interface TrackerActividad {
  id: string;
  empresa_id: string;
  asesor_id: string | null;
  contacto_id: string | null;
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
  if (key === "30d") return subDays(today, 30);
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
  if (!t || t === "sin_tipologia") return "Sin tipología";
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

export default function AsesorTrackerAnaliticoPage() {
  const { user } = useAuth();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [asesorId, setAsesorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [propiedades, setPropiedades] = useState<TrackerPropiedad[]>([]);
  const [actividades, setActividades] = useState<TrackerActividad[]>([]);
  const [asesores, setAsesores] = useState<Asesor[]>([]);

  // 🔒 En asesor siempre trabajamos en “global” (solo sus datos)
  const [scope] = useState<Scope>("global");
  const [selectedAsesorId] = useState<string>("");
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("90d");

  // % honorarios netos (empresa / asesores)
  const [empresaPctInput, setEmpresaPctInput] = useState<string>("60");
  const [asesorPctInput, setAsesorPctInput] = useState<string>("40");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cargar configuración de honorarios desde localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedEmpresa = localStorage.getItem("vai_honorarios_empresa_pct");
    const storedAsesor = localStorage.getItem("vai_honorarios_asesor_pct");

    if (storedEmpresa !== null && storedAsesor !== null) {
      const e = Math.min(100, Math.max(0, Number(storedEmpresa) || 0));
      const a = Math.min(100, Math.max(0, Number(storedAsesor) || 0));
      const total = e + a || 1;
      const normE = (e / total) * 100;
      const normA = (a / total) * 100;
      setEmpresaPctInput(String(Math.round(normE)));
      setAsesorPctInput(String(Math.round(normA)));
    }
  }, []);

  // ==== Cargar asesor_id + empresa_id a partir del user (ASESOR) ====
  useEffect(() => {
    const fetchAsesor = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("asesores")
        .select("id, empresa_id, nombre, apellido")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error buscando asesor para tracker analítico:", error);
        setErrorMsg("No se pudo obtener tu perfil de asesor.");
        setLoading(false);
        return;
      }

      if (!data) {
        setErrorMsg("No se encontró tu perfil de asesor.");
        setLoading(false);
        return;
      }

      setAsesorId(data.id);
      setEmpresaId(data.empresa_id ?? null);
      setAsesores([
        {
          id: data.id,
          nombre: data.nombre,
          apellido: data.apellido,
        },
      ]);
    };

    fetchAsesor();
  }, [user]);

  // ==== Cargar propiedades + actividades SOLO del asesor ====
  useEffect(() => {
    if (!empresaId || !asesorId) return;

    const fetchAll = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const [{ data: pData, error: pErr }, { data: aData, error: aErr }] =
          await Promise.all([
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
              .eq("empresa_id", empresaId)
              .eq("asesor_id", asesorId),
            supabase
              .from("tracker_actividades")
              .select(
                `
              id,
              empresa_id,
              asesor_id,
              contacto_id,
              tipo,
              fecha_programada,
              created_at
            `
              )
              .eq("empresa_id", empresaId)
              .eq("asesor_id", asesorId),
          ]);

        if (pErr || aErr) {
          console.error("Errores cargando tracker analítico (asesor):", {
            pErr,
            aErr,
          });
          setErrorMsg("No se pudieron cargar todos los datos del tracker.");
        }

        setPropiedades((pData as TrackerPropiedad[]) ?? []);
        setActividades((aData as TrackerActividad[]) ?? []);
      } catch (err) {
        console.error("Error inesperado cargando tracker analítico (asesor):", err);
        setErrorMsg("Error inesperado al cargar datos del tracker.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [empresaId, asesorId]);

  const rangeStartDate = useMemo(() => rangeStart(rangeKey), [rangeKey]);

  // ==== Helpers de filtro por scope (en asesor siempre “global”) ====
  const filterPropertyByScope = (p: TrackerPropiedad) => {
    if (scope === "global") return true;

    if (scope === "empresa") {
      return !p.asesor_id;
    }

    if (!p.asesor_id) return false;
    if (!selectedAsesorId) return true;
    return p.asesor_id === selectedAsesorId;
  };

  const filterActivityByScope = (a: TrackerActividad) => {
    if (scope === "global") return true;

    if (scope === "empresa") {
      return !a.asesor_id;
    }

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

      // GAP real si hay precio de lista
      if (p.precio_lista_inicial != null && p.precio_lista_inicial > 0) {
        const gapPct =
          ((p.precio_lista_inicial - precioCierre) / p.precio_lista_inicial) *
          100;
        bucket.sumGapPct += gapPct;
        bucket.countGap += 1;
        globalGapSum += gapPct;
        globalGapCount += 1;
      }

      // Días de venta
      const dias = daysBetween(
        p.fecha_inicio_comercializacion,
        p.fecha_cierre
      );
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

  // 🔹 Mapa global de colores por tipología
  const tipologiaColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    let colorIdx = 0;

    const assignColor = (tipologiaRaw: string | null | undefined) => {
      if (!tipologiaRaw) return;
      const key = tipologiaRaw; // si querés, acá podés normalizar (toLowerCase, trim, etc.)
      if (!map[key]) {
        map[key] = PIE_COLORS[colorIdx % PIE_COLORS.length];
        colorIdx++;
      }
    };

    // Primero recorremos las captadas
    tipologiaCaptadasStats.forEach((item) => assignColor(item.tipologia));
    // Luego recorremos las de cierre (si hay alguna tipología nueva, toma el siguiente color libre)
    tipologiaCierreStats.forEach((item) => assignColor(item.tipologia));

    return map;
  }, [tipologiaCaptadasStats, tipologiaCierreStats]);

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
        // ✅ Color consistente por tipología en TODOS los gráficos
        color:
          tipologiaColorMap[item.tipologia] ??
          PIE_COLORS[idx % PIE_COLORS.length],
      };
    });
  }, [tipologiaCaptadasStats, tipologiaColorMap]);

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
        // ✅ MISMO mapa de colores que el gráfico anterior
        color:
          tipologiaColorMap[item.tipologia] ??
          PIE_COLORS[idx % PIE_COLORS.length],
      };
    });
  }, [tipologiaCierreStats, tipologiaColorMap]);

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

    const radius = 32; // % del radio para ubicar el texto dentro de la porción

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


  // ==== Honorarios brutos totales (1 o 2 puntas) ====
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

  // ==== Ticket promedio por tipología ====
  const globalAvgTicket =
    propiedadesFiltradas.filter((p) => p.precio_cierre && p.fecha_cierre)
      .length > 0
      ? tipologiaCierreStats.reduce(
          (acc, row) => acc + (row.sumCierre || 0),
          0
        ) /
        tipologiaCierreStats.reduce(
          (acc, row) => acc + (row.count || 0),
          0
        )
      : null;

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

  // ==== Actividades por “asesor” (en este caso, siempre el propio asesor) ====
  const actividadesPorAsesor = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of actividadesFiltradas) {
      const id = a.asesor_id ?? "__asesor__";
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([id, count]) => ({
      id,
      count,
    }));
  }, [actividadesFiltradas]);

  const nombreAsesor = (id: string | null) => {
    if (!id) return "Asesor";
    if (id === "__asesor__") {
      const nombre = [user?.nombre, user?.apellido]
        .filter(Boolean)
        .join(" ");
      return nombre || "Asesor";
    }
    const found = asesores.find((a) => a.id === id);
    if (!found) {
      const nombre = [user?.nombre, user?.apellido]
        .filter(Boolean)
        .join(" ");
      return nombre || "Asesor";
    }
    const nombre = [found.nombre, found.apellido].filter(Boolean).join(" ");
    return nombre || "Asesor";
  };

  // ==== Funnel comercial (prospectos → prelisting → captación → cierres) ====
  const {
    prospectosCount,
    prelistingCount,
    captacionesCount,
    cierresCount,
    conversionProspectoCierre,
    conversionProspectoPrelisting,
    conversionPrelistingCaptacion,
  } = useMemo(() => {
    // Prospectos = cantidad de contactos con al menos una actividad en el período
    const contactosSet = new Set<string>();
    const contactosPrelistingSet = new Set<string>();

    for (const a of actividadesFiltradas) {
      if (a.contacto_id) {
        contactosSet.add(a.contacto_id);
        if (a.tipo === "prelisting") {
          contactosPrelistingSet.add(a.contacto_id);
        }
      }
    }

    const prospectosCount = contactosSet.size;
    const prelistingCount = contactosPrelistingSet.size;

    const captacionesCount = propiedadesFiltradas.length;
    const cierresCount = propiedadesFiltradas.filter(
      (p) => p.fecha_cierre && p.precio_cierre
    ).length;

    const conversionProspectoCierre =
      prospectosCount > 0
        ? (cierresCount / prospectosCount) * 100
        : null;

    const conversionProspectoPrelisting =
      prospectosCount > 0
        ? (prelistingCount / prospectosCount) * 100
        : null;

    const conversionPrelistingCaptacion =
      prelistingCount > 0
        ? (captacionesCount / prelistingCount) * 100
        : null;

    return {
      prospectosCount,
      prelistingCount,
      captacionesCount,
      cierresCount,
      conversionProspectoCierre,
      conversionProspectoPrelisting,
      conversionPrelistingCaptacion,
    };
  }, [actividadesFiltradas, propiedadesFiltradas]);

  // ==== KPIs generales ====
  const totalCaptaciones = propiedadesFiltradas.length;
  const totalCierres = propiedadesFiltradas.filter(
    (p) => p.fecha_cierre && p.precio_cierre
  ).length;
  const montoTotalCierres = tipologiaCierreStats.reduce(
    (acc, row) => acc + (row.sumCierre || 0),
    0
  );
  const totalActividades = actividadesFiltradas.length;

  // Tasa de absorción
  const tasaAbsorcion =
    totalCaptaciones > 0 ? (totalCierres / totalCaptaciones) * 100 : null;

  if (loading && (!empresaId || !asesorId)) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-500">
        Cargando Business Analytics…
      </div>
    );
  }

  // Blindaje de acceso: solo usuarios ASESOR pueden ver este módulo
  if (!loading && user && user.role !== "asesor") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6">
            <h1 className="text-base font-semibold text-slate-900">
              Acceso restringido
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              El módulo de{" "}
              <span className="font-semibold">Business Analytics</span> para
              asesores está disponible únicamente para perfiles de tipo
              asesor. Si necesitás acceder, consultá con el administrador de tu
              cuenta.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Máximos para mini barras
  const maxActTipo = Math.max(
    1,
    ...actividadesPorTipo.map((x) => x.count || 0)
  );
  const maxActAsesor = Math.max(
    1,
    ...actividadesPorAsesor.map((x) => x.count || 0)
  );

  const totalActividadesAsesores = actividadesPorAsesor.reduce(
    (acc, row) => acc + row.count,
    0
  );
  const totalActividadesTipos = actividadesPorTipo.reduce(
    (acc, row) => acc + row.count,
    0
  );

  // Ordenar para cards
  const actividadesPorAsesorSorted = [...actividadesPorAsesor].sort(
    (a, b) => b.count - a.count
  );
  const actividadesPorTipoSorted = [...actividadesPorTipo].sort(
    (a, b) => b.count - a.count
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Título + filtros */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Business Analytics
            </h1>
            <p className="mt-1 text-sm text-slate-600 max-w-xl">
              Visualizá tus métricas personales: captaciones, cierres, actividad y
              honorarios generados desde tu Business Tracker.
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
                <option value="30d">Últimos 30 días</option>
                <option value="90d">Últimos 3 meses</option>
                <option value="180d">Últimos 6 meses</option>
                <option value="365d">Último año</option>
              </select>
            </div>

            {/* Botón para volver al Tracker */}
            <Link
              href="/dashboard/asesor/tracker"
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-gray-50"
            >
              ← Volver al Tracker
            </Link>
          </div>
        </header>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
            {errorMsg}
          </div>
        )}

        {/* KPIs principales */}
        <section className="grid gap-4 md:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Captaciones</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {totalCaptaciones}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Propiedades captadas en el período.
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
            <p className="text-xs text-slate-500">Tasa de absorción</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {tasaAbsorcion != null ? `${tasaAbsorcion.toFixed(1)}%` : "—"}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Cierres sobre captaciones del período.
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
              Honorarios brutos calculados (1 o 2 puntas).
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
                  Distribución de tus propiedades captadas por tipología.
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
                  Distribución de montos de tus cierres por tipo de propiedad.
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

        {/* Honorarios + Ticket promedio (2 columnas) */}
        <section className="grid gap-6 md:grid-cols-2 items-start">
          {/* Honorarios empresa vs asesores */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Ingresos por honorarios
                </h2>
                <p className="text-[11px] text-slate-500">
                  Ajustá el reparto de honorarios netos entre empresa y asesor para ver el impacto económico.
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
                      const complement = 100 - value;
                      setEmpresaPctInput(String(value));
                      setAsesorPctInput(String(complement));
                      if (typeof window !== "undefined") {
                        localStorage.setItem(
                          "vai_honorarios_empresa_pct",
                          String(value)
                        );
                        localStorage.setItem(
                          "vai_honorarios_asesor_pct",
                          String(complement)
                        );
                      }
                    }}
                    className="w-14 rounded-full border border-gray-300 px-2 py-0.5 text-right"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">Asesor %</span>
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
                      const complement = 100 - value;
                      setAsesorPctInput(String(value));
                      setEmpresaPctInput(String(complement));
                      if (typeof window !== "undefined") {
                        localStorage.setItem(
                          "vai_honorarios_asesor_pct",
                          String(value)
                        );
                        localStorage.setItem(
                          "vai_honorarios_empresa_pct",
                          String(complement)
                        );
                      }
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
              <div className="flex flex-col items-end justify-around h-48 gap-4">
                <div className="flex justify-around w-full gap-4 items-end">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-8 rounded-t-lg bg-slate-900"
                      style={{ height: barHeight(honorariosBrutosTotal) }}
                    />
                    <span className="text-[11px] text-slate-700 text-center">
                      Total
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatNumber(honorariosBrutosTotal)}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-8 rounded-t-lg"
                      style={{
                        height: barHeight(netoEmpresa),
                        background:
                          "linear-gradient(to top, rgba(34,197,94,0.9), rgba(34,197,94,0.4))",
                      }}
                    />
                    <span className="text-[11px] text-slate-700 text-center">
                      Empresa ({empresaPct.toFixed(0)}%)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatNumber(netoEmpresa)}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-8 rounded-t-lg"
                      style={{
                        height: barHeight(netoAsesor),
                        background:
                          "linear-gradient(to top, rgba(56,189,248,0.9), rgba(56,189,248,0.4))",
                      }}
                    />
                    <span className="text-[11px] text-slate-700 text-center">
                      Asesor ({asesorPct.toFixed(0)}%)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatNumber(netoAsesor)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Ticket Promedio por tipología */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Ticket promedio por tipología
                </h2>
                <p className="text-[11px] text-slate-500">
                  Promedio de precio de cierre por tipo de propiedad.
                </p>
              </div>
              {globalAvgTicket != null && (
                <div className="text-right">
                  <p className="text-[10px] text-slate-500">
                    Ticket promedio general
                  </p>
                  <p className="text-xs font-semibold text-slate-900">
                    {formatNumber(globalAvgTicket)}
                  </p>
                </div>
              )}
            </div>

            {tipologiaCierreStats.length === 0 ? (
              <p className="text-xs text-slate-500">
                Todavía no hay cierres suficientes para calcular tickets.
              </p>
            ) : (
              <div className="space-y-2">
                {tipologiaCierreStats.map((row) => {
                  const avgTicket =
                    row.count > 0 ? row.sumCierre / row.count : 0;
                  return (
                    <div
                      key={row.tipologia}
                      className="flex items-center justify-between gap-2 text-[11px]"
                    >
                      <span className="w-28 text-slate-700 truncate">
                        {labelTipologia(row.tipologia)}
                      </span>
                      <div className="flex-1 mx-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[rgba(37,99,235,0.9)]"
                          style={{
                            width: `${
                              globalAvgTicket && globalAvgTicket > 0
                                ? Math.min(
                                    100,
                                    (avgTicket / globalAvgTicket) * 100
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="w-20 text-right text-slate-500">
                        {formatNumber(avgTicket)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Funnel comercial grande */}
        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Funnel Comercial: Prospección → Cierre
              </h2>
              <p className="text-[11px] text-slate-500">
                Seguimiento de tus contactos desde el primer contacto hasta el cierre.
              </p>
            </div>
            {avgDiasGlobal != null && (
              <div className="text-right">
                <p className="text-[10px] text-slate-500">
                  Tiempo promedio de venta (cierres)
                </p>
                <p className="text-xs font-semibold text-slate-900">
                  {avgDiasGlobal.toFixed(0)} días
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-4 text-xs">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">Prospección</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {prospectosCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Contactos con actividades en el período.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">Prelisting</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {prelistingCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Contactos que alcanzaron etapa de prelisting.
              </p>
              {conversionProspectoPrelisting != null && (
                <p className="mt-1 text-[10px] text-emerald-700">
                  {conversionProspectoPrelisting.toFixed(1)}% de los
                  prospectos.
                </p>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">Captación</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {captacionesCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Propiedades efectivamente captadas.
              </p>
              {conversionPrelistingCaptacion != null && (
                <p className="mt-1 text-[10px] text-emerald-700">
                  {conversionPrelistingCaptacion.toFixed(1)}% desde prelisting.
                </p>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">Cierres</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {cierresCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Operaciones cerradas con precio de cierre.
              </p>
              {conversionProspectoCierre != null && (
                <p className="mt-1 text-[10px] text-emerald-700">
                  {conversionProspectoCierre.toFixed(1)}% de conversión total
                  (prospecto → cierre).
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Actividades (cards) */}
        <section className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Actividad por asesor (en práctica, vos mismo) */}
            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Actividad por asesor
                </h2>
                <p className="text-[11px] text-slate-500">
                  Total actividades:{" "}
                  <span className="font-semibold">
                    {totalActividadesAsesores}
                  </span>
                </p>
              </div>
              {actividadesPorAsesorSorted.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No hay actividades registradas en este período.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-1">
                  {actividadesPorAsesorSorted.map((row) => {
                    const pct =
                      totalActividadesAsesores > 0
                        ? (row.count / totalActividadesAsesores) * 100
                        : 0;
                    return (
                      <div
                        key={row.id}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-slate-800 truncate">
                            {nombreAsesor(row.id)}
                          </span>
                          <span className="text-[11px] text-slate-600">
                            {row.count} act.
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[rgba(230,169,48,0.9)]"
                            style={{
                              width: `${
                                (row.count / maxActAsesor) * 100
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {pct.toFixed(1)}% del total del período.
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actividades por tipo */}
            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Actividades por tipo
                </h2>
                <p className="text-[11px] text-slate-500">
                  Total actividades:{" "}
                  <span className="font-semibold">
                    {totalActividadesTipos}
                  </span>
                </p>
              </div>
              {actividadesPorTipoSorted.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No hay actividades registradas en este período.
                </p>
              ) : (
                <div className="space-y-2">
                  {actividadesPorTipoSorted.map((item) => {
                    const pct =
                      totalActividadesTipos > 0
                        ? (item.count / totalActividadesTipos) * 100
                        : 0;
                    return (
                      <div
                        key={item.tipo}
                        className="flex flex-col gap-1 text-[11px]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-700">
                            {labelTipoActividad(item.tipo)}
                          </span>
                          <span className="text-slate-600">
                            {item.count} act.
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-slate-900"
                            style={{
                              width: `${
                                (item.count / maxActTipo) * 100
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {pct.toFixed(1)}% del total.
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
