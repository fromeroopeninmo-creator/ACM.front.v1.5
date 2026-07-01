"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

type Scope = "empresa" | "asesores" | "global";
type DateRangeKey = "30d" | "90d" | "180d" | "365d" | "custom";
type TipoOperacion = "venta" | "alquiler";
type Moneda = "ARS" | "USD";

interface TrackerContacto {
  id: string;
  empresa_id: string;
  asesor_id: string | null;
  tipo_operacion: string | null;
  tipologia: string | null;
  zona: string | null;
  estado: string | null;
  created_at: string;
}

interface TrackerPropiedad {
  id: string;
  empresa_id: string;
  asesor_id: string | null;
  tipologia: string | null;
  tipo_operacion: string | null;
  zona: string | null;
  dormitorios: number | null;
  precio_cierre: number | null;
  precio_actual: number | null;
  moneda: string | null;
  fecha_cierre: string | null;
  fecha_inicio_comercializacion: string | null;
  honorarios_pct_comprador: number | null;
  honorarios_pct_vendedor: number | null;
  porcentaje_asesor: number | null;
  precio_lista_inicial: number | null;

  alquiler_valor_mensual_inicial: number | null;
  alquiler_valor_mensual_actual: number | null;
  alquiler_duracion_meses: number | null;
  alquiler_fecha_inicio_contrato: string | null;
  alquiler_fecha_fin_contrato: string | null;
  alquiler_indice_actualizacion: string | null;
  alquiler_frecuencia_actualizacion_meses: number | null;
  alquiler_pct_actualizacion_estimado: number | null;
  alquiler_comision_base: string | null;
  alquiler_comision_pct: number | null;
  alquiler_comision_monto: number | null;
  alquiler_valor_total_contrato_base: number | null;
  alquiler_valor_total_contrato_proyectado: number | null;
  alquiler_valor_base_manual: number | null;
  alquiler_administra: boolean | null;
  alquiler_admin_pct: number | null;
  alquiler_admin_monto_mensual: number | null;
  alquiler_renovacion_fecha: string | null;
}

interface TrackerPropiedadTercero {
  id: string;
  empresa_id: string;
  asesor_id: string | null;
  tipologia: string | null;
  tipo_operacion: string | null;
  zona: string | null;
  precio_cierre: number | null;
  moneda: string | null;
  fecha_cierre: string | null;
  honorarios_pct_comprador: number | null;
  honorarios_pct_vendedor: number | null;
  created_at: string;
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

interface CurrencyTotals {
  ARS: number;
  USD: number;
}

interface TipologiaStats {
  tipologia: string;
  count: number;
  porcentaje: number;
}

interface CierreStats {
  tipologia: string;
  sumCierreARS: number;
  sumCierreUSD: number;
  count: number;
  sharePct: number;
  avgGap: number | null;
  avgDias: number | null;
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

const TIPOLOGIAS = [
  "casa",
  "departamento",
  "duplex",
  "ph",
  "oficina",
  "local",
  "terreno",
  "galpon",
  "cochera",
  "campo",
  "otro",
];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function subDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateKeyFromString(value: string | null | undefined): string {
  return value ? value.substring(0, 10) : "";
}

function formatDateDisplay(value: string | null | undefined): string {
  const key = dateKeyFromString(value);
  if (!key) return "—";
  const [year, month, day] = key.split("-");
  if (!year || !month || !day) return "—";
  return `${day}/${month}/${year.substring(2)}`;
}

function isValidDateKey(value: string | null | undefined): boolean {
  if (!value) return false;
  const key = value.substring(0, 10);
  if (key === "0001-01-01") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

function rangeStart(key: DateRangeKey): Date {
  const today = startOfDay(new Date());
  if (key === "30d") return subDays(today, 30);
  if (key === "90d") return subDays(today, 90);
  if (key === "180d") return subDays(today, 180);
  if (key === "365d") return subDays(today, 365);
  return subDays(today, 90);
}

function daysBetween(startStr: string | null, endStr: string | null): number | null {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const diffMs = end.getTime() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return days < 0 ? 0 : days;
}

function normalizeCurrency(moneda: string | null | undefined): Moneda {
  return moneda === "USD" ? "USD" : "ARS";
}

function emptyCurrencyTotals(): CurrencyTotals {
  return { ARS: 0, USD: 0 };
}

function addCurrency(total: CurrencyTotals, moneda: string | null | undefined, value: number) {
  const currency = normalizeCurrency(moneda);
  total[currency] += Number.isFinite(value) ? value : 0;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(n);
}

function formatCurrency(n: number | null | undefined, currency: Moneda = "ARS"): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatCurrencyTotals(totals: CurrencyTotals): string {
  const parts: string[] = [];
  if (totals.USD > 0) parts.push(formatCurrency(totals.USD, "USD"));
  if (totals.ARS > 0) parts.push(formatCurrency(totals.ARS, "ARS"));
  return parts.length ? parts.join(" · ") : "—";
}

function labelTipologia(t: string | null): string {
  if (!t || t === "sin_tipologia") return "Sin tipología";
  switch (t) {
    case "casa":
      return "Casa";
    case "departamento":
      return "Departamento";
    case "duplex":
      return "Dúplex";
    case "ph":
      return "PH";
    case "oficina":
      return "Oficina";
    case "local":
      return "Local";
    case "terreno":
      return "Terreno";
    case "galpon":
      return "Galpón / Depósito";
    case "cochera":
      return "Cochera";
    case "campo":
      return "Campo";
    case "otro":
      return "Otro";
    default:
      return t;
  }
}

function labelDormitorios(value: number | null | undefined): string {
  if (value == null) return "Sin dato";
  if (value === 0) return "Monoambiente";
  if (value === 1) return "1 dormitorio";
  return `${value} dormitorios`;
}

function labelZona(value: string | null | undefined): string {
  const clean = (value || "").trim();
  return clean || "Sin zona";
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
      return t || "Sin tipo";
  }
}

function isValidClose(p: TrackerPropiedad): boolean {
  return isValidDateKey(p.fecha_cierre) && p.precio_cierre != null && p.precio_cierre > 0;
}

function isValidTerceroClose(p: TrackerPropiedadTercero): boolean {
  return isValidDateKey(p.fecha_cierre) && p.precio_cierre != null && p.precio_cierre > 0;
}

function isValidAlquilerContrato(p: TrackerPropiedad): boolean {
  return p.tipo_operacion === "alquiler" && isValidDateKey(p.alquiler_fecha_inicio_contrato);
}

function alquilerValorMensual(p: TrackerPropiedad): number {
  return Number(p.alquiler_valor_mensual_actual ?? p.alquiler_valor_mensual_inicial ?? p.precio_actual ?? p.precio_lista_inicial ?? 0);
}

function alquilerValorTotalBase(p: TrackerPropiedad): number {
  const stored = Number(p.alquiler_valor_total_contrato_base ?? 0);
  if (stored > 0) return stored;
  const mensual = Number(p.alquiler_valor_mensual_inicial ?? p.precio_lista_inicial ?? 0);
  const meses = Number(p.alquiler_duracion_meses ?? 0);
  return mensual > 0 && meses > 0 ? mensual * meses : 0;
}

function calcularValorTotalProyectado(p: TrackerPropiedad): number {
  const stored = Number(p.alquiler_valor_total_contrato_proyectado ?? 0);
  if (stored > 0) return stored;

  const mensualInicial = Number(p.alquiler_valor_mensual_inicial ?? p.precio_lista_inicial ?? 0);
  const meses = Number(p.alquiler_duracion_meses ?? 0);
  const frecuencia = Number(p.alquiler_frecuencia_actualizacion_meses ?? 0);
  const pct = Number(p.alquiler_pct_actualizacion_estimado ?? 0);

  if (mensualInicial <= 0 || meses <= 0) return 0;
  if (frecuencia <= 0 || pct <= 0) return mensualInicial * meses;

  let total = 0;
  let valorMes = mensualInicial;
  for (let mes = 1; mes <= meses; mes++) {
    if (mes > 1 && (mes - 1) % frecuencia === 0) {
      valorMes = valorMes * (1 + pct / 100);
    }
    total += valorMes;
  }
  return total;
}

function alquilerBaseComision(p: TrackerPropiedad): number {
  const modo = p.alquiler_comision_base || "base_sin_actualizacion";
  if (modo === "manual") return Number(p.alquiler_valor_base_manual ?? 0);
  if (modo === "proyectado_con_actualizaciones") return calcularValorTotalProyectado(p);
  return alquilerValorTotalBase(p);
}

function alquilerComisionMonto(p: TrackerPropiedad): number {
  const stored = Number(p.alquiler_comision_monto ?? 0);
  if (stored > 0) return stored;
  const base = alquilerBaseComision(p);
  const pct = Number(p.alquiler_comision_pct ?? 0);
  return base > 0 && pct > 0 ? (base * pct) / 100 : 0;
}

function alquilerAdminMontoMensual(p: TrackerPropiedad): number {
  if (!p.alquiler_administra) return 0;
  const stored = Number(p.alquiler_admin_monto_mensual ?? 0);
  if (stored > 0) return stored;
  const valorMensual = alquilerValorMensual(p);
  const pct = Number(p.alquiler_admin_pct ?? 0);
  return valorMensual > 0 && pct > 0 ? (valorMensual * pct) / 100 : 0;
}

function proximaActualizacionAlquilerKey(p: TrackerPropiedad, fromDate: Date = new Date()): string | null {
  if (!isValidAlquilerContrato(p)) return null;
  const frecuencia = Number(p.alquiler_frecuencia_actualizacion_meses ?? 0);
  if (frecuencia <= 0) return null;

  const inicioKey = dateKeyFromString(p.alquiler_fecha_inicio_contrato);
  const inicio = startOfDay(new Date(inicioKey));
  if (Number.isNaN(inicio.getTime())) return null;

  const today = startOfDay(fromDate);
  const finKey = dateKeyFromString(p.alquiler_fecha_fin_contrato);
  const fin = finKey ? startOfDay(new Date(finKey)) : null;

  let candidate = addMonths(inicio, frecuencia);
  let guard = 0;
  while (candidate < today && guard < 120) {
    candidate = addMonths(candidate, frecuencia);
    guard += 1;
  }

  if (fin && candidate > fin) return null;
  return toDateKey(candidate);
}

function honorariosVentaPropia(p: TrackerPropiedad): number {
  if (!isValidClose(p)) return 0;
  const precio = Number(p.precio_cierre ?? 0);
  const pct = Number(p.honorarios_pct_comprador ?? 0) + Number(p.honorarios_pct_vendedor ?? 0);
  return precio > 0 && pct > 0 ? (precio * pct) / 100 : 0;
}

function honorariosVentaTercero(p: TrackerPropiedadTercero): number {
  if (!isValidTerceroClose(p)) return 0;
  const precio = Number(p.precio_cierre ?? 0);
  const pct = Number(p.honorarios_pct_comprador ?? 0) + Number(p.honorarios_pct_vendedor ?? 0);
  return precio > 0 && pct > 0 ? (precio * pct) / 100 : 0;
}

export default function AsesorTrackerAnaliticoPage() {
  const { user } = useAuth();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [asesorId, setAsesorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [contactos, setContactos] = useState<TrackerContacto[]>([]);
  const [propiedades, setPropiedades] = useState<TrackerPropiedad[]>([]);
  const [propiedadesTerceros, setPropiedadesTerceros] = useState<TrackerPropiedadTercero[]>([]);
  const [actividades, setActividades] = useState<TrackerActividad[]>([]);
  const [asesores, setAsesores] = useState<Asesor[]>([]);

  // En asesor no hay selector de scope: siempre se muestran solo sus propios datos.
  const [scope] = useState<Scope>("global");
  const [selectedAsesorId] = useState<string>("");
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("90d");
  const [customFrom, setCustomFrom] = useState<string>(toDateKey(subDays(new Date(), 90)));
  const [customTo, setCustomTo] = useState<string>(toDateKey(new Date()));
  const [tipoOperacion, setTipoOperacion] = useState<TipoOperacion>("venta");
  const [alquilerZonaFiltro, setAlquilerZonaFiltro] = useState<string>("");
  const [alquilerTipologiaFiltro, setAlquilerTipologiaFiltro] = useState<string>("");
  const [alquilerDormitoriosFiltro, setAlquilerDormitoriosFiltro] = useState<string>("");

  const [empresaPctInput, setEmpresaPctInput] = useState<string>("60");
  const [asesorPctInput, setAsesorPctInput] = useState<string>("40");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchAsesor = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      if (user.role !== "asesor") {
        setLoading(false);
        return;
      }

      if (!user.email) {
        setErrorMsg("No se pudo obtener el email del asesor autenticado.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("asesores")
        .select("id, empresa_id, nombre, apellido, email")
        .eq("email", user.email)
        .maybeSingle();

      if (error) {
        console.error("Error buscando asesor para tracker analítico:", error);
        setErrorMsg("No se pudo obtener tu perfil de asesor.");
        setLoading(false);
        return;
      }

      if (!data) {
        setErrorMsg("No se encontró tu perfil de asesor para usar Analytics.");
        setLoading(false);
        return;
      }

      setAsesorId(data.id);
      setEmpresaId(data.empresa_id ?? null);
      setAsesores([
        {
          id: data.id,
          nombre: data.nombre ?? null,
          apellido: data.apellido ?? null,
        },
      ]);
      setLoading(false);
    };

    fetchAsesor();
  }, [user]);

  useEffect(() => {
    if (!empresaId || !asesorId) return;

    const fetchAll = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const [contactosRes, propiedadesRes, tercerosRes, actividadesRes] = await Promise.all([
          supabase
            .from("tracker_contactos")
            .select("id, empresa_id, asesor_id, tipo_operacion, tipologia, zona, estado, created_at")
            .eq("empresa_id", empresaId)
            .eq("asesor_id", asesorId),
          supabase
            .from("tracker_propiedades")
            .select(
              `
              id,
              empresa_id,
              asesor_id,
              tipologia,
              tipo_operacion,
              zona,
              dormitorios,
              precio_cierre,
              precio_actual,
              moneda,
              fecha_cierre,
              fecha_inicio_comercializacion,
              honorarios_pct_comprador,
              honorarios_pct_vendedor,
              porcentaje_asesor,
              precio_lista_inicial,
              alquiler_valor_mensual_inicial,
              alquiler_valor_mensual_actual,
              alquiler_duracion_meses,
              alquiler_fecha_inicio_contrato,
              alquiler_fecha_fin_contrato,
              alquiler_indice_actualizacion,
              alquiler_frecuencia_actualizacion_meses,
              alquiler_pct_actualizacion_estimado,
              alquiler_comision_base,
              alquiler_comision_pct,
              alquiler_comision_monto,
              alquiler_valor_total_contrato_base,
              alquiler_valor_total_contrato_proyectado,
              alquiler_valor_base_manual,
              alquiler_administra,
              alquiler_admin_pct,
              alquiler_admin_monto_mensual,
              alquiler_renovacion_fecha
            `
            )
            .eq("empresa_id", empresaId)
            .eq("asesor_id", asesorId),
          supabase
            .from("tracker_propiedades_terceros")
            .select(
              `
              id,
              empresa_id,
              asesor_id,
              tipologia,
              tipo_operacion,
              zona,
              precio_cierre,
              moneda,
              fecha_cierre,
              honorarios_pct_comprador,
              honorarios_pct_vendedor,
              created_at
            `
            )
            .eq("empresa_id", empresaId)
            .eq("asesor_id", asesorId),
          supabase
            .from("tracker_actividades")
            .select("id, empresa_id, asesor_id, contacto_id, tipo, fecha_programada, created_at")
            .eq("empresa_id", empresaId)
            .eq("asesor_id", asesorId),
        ]);

        if (contactosRes.error || propiedadesRes.error || tercerosRes.error || actividadesRes.error) {
          console.error("Errores cargando tracker analítico del asesor:", {
            contactosErr: contactosRes.error,
            propiedadesErr: propiedadesRes.error,
            tercerosErr: tercerosRes.error,
            actividadesErr: actividadesRes.error,
          });
          setErrorMsg("No se pudieron cargar todos los datos del tracker.");
        }

        setContactos((contactosRes.data as TrackerContacto[]) ?? []);
        setPropiedades((propiedadesRes.data as TrackerPropiedad[]) ?? []);
        setPropiedadesTerceros((tercerosRes.data as TrackerPropiedadTercero[]) ?? []);
        setActividades((actividadesRes.data as TrackerActividad[]) ?? []);
      } catch (err) {
        console.error("Error inesperado cargando tracker analítico del asesor:", err);
        setErrorMsg("Error inesperado al cargar datos del tracker.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [empresaId, asesorId]);

  const rangeBounds = useMemo(() => {
    const start = rangeKey === "custom" ? startOfDay(new Date(customFrom || toDateKey(subDays(new Date(), 90)))) : rangeStart(rangeKey);
    const end = rangeKey === "custom" ? startOfDay(new Date(customTo || toDateKey(new Date()))) : startOfDay(new Date());
    return {
      startKey: toDateKey(start),
      endKey: toDateKey(end),
    };
  }, [rangeKey, customFrom, customTo]);

  const isInRange = (dateValue: string | null | undefined) => {
    const key = dateKeyFromString(dateValue);
    if (!key) return false;
    return key >= rangeBounds.startKey && key <= rangeBounds.endKey;
  };

  const filterScope = (asesorId: string | null | undefined) => {
    if (scope === "global") return true;
    if (scope === "empresa") return !asesorId;
    if (!asesorId) return false;
    if (!selectedAsesorId) return true;
    return asesorId === selectedAsesorId;
  };

  const contactosFiltrados = useMemo(() => {
    return contactos.filter((c) => {
      if (!filterScope(c.asesor_id)) return false;
      if (c.tipo_operacion !== tipoOperacion) return false;
      return isInRange(c.created_at);
    });
  }, [contactos, scope, selectedAsesorId, tipoOperacion, rangeBounds]);

  const actividadesFiltradas = useMemo(() => {
    return actividades.filter((a) => {
      if (!filterScope(a.asesor_id)) return false;
      return isInRange(a.fecha_programada || a.created_at);
    });
  }, [actividades, scope, selectedAsesorId, rangeBounds]);

  const propiedadesOperacion = useMemo(() => {
    return propiedades.filter((p) => p.tipo_operacion === tipoOperacion && filterScope(p.asesor_id));
  }, [propiedades, tipoOperacion, scope, selectedAsesorId]);

  const propiedadesCaptadasEnRango = useMemo(() => {
    return propiedadesOperacion.filter((p) => isInRange(p.fecha_inicio_comercializacion));
  }, [propiedadesOperacion, rangeBounds]);

  const ventasPropiasEnRango = useMemo(() => {
    return propiedadesOperacion.filter((p) => p.tipo_operacion === "venta" && isValidClose(p) && isInRange(p.fecha_cierre));
  }, [propiedadesOperacion, rangeBounds]);

  const ventasTercerosEnRango = useMemo(() => {
    if (tipoOperacion !== "venta") return [];
    return propiedadesTerceros.filter((p) => {
      if (p.tipo_operacion !== "venta") return false;
      if (!filterScope(p.asesor_id)) return false;
      if (!isValidTerceroClose(p)) return false;
      return isInRange(p.fecha_cierre);
    });
  }, [propiedadesTerceros, tipoOperacion, scope, selectedAsesorId, rangeBounds]);

  const alquileresConContratoEnRango = useMemo(() => {
    if (tipoOperacion !== "alquiler") return [];
    return propiedadesOperacion.filter((p) => isValidAlquilerContrato(p) && isInRange(p.alquiler_fecha_inicio_contrato));
  }, [propiedadesOperacion, tipoOperacion, rangeBounds]);

  const alquileresAdministradosEnRango = useMemo(() => {
    return alquileresConContratoEnRango.filter((p) => p.alquiler_administra === true);
  }, [alquileresConContratoEnRango]);

  const zonasAlquilerOptions = useMemo(() => {
    const zonas = new Set<string>();
    propiedadesOperacion.forEach((p) => {
      if (p.tipo_operacion !== "alquiler") return;
      const zona = labelZona(p.zona);
      if (zona !== "Sin zona") zonas.add(zona);
    });
    return Array.from(zonas).sort((a, b) => a.localeCompare(b, "es"));
  }, [propiedadesOperacion]);

  const matchesAlquilerExtraFilters = (p: TrackerPropiedad) => {
    if (alquilerZonaFiltro && labelZona(p.zona) !== alquilerZonaFiltro) return false;
    if (alquilerTipologiaFiltro && (p.tipologia || "sin_tipologia") !== alquilerTipologiaFiltro) return false;

    if (alquilerDormitoriosFiltro) {
      const dormitorios = p.dormitorios;
      if (alquilerDormitoriosFiltro === "sin_dato" && dormitorios != null) return false;
      if (alquilerDormitoriosFiltro === "4plus" && (dormitorios == null || dormitorios < 4)) return false;
      if (!["sin_dato", "4plus"].includes(alquilerDormitoriosFiltro) && String(dormitorios ?? "") !== alquilerDormitoriosFiltro) return false;
    }

    return true;
  };

  const contactosAlquilerFiltrados = useMemo(() => {
    if (tipoOperacion !== "alquiler") return contactosFiltrados;
    return contactosFiltrados.filter((c) => {
      if (alquilerZonaFiltro && labelZona(c.zona) !== alquilerZonaFiltro) return false;
      if (alquilerTipologiaFiltro && (c.tipologia || "sin_tipologia") !== alquilerTipologiaFiltro) return false;
      return true;
    });
  }, [contactosFiltrados, tipoOperacion, alquilerZonaFiltro, alquilerTipologiaFiltro]);

  const alquilerPropiedadesEnRango = useMemo(() => {
    return propiedadesCaptadasEnRango.filter((p) => p.tipo_operacion === "alquiler" && matchesAlquilerExtraFilters(p));
  }, [propiedadesCaptadasEnRango, alquilerZonaFiltro, alquilerTipologiaFiltro, alquilerDormitoriosFiltro]);

  const alquileresConContratoFiltrados = useMemo(() => {
    return alquileresConContratoEnRango.filter((p) => matchesAlquilerExtraFilters(p));
  }, [alquileresConContratoEnRango, alquilerZonaFiltro, alquilerTipologiaFiltro, alquilerDormitoriosFiltro]);

  const alquileresAdministradosFiltrados = useMemo(() => {
    return alquileresConContratoFiltrados.filter((p) => p.alquiler_administra === true);
  }, [alquileresConContratoFiltrados]);

  const contratosProximosAFinalizar = useMemo(() => {
    const todayKey = toDateKey(new Date());
    const limitKey = toDateKey(addDays(new Date(), 30));
    return propiedadesOperacion
      .filter((p) => p.tipo_operacion === "alquiler" && matchesAlquilerExtraFilters(p))
      .filter((p) => {
        const finKey = dateKeyFromString(p.alquiler_fecha_fin_contrato);
        return finKey >= todayKey && finKey <= limitKey;
      })
      .sort((a, b) => dateKeyFromString(a.alquiler_fecha_fin_contrato).localeCompare(dateKeyFromString(b.alquiler_fecha_fin_contrato)));
  }, [propiedadesOperacion, alquilerZonaFiltro, alquilerTipologiaFiltro, alquilerDormitoriosFiltro]);

  const alquileresProximosAActualizar = useMemo(() => {
    const todayKey = toDateKey(new Date());
    const limitKey = toDateKey(addDays(new Date(), 30));
    return propiedadesOperacion
      .filter((p) => p.tipo_operacion === "alquiler" && matchesAlquilerExtraFilters(p))
      .map((p) => ({ propiedad: p, fecha: proximaActualizacionAlquilerKey(p) }))
      .filter((row): row is { propiedad: TrackerPropiedad; fecha: string } => !!row.fecha && row.fecha >= todayKey && row.fecha <= limitKey)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [propiedadesOperacion, alquilerZonaFiltro, alquilerTipologiaFiltro, alquilerDormitoriosFiltro]);


  const nombreAsesor = (id: string | null) => {
    const found = asesores.find((a) => a.id === id || (!id && a.id === asesorId));
    if (!found) return "Asesor";
    const nombre = [found.nombre, found.apellido].filter(Boolean).join(" ");
    return nombre || "Asesor";
  };

  const captadasStatsInput = tipoOperacion === "alquiler" ? alquilerPropiedadesEnRango : propiedadesCaptadasEnRango;

  const tipologiaCaptadasStats = useMemo<TipologiaStats[]>(() => {
    const counts = new Map<string, number>();

    for (const p of captadasStatsInput) {
      const key = p.tipologia || "sin_tipologia";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const entries = Array.from(counts.entries());
    const totalCount = entries.reduce((acc, [, count]) => acc + count, 0) || 1;

    return entries
      .map(([tipologia, count]) => ({
        tipologia,
        count,
        porcentaje: (count / totalCount) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }, [captadasStatsInput]);

  const cierreStatsInput = useMemo(() => {
    if (tipoOperacion === "venta") {
      return [
        ...ventasPropiasEnRango.map((p) => ({
          id: p.id,
          tipologia: p.tipologia,
          precio: Number(p.precio_cierre ?? 0),
          moneda: normalizeCurrency(p.moneda),
          precioLista: p.precio_lista_inicial,
          fechaInicio: p.fecha_inicio_comercializacion,
          fechaCierre: p.fecha_cierre,
          source: "propia" as const,
        })),
        ...ventasTercerosEnRango.map((p) => ({
          id: p.id,
          tipologia: p.tipologia,
          precio: Number(p.precio_cierre ?? 0),
          moneda: normalizeCurrency(p.moneda),
          precioLista: null,
          fechaInicio: null,
          fechaCierre: p.fecha_cierre,
          source: "tercero" as const,
        })),
      ];
    }

    return alquileresConContratoFiltrados.map((p) => ({
      id: p.id,
      tipologia: p.tipologia,
      precio: alquilerValorMensual(p),
      moneda: normalizeCurrency(p.moneda),
      precioLista: null,
      fechaInicio: p.fecha_inicio_comercializacion,
      fechaCierre: p.alquiler_fecha_inicio_contrato,
      source: "alquiler" as const,
    }));
  }, [tipoOperacion, ventasPropiasEnRango, ventasTercerosEnRango, alquileresConContratoFiltrados]);

  const { tipologiaCierreStats, avgGapGlobal, avgDiasGlobal } = useMemo(() => {
    const map = new Map<
      string,
      {
        sumCierreARS: number;
        sumCierreUSD: number;
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

    for (const row of cierreStatsInput) {
      if (!row.precio || row.precio <= 0) continue;
      const key = row.tipologia || "sin_tipologia";
      const bucket = map.get(key) || {
        sumCierreARS: 0,
        sumCierreUSD: 0,
        count: 0,
        sumGapPct: 0,
        countGap: 0,
        sumDias: 0,
        countDias: 0,
      };

      if (row.moneda === "USD") bucket.sumCierreUSD += row.precio;
      else bucket.sumCierreARS += row.precio;
      bucket.count += 1;

      if (row.precioLista != null && row.precioLista > 0) {
        const gapPct = ((row.precioLista - row.precio) / row.precioLista) * 100;
        bucket.sumGapPct += gapPct;
        bucket.countGap += 1;
        globalGapSum += gapPct;
        globalGapCount += 1;
      }

      const dias = daysBetween(row.fechaInicio, row.fechaCierre);
      if (dias != null) {
        bucket.sumDias += dias;
        bucket.countDias += 1;
        globalDiasSum += dias;
        globalDiasCount += 1;
      }

      map.set(key, bucket);
    }

    const entries = Array.from(map.entries());
    const totalCount = entries.reduce((acc, [, v]) => acc + v.count, 0) || 1;

    const tipologiaCierreStats: CierreStats[] = entries
      .map(([tipologia, v]) => ({
        tipologia,
        sumCierreARS: v.sumCierreARS,
        sumCierreUSD: v.sumCierreUSD,
        count: v.count,
        sharePct: (v.count / totalCount) * 100,
        avgGap: v.countGap > 0 ? v.sumGapPct / v.countGap : null,
        avgDias: v.countDias > 0 ? v.sumDias / v.countDias : null,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      tipologiaCierreStats,
      avgGapGlobal: globalGapCount > 0 ? globalGapSum / globalGapCount : null,
      avgDiasGlobal: globalDiasCount > 0 ? globalDiasSum / globalDiasCount : null,
    };
  }, [cierreStatsInput]);

  const tipologiaColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    let colorIdx = 0;

    const assignColor = (tipologiaRaw: string | null | undefined) => {
      if (!tipologiaRaw) return;
      const key = tipologiaRaw;
      if (!map[key]) {
        map[key] = PIE_COLORS[colorIdx % PIE_COLORS.length];
        colorIdx++;
      }
    };

    tipologiaCaptadasStats.forEach((item) => assignColor(item.tipologia));
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
        color: tipologiaColorMap[item.tipologia] ?? PIE_COLORS[idx % PIE_COLORS.length],
      };
    });
  }, [tipologiaCaptadasStats, tipologiaColorMap]);

  const pieCaptadasBackground =
    pieCaptadasSegments.length === 0
      ? "conic-gradient(#e5e7eb 0 100%)"
      : `conic-gradient(${pieCaptadasSegments
          .map((s) => `${s.color} ${s.start.toFixed(2)}% ${s.end.toFixed(2)}%`)
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
        sumCierreARS: item.sumCierreARS,
        sumCierreUSD: item.sumCierreUSD,
        porcentaje: item.sharePct,
        start,
        end,
        color: tipologiaColorMap[item.tipologia] ?? PIE_COLORS[idx % PIE_COLORS.length],
      };
    });
  }, [tipologiaCierreStats, tipologiaColorMap]);

  const pieCierresBackground =
    pieCierresSegments.length === 0
      ? "conic-gradient(#e5e7eb 0 100%)"
      : `conic-gradient(${pieCierresSegments
          .map((s) => `${s.color} ${s.start.toFixed(2)}% ${s.end.toFixed(2)}%`)
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

    const radius = 32;

    return segments.map((seg) => {
      const mid = (seg.start + seg.end) / 2;
      const angleRad = (mid / 100) * 2 * Math.PI - Math.PI / 2;
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

  const ventasHonorariosTotales = useMemo(() => {
    const total = emptyCurrencyTotals();
    ventasPropiasEnRango.forEach((p) => addCurrency(total, p.moneda, honorariosVentaPropia(p)));
    ventasTercerosEnRango.forEach((p) => addCurrency(total, p.moneda, honorariosVentaTercero(p)));
    return total;
  }, [ventasPropiasEnRango, ventasTercerosEnRango]);

  const ventasMontosTotales = useMemo(() => {
    const total = emptyCurrencyTotals();
    ventasPropiasEnRango.forEach((p) => addCurrency(total, p.moneda, Number(p.precio_cierre ?? 0)));
    ventasTercerosEnRango.forEach((p) => addCurrency(total, p.moneda, Number(p.precio_cierre ?? 0)));
    return total;
  }, [ventasPropiasEnRango, ventasTercerosEnRango]);

  const alquilerHonorariosContratos = useMemo(() => {
    const total = emptyCurrencyTotals();
    alquileresConContratoFiltrados.forEach((p) => addCurrency(total, p.moneda, alquilerComisionMonto(p)));
    return total;
  }, [alquileresConContratoFiltrados]);

  const alquilerAdministracionMensual = useMemo(() => {
    const total = emptyCurrencyTotals();
    alquileresAdministradosFiltrados.forEach((p) => addCurrency(total, p.moneda, alquilerAdminMontoMensual(p)));
    return total;
  }, [alquileresAdministradosFiltrados]);

  const alquilerValorMensualAdministrado = useMemo(() => {
    const total = emptyCurrencyTotals();
    alquileresAdministradosFiltrados.forEach((p) => addCurrency(total, p.moneda, alquilerValorMensual(p)));
    return total;
  }, [alquileresAdministradosFiltrados]);

  const alquilerValorTotalContratos = useMemo(() => {
    const total = emptyCurrencyTotals();
    alquileresConContratoFiltrados.forEach((p) => addCurrency(total, p.moneda, alquilerBaseComision(p)));
    return total;
  }, [alquileresConContratoFiltrados]);

  const alquilerValorMensualStats = useMemo(() => {
    const values = alquileresConContratoFiltrados
      .map((p) => alquilerValorMensual(p))
      .filter((value) => value > 0);

    if (!values.length) {
      return { promedio: null as number | null, minimo: null as number | null, maximo: null as number | null, casos: 0 };
    }

    return {
      promedio: values.reduce((acc, value) => acc + value, 0) / values.length,
      minimo: Math.min(...values),
      maximo: Math.max(...values),
      casos: values.length,
    };
  }, [alquileresConContratoFiltrados]);

  const alquilerRankingZonaStats = useMemo(() => {
    const map = new Map<
      string,
      {
        zona: string;
        count: number;
        sumValorMensual: number;
        administrados: number;
        sumAdmin: number;
      }
    >();

    for (const p of alquileresConContratoFiltrados) {
      const zona = labelZona(p.zona);
      const bucket = map.get(zona) || {
        zona,
        count: 0,
        sumValorMensual: 0,
        administrados: 0,
        sumAdmin: 0,
      };

      bucket.count += 1;
      bucket.sumValorMensual += alquilerValorMensual(p);
      if (p.alquiler_administra) {
        bucket.administrados += 1;
        bucket.sumAdmin += alquilerAdminMontoMensual(p);
      }
      map.set(zona, bucket);
    }

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        promedio: row.count > 0 ? row.sumValorMensual / row.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [alquileresConContratoFiltrados]);

  const empresaPct = Math.min(100, Math.max(0, Number(empresaPctInput) || 0));
  const asesorPct = Math.min(100, Math.max(0, Number(asesorPctInput) || 0));

  const honorariosReferenciaARS = tipoOperacion === "venta" ? ventasHonorariosTotales.ARS : alquilerHonorariosContratos.ARS;
  const honorariosReferenciaUSD = tipoOperacion === "venta" ? ventasHonorariosTotales.USD : alquilerHonorariosContratos.USD;
  const honorariosBrutosTotal = honorariosReferenciaUSD > 0 ? honorariosReferenciaUSD : honorariosReferenciaARS;
  const honorariosBrutosCurrency: Moneda = honorariosReferenciaUSD > 0 ? "USD" : "ARS";

  const netoEmpresa = (honorariosBrutosTotal * empresaPct) / 100;
  const netoAsesor = (honorariosBrutosTotal * asesorPct) / 100;
  const maxIngreso = Math.max(honorariosBrutosTotal, netoEmpresa, netoAsesor, 1);
  const barHeight = (value: number) => `${Math.max(8, (value / maxIngreso) * 140)}px`;

  const globalAvgTicket = useMemo(() => {
    const count = cierreStatsInput.length;
    if (count === 0) return null;
    const preferredCurrency = tipoOperacion === "venta" ? "USD" : "ARS";
    const sameCurrency = cierreStatsInput.filter((row) => row.moneda === preferredCurrency && row.precio > 0);
    if (sameCurrency.length === 0) return null;
    return sameCurrency.reduce((acc, row) => acc + row.precio, 0) / sameCurrency.length;
  }, [cierreStatsInput, tipoOperacion]);

  const actividadesPorTipo = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of actividadesFiltradas) {
      const key = a.tipo || "sin_tipo";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([tipo, count]) => ({ tipo, count }));
  }, [actividadesFiltradas]);

  const actividadesPorAsesor = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of actividadesFiltradas) {
      const id = a.asesor_id ?? "__empresa__";
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([id, count]) => ({ id, count }));
  }, [actividadesFiltradas]);

  const actividadesPorAsesorSorted = [...actividadesPorAsesor].sort((a, b) => b.count - a.count);
  const actividadesPorTipoSorted = [...actividadesPorTipo].sort((a, b) => b.count - a.count);

  const totalActividadesAsesores = actividadesPorAsesor.reduce((acc, row) => acc + row.count, 0);
  const totalActividadesTipos = actividadesPorTipo.reduce((acc, row) => acc + row.count, 0);
  const maxActTipo = Math.max(1, ...actividadesPorTipo.map((x) => x.count || 0));
  const maxActAsesor = Math.max(1, ...actividadesPorAsesor.map((x) => x.count || 0));

  const funnelVentas = useMemo(() => {
    const contactosSet = new Set(contactosFiltrados.map((c) => c.id));
    const prelistingSet = new Set<string>();

    contactosFiltrados.forEach((c) => {
      if (["prelisting", "vai_factibilidad", "captado", "cierre"].includes(c.estado || "")) {
        prelistingSet.add(c.id);
      }
    });

    actividadesFiltradas.forEach((a) => {
      if (a.tipo === "prelisting" && a.contacto_id) prelistingSet.add(a.contacto_id);
    });

    const prospectosCount = contactosSet.size;
    const prelistingCount = prelistingSet.size;
    const captacionesCount = propiedadesCaptadasEnRango.length;
    const cierresCount = ventasPropiasEnRango.length;

    return {
      prospectosCount,
      prelistingCount,
      captacionesCount,
      cierresCount,
      conversionProspectoPrelisting: prospectosCount > 0 ? (prelistingCount / prospectosCount) * 100 : null,
      conversionPrelistingCaptacion: prelistingCount > 0 ? (captacionesCount / prelistingCount) * 100 : null,
      conversionProspectoCierre: prospectosCount > 0 ? (cierresCount / prospectosCount) * 100 : null,
    };
  }, [contactosFiltrados, actividadesFiltradas, propiedadesCaptadasEnRango, ventasPropiasEnRango]);

  const totalCaptaciones = propiedadesCaptadasEnRango.length;
  const totalCierres = tipoOperacion === "venta" ? ventasPropiasEnRango.length : alquileresConContratoFiltrados.length;
  const totalTerceros = ventasTercerosEnRango.length;
  const totalOperaciones = tipoOperacion === "venta" ? ventasPropiasEnRango.length + ventasTercerosEnRango.length : alquileresConContratoFiltrados.length;
  const tasaAbsorcion = totalCaptaciones > 0 ? (totalCierres / totalCaptaciones) * 100 : null;

  if (loading && (!empresaId || !asesorId)) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-500">
        Cargando tracker analítico…
      </div>
    );
  }

  if (!loading && user && user.role !== "asesor") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6">
            <h1 className="text-base font-semibold text-slate-900">Acceso restringido</h1>
            <p className="mt-2 text-sm text-slate-600">
              El módulo de <span className="font-semibold">Business Analytics</span> para asesores está disponible únicamente para perfiles de tipo asesor. Si necesitás acceder, consultá con el administrador de tu cuenta.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const renderMainKpis = () => {
    if (tipoOperacion === "alquiler") {
      return (
        <section className="grid gap-4 md:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Prospectos</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{contactosAlquilerFiltrados.length}</p>
            <p className="mt-1 text-[11px] text-slate-500">Contactos de alquiler ingresados en el período.</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Propiedades en alquiler</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{alquilerPropiedadesEnRango.length}</p>
            <p className="mt-1 text-[11px] text-slate-500">Inmuebles cargados para alquiler.</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Propiedades alquiladas</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{alquileresConContratoFiltrados.length}</p>
            <p className="mt-1 text-[11px] text-slate-500">Contratos iniciados dentro del período.</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Administración de alquileres</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{alquileresAdministradosFiltrados.length}</p>
            <p className="mt-1 text-[11px] text-slate-500">Ingreso mensual adm.: {formatCurrencyTotals(alquilerAdministracionMensual)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Honorarios por contratos</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrencyTotals(alquilerHonorariosContratos)}</p>
            <p className="mt-1 text-[11px] text-slate-500">Valor contratos: {formatCurrencyTotals(alquilerValorTotalContratos)}</p>
          </div>
        </section>
      );
    }

    return (
      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Captaciones propias</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{totalCaptaciones}</p>
            <p className="mt-1 text-[11px] text-slate-500">Propiedades captadas en el período.</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Cierres propios</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{ventasPropiasEnRango.length}</p>
            <p className="mt-1 text-[11px] text-slate-500">Captaciones propias con fecha válida y precio de cierre.</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Ventas de terceros</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{totalTerceros}</p>
            <p className="mt-1 text-[11px] text-slate-500">Suman a producción, no a captaciones.</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Ventas totales</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{totalOperaciones}</p>
            <p className="mt-1 text-[11px] text-slate-500">Propias: {ventasPropiasEnRango.length} · Terceros: {ventasTercerosEnRango.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Tasa de absorción</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{tasaAbsorcion != null ? `${tasaAbsorcion.toFixed(1)}%` : "—"}</p>
            <p className="mt-1 text-[11px] text-slate-500">Cierres propios sobre captaciones propias.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:max-w-3xl md:mx-auto">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center md:text-left">
            <p className="text-xs text-slate-500">Monto total de cierres</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrencyTotals(ventasMontosTotales)}</p>
            <p className="mt-1 text-[11px] text-slate-500">Suma de tickets propios + terceros.</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center md:text-left">
            <p className="text-xs text-slate-500">Honorarios totales</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrencyTotals(ventasHonorariosTotales)}</p>
            <p className="mt-1 text-[11px] text-slate-500">Comprador + vendedor, propios + terceros.</p>
          </div>
        </div>
      </section>
    );
  };

  const kpiTitleCaptadas = tipoOperacion === "venta" ? "Marketshare por Tipología Captada" : "Propiedades en alquiler por tipología";
  const kpiTitleCierres = tipoOperacion === "venta" ? "Marketshare de Cierres por Tipología" : "Propiedades alquiladas por tipología";
  const cierreLegendWord = tipoOperacion === "venta" ? "operaciones" : "alquileres";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Business Analytics</h1>
            <p className="mt-1 text-sm text-slate-600 max-w-xl">
              Visualizá tu desempeño personal: ventas, alquileres, actividad comercial, honorarios, administración y conversión.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 items-center justify-start md:justify-end text-xs">
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Operación:</span>
              <select
                value={tipoOperacion}
                onChange={(e) => setTipoOperacion(e.target.value as TipoOperacion)}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700"
              >
                <option value="venta">Ventas</option>
                <option value="alquiler">Alquileres</option>
              </select>
            </div>

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
                <option value="custom">Personalizado</option>
              </select>
            </div>

            {rangeKey === "custom" && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-slate-500">Desde:</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700"
                />
                <span className="text-slate-500">Hasta:</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700"
                />
              </div>
            )}

            {tipoOperacion === "alquiler" && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-slate-500">Zona:</span>
                <select
                  value={alquilerZonaFiltro}
                  onChange={(e) => setAlquilerZonaFiltro(e.target.value)}
                  className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700 max-w-[190px]"
                >
                  <option value="">Todas</option>
                  {zonasAlquilerOptions.map((zona) => (
                    <option key={zona} value={zona}>
                      {zona}
                    </option>
                  ))}
                </select>

                <span className="text-slate-500">Tipología:</span>
                <select
                  value={alquilerTipologiaFiltro}
                  onChange={(e) => setAlquilerTipologiaFiltro(e.target.value)}
                  className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700"
                >
                  <option value="">Todas</option>
                  <option value="sin_tipologia">Sin tipología</option>
                  {TIPOLOGIAS.map((tipologia) => (
                    <option key={tipologia} value={tipologia}>
                      {labelTipologia(tipologia)}
                    </option>
                  ))}
                </select>

                <span className="text-slate-500">Dorm./amb.:</span>
                <select
                  value={alquilerDormitoriosFiltro}
                  onChange={(e) => setAlquilerDormitoriosFiltro(e.target.value)}
                  className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700"
                >
                  <option value="">Todos</option>
                  <option value="0">Monoambiente</option>
                  <option value="1">1 dormitorio</option>
                  <option value="2">2 dormitorios</option>
                  <option value="3">3 dormitorios</option>
                  <option value="4plus">4+ dormitorios</option>
                  <option value="sin_dato">Sin dato</option>
                </select>
              </div>
            )}

            <Link href="/dashboard/asesor/tracker" className="inline-flex items-center gap-1 rounded-full bg-black text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-900">
              ← Mi Tracker
            </Link>

          </div>
        </header>

        {errorMsg && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">{errorMsg}</div>}

        {renderMainKpis()}

        {tipoOperacion === "venta" ? (
          <section className="grid gap-6 md:grid-cols-2 items-start">
            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{kpiTitleCaptadas}</h2>
                  <p className="text-[11px] text-slate-500">Distribución de tus propiedades captadas por tipología.</p>
                </div>
              </div>

              {tipologiaCaptadasStats.length === 0 ? (
                <p className="text-xs text-slate-500">Todavía no hay propiedades en este período.</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative w-40 h-40 flex-shrink-0">
                    <div className="absolute inset-0 rounded-full border border-gray-200 shadow-inner" style={{ backgroundImage: pieCaptadasBackground }} />
                    {renderPieLabels(pieCaptadasSegments)}
                  </div>
                  <div className="flex-1 space-y-1">
                    {pieCaptadasSegments.map((seg) => (
                      <div key={seg.tipologia} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
                          <span className="text-slate-700">{labelTipologia(seg.tipologia)}</span>
                        </div>
                        <div className="text-slate-500">{seg.count} reg. · {seg.porcentaje.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{kpiTitleCierres}</h2>
                  <p className="text-[11px] text-slate-500">Distribución de operaciones cerradas por tipología.</p>
                </div>
              </div>

              {pieCierresSegments.length === 0 ? (
                <p className="text-xs text-slate-500">Todavía no hay operaciones en este período.</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative w-40 h-40 flex-shrink-0">
                    <div className="absolute inset-0 rounded-full border border-gray-200 shadow-inner" style={{ backgroundImage: pieCierresBackground }} />
                    {renderPieLabels(pieCierresSegments)}
                  </div>
                  <div className="flex-1 space-y-1">
                    {pieCierresSegments.map((seg) => (
                      <div key={seg.tipologia} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
                          <span className="text-slate-700">{labelTipologia(seg.tipologia)}</span>
                        </div>
                        <div className="text-slate-500">{seg.count} {cierreLegendWord} · {seg.porcentaje.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 items-start">
            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Valores promedio de alquiler</h2>
                  <p className="text-[11px] text-slate-500">Promedio, mínimo y máximo según zona, tipología y dormitorios/ambientes.</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500">Casos comparables</p>
                  <p className="text-xs font-semibold text-slate-900">{alquilerValorMensualStats.casos}</p>
                </div>
              </div>

              {alquilerValorMensualStats.casos === 0 ? (
                <p className="text-xs text-slate-500">No hay contratos de alquiler con valor mensual para estos filtros.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-3">
                    <p className="text-[11px] text-slate-500">Promedio mensual</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(alquilerValorMensualStats.promedio, "ARS")}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-3">
                    <p className="text-[11px] text-slate-500">Mínimo</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(alquilerValorMensualStats.minimo, "ARS")}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-3">
                    <p className="text-[11px] text-slate-500">Máximo</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(alquilerValorMensualStats.maximo, "ARS")}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Ranking por zona</h2>
                  <p className="text-[11px] text-slate-500">Contratos, valor mensual promedio e ingreso por administración.</p>
                </div>
              </div>

              {alquilerRankingZonaStats.length === 0 ? (
                <p className="text-xs text-slate-500">No hay datos de alquiler suficientes para armar el ranking.</p>
              ) : (
                <div className="space-y-2">
                  {alquilerRankingZonaStats.map((row) => {
                    const maxCount = Math.max(1, ...alquilerRankingZonaStats.map((x) => x.count));
                    return (
                      <div key={row.zona} className="text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-800 truncate">{row.zona}</span>
                          <span className="text-slate-500">{row.count} contratos · Prom. {formatCurrency(row.promedio, "ARS")}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-[rgba(230,169,48,0.9)]" style={{ width: `${(row.count / maxCount) * 100}%` }} />
                        </div>
                        {row.administrados > 0 && (
                          <p className="mt-1 text-[10px] text-slate-500">Adm.: {row.administrados} · Ingreso mensual: {formatCurrency(row.sumAdmin, "ARS")}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {tipoOperacion === "venta" && (
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">GAP promedio por tipología</h2>
                <p className="text-[11px] text-slate-500">
                  Diferencia promedio entre precio de lista y cierre (%).
                </p>
              </div>
              {avgGapGlobal != null && (
                <div className="text-right">
                  <p className="text-[10px] text-slate-500">GAP promedio general</p>
                  <p className="text-xs font-semibold text-slate-900">{avgGapGlobal.toFixed(1)}%</p>
                </div>
              )}
            </div>

            {tipologiaCierreStats.length === 0 ? (
              <p className="text-xs text-slate-500">No hay datos suficientes para calcular esta métrica.</p>
            ) : (
              <div className="space-y-2">
                {tipologiaCierreStats.map((row) => (
                  <div key={row.tipologia} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="w-28 text-slate-700 truncate">{labelTipologia(row.tipologia)}</span>
                    <div className="flex-1 mx-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-900"
                        style={{ width: `${row.avgGap != null ? Math.min(100, Math.abs(row.avgGap) * 3) : Math.min(100, row.sharePct)}%` }}
                      />
                    </div>
                    <span className="w-32 text-right text-slate-500">
                      {row.avgGap != null ? `${row.avgGap.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Días de venta promedio</h2>
                <p className="text-[11px] text-slate-500">
                  Tiempo promedio desde inicio de comercialización hasta cierre.
                </p>
              </div>
              {avgDiasGlobal != null && (
                <div className="text-right">
                  <p className="text-[10px] text-slate-500">Días promedio generales</p>
                  <p className="text-xs font-semibold text-slate-900">{avgDiasGlobal.toFixed(0)} días</p>
                </div>
              )}
            </div>

            {tipologiaCierreStats.length === 0 ? (
              <p className="text-xs text-slate-500">No hay datos suficientes para calcular días de venta.</p>
            ) : (
              <div className="space-y-2">
                {tipologiaCierreStats.map((row) => (
                  <div key={row.tipologia} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="w-28 text-slate-700 truncate">{labelTipologia(row.tipologia)}</span>
                    <div className="flex-1 mx-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[rgba(230,169,48,0.9)]"
                        style={{ width: `${row.avgDias != null ? Math.min(100, (row.avgDias / 180) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-slate-500">{row.avgDias != null ? `${row.avgDias.toFixed(0)} d` : "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        )}

        <section className="grid gap-6 md:grid-cols-2 items-start">
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{tipoOperacion === "venta" ? "Ingresos por honorarios de venta" : "Honorarios por contratos de alquiler"}</h2>
                <p className="text-[11px] text-slate-500">
                  Ajustá el reparto neto entre empresa y asesor para simular tu ingreso estimado.
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
                      const value = Math.max(0, Math.min(100, Number(raw) || 0));
                      const complement = 100 - value;
                      setEmpresaPctInput(String(value));
                      setAsesorPctInput(String(complement));
                      if (typeof window !== "undefined") {
                        localStorage.setItem("vai_honorarios_empresa_pct", String(value));
                        localStorage.setItem("vai_honorarios_asesor_pct", String(complement));
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
                      const value = Math.max(0, Math.min(100, Number(raw) || 0));
                      const complement = 100 - value;
                      setAsesorPctInput(String(value));
                      setEmpresaPctInput(String(complement));
                      if (typeof window !== "undefined") {
                        localStorage.setItem("vai_honorarios_asesor_pct", String(value));
                        localStorage.setItem("vai_honorarios_empresa_pct", String(complement));
                      }
                    }}
                    className="w-14 rounded-full border border-gray-300 px-2 py-0.5 text-right"
                  />
                </div>
              </div>
            </div>

            {honorariosBrutosTotal <= 0 ? (
              <p className="text-xs text-slate-500">Cargá operaciones con honorarios para ver esta gráfica.</p>
            ) : (
              <div className="flex flex-col items-end justify-around h-48 gap-4">
                <div className="flex justify-around w-full gap-4 items-end">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 rounded-t-lg bg-slate-900" style={{ height: barHeight(honorariosBrutosTotal) }} />
                    <span className="text-[11px] text-slate-700 text-center">Total</span>
                    <span className="text-[10px] text-slate-500">{formatCurrency(honorariosBrutosTotal, honorariosBrutosCurrency)}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-8 rounded-t-lg"
                      style={{ height: barHeight(netoEmpresa), background: "linear-gradient(to top, rgba(34,197,94,0.9), rgba(34,197,94,0.4))" }}
                    />
                    <span className="text-[11px] text-slate-700 text-center">Empresa ({empresaPct.toFixed(0)}%)</span>
                    <span className="text-[10px] text-slate-500">{formatCurrency(netoEmpresa, honorariosBrutosCurrency)}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-8 rounded-t-lg"
                      style={{ height: barHeight(netoAsesor), background: "linear-gradient(to top, rgba(56,189,248,0.9), rgba(56,189,248,0.4))" }}
                    />
                    <span className="text-[11px] text-slate-700 text-center">Asesor ({asesorPct.toFixed(0)}%)</span>
                    <span className="text-[10px] text-slate-500">{formatCurrency(netoAsesor, honorariosBrutosCurrency)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{tipoOperacion === "venta" ? "Ticket promedio por tipología" : "Valor mensual promedio por tipología"}</h2>
                <p className="text-[11px] text-slate-500">
                  {tipoOperacion === "venta" ? "Promedio de precio de cierre por tipo de propiedad." : "Promedio del valor mensual de alquiler por tipo de propiedad."}
                </p>
              </div>
              {globalAvgTicket != null && (
                <div className="text-right">
                  <p className="text-[10px] text-slate-500">Promedio general</p>
                  <p className="text-xs font-semibold text-slate-900">{formatCurrency(globalAvgTicket, tipoOperacion === "venta" ? "USD" : "ARS")}</p>
                </div>
              )}
            </div>

            {tipologiaCierreStats.length === 0 ? (
              <p className="text-xs text-slate-500">Todavía no hay datos suficientes para calcular promedios.</p>
            ) : (
              <div className="space-y-2">
                {tipologiaCierreStats.map((row) => {
                  const preferredCurrency: Moneda = tipoOperacion === "venta" ? "USD" : "ARS";
                  const total = preferredCurrency === "USD" ? row.sumCierreUSD : row.sumCierreARS;
                  const avg = row.count > 0 ? total / row.count : 0;
                  return (
                    <div key={row.tipologia} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="w-28 text-slate-700 truncate">{labelTipologia(row.tipologia)}</span>
                      <div className="flex-1 mx-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-[rgba(37,99,235,0.9)]" style={{ width: `${globalAvgTicket && globalAvgTicket > 0 ? Math.min(100, (avg / globalAvgTicket) * 100) : 0}%` }} />
                      </div>
                      <span className="w-24 text-right text-slate-500">{avg > 0 ? formatCurrency(avg, preferredCurrency) : "—"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {tipoOperacion === "venta" ? (
          <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Funnel Comercial: Prospección → Cierre</h2>
                <p className="text-[11px] text-slate-500">Tasa de conversión comercial para ventas propias. Las ventas de terceros no contaminan captaciones.</p>
              </div>
              {avgDiasGlobal != null && (
                <div className="text-right">
                  <p className="text-[10px] text-slate-500">Tiempo promedio de venta</p>
                  <p className="text-xs font-semibold text-slate-900">{avgDiasGlobal.toFixed(0)} días</p>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-4 text-xs">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">Prospección</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{funnelVentas.prospectosCount}</p>
                <p className="mt-1 text-[11px] text-slate-500">Contactos de venta en el período.</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">Prelisting</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{funnelVentas.prelistingCount}</p>
                {funnelVentas.conversionProspectoPrelisting != null && <p className="mt-1 text-[10px] text-emerald-700">{funnelVentas.conversionProspectoPrelisting.toFixed(1)}% de prospectos.</p>}
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">Captación</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{funnelVentas.captacionesCount}</p>
                {funnelVentas.conversionPrelistingCaptacion != null && <p className="mt-1 text-[10px] text-emerald-700">{funnelVentas.conversionPrelistingCaptacion.toFixed(1)}% desde prelisting.</p>}
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">Cierres propios</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{funnelVentas.cierresCount}</p>
                {funnelVentas.conversionProspectoCierre != null && <p className="mt-1 text-[10px] text-emerald-700">{funnelVentas.conversionProspectoCierre.toFixed(1)}% prospecto → cierre.</p>}
              </div>
            </div>
          </section>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 items-start">
            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Contratos próximos a finalizar</h2>
                  <p className="text-[11px] text-slate-500">Vencimientos dentro de los próximos 30 días.</p>
                </div>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">{contratosProximosAFinalizar.length}</span>
              </div>
              {contratosProximosAFinalizar.length === 0 ? (
                <p className="text-xs text-slate-500">No hay contratos próximos a finalizar con los filtros seleccionados.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {contratosProximosAFinalizar.slice(0, 8).map((p) => (
                    <div key={p.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800 truncate">{labelTipologia(p.tipologia)} · {labelDormitorios(p.dormitorios)}</span>
                        <span className="text-slate-500">{formatDateDisplay(p.alquiler_fecha_fin_contrato)}</span>
                      </div>
                      <p className="mt-1 text-slate-500 truncate">{labelZona(p.zona)} · {nombreAsesor(p.asesor_id)}</p>
                      <p className="mt-1 text-slate-600">Valor mensual: {formatCurrency(alquilerValorMensual(p), normalizeCurrency(p.moneda))}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Alquileres próximos a actualizar</h2>
                  <p className="text-[11px] text-slate-500">Actualizaciones calculadas por inicio de contrato y frecuencia.</p>
                </div>
                <span className="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-800">{alquileresProximosAActualizar.length}</span>
              </div>
              {alquileresProximosAActualizar.length === 0 ? (
                <p className="text-xs text-slate-500">No hay actualizaciones próximas dentro de los próximos 30 días.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {alquileresProximosAActualizar.slice(0, 8).map(({ propiedad, fecha }) => (
                    <div key={propiedad.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800 truncate">{labelTipologia(propiedad.tipologia)} · {labelZona(propiedad.zona)}</span>
                        <span className="text-slate-500">{formatDateDisplay(fecha)}</span>
                      </div>
                      <p className="mt-1 text-slate-500">Índice: {propiedad.alquiler_indice_actualizacion || "—"} · Frecuencia: {propiedad.alquiler_frecuencia_actualizacion_meses || "—"} meses</p>
                      <p className="mt-1 text-slate-600">Valor actual: {formatCurrency(alquilerValorMensual(propiedad), normalizeCurrency(propiedad.moneda))}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {tipoOperacion === "venta" && (
          <section className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-900">Mi actividad</h2>
                <p className="text-[11px] text-slate-500">Total actividades: <span className="font-semibold">{totalActividadesAsesores}</span></p>
              </div>
              {actividadesPorAsesorSorted.length === 0 ? (
                <p className="text-xs text-slate-500">No hay actividades registradas en este período.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {actividadesPorAsesorSorted.map((row) => {
                    const pct = totalActividadesAsesores > 0 ? (row.count / totalActividadesAsesores) * 100 : 0;
                    return (
                      <div key={row.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-slate-800 truncate">{nombreAsesor(row.id)}</span>
                          <span className="text-[11px] text-slate-600">{row.count} act.</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <div className="h-full rounded-full bg-[rgba(230,169,48,0.9)]" style={{ width: `${(row.count / maxActAsesor) * 100}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-500">{pct.toFixed(1)}% del total del período.</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-900">Actividades por tipo</h2>
                <p className="text-[11px] text-slate-500">Total actividades: <span className="font-semibold">{totalActividadesTipos}</span></p>
              </div>
              {actividadesPorTipoSorted.length === 0 ? (
                <p className="text-xs text-slate-500">No hay actividades registradas en este período.</p>
              ) : (
                <div className="space-y-2">
                  {actividadesPorTipoSorted.map((item) => {
                    const pct = totalActividadesTipos > 0 ? (item.count / totalActividadesTipos) * 100 : 0;
                    return (
                      <div key={item.tipo} className="flex flex-col gap-1 text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-700">{labelTipoActividad(item.tipo)}</span>
                          <span className="text-slate-600">{item.count} act.</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-slate-900" style={{ width: `${(item.count / maxActTipo) * 100}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-500">{pct.toFixed(1)}% del total.</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
