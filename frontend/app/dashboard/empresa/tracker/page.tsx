// app/dashboard/empresa/tracker/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

type TrackerContactoEstado =
  | "sin_contactar"
  | "primer_llamado"
  | "seguimiento"
  | "prelisting"
  | "vai_factibilidad"
  | "captado"
  | "cierre"
  | "descarte";

type TrackerActividadTipo =
  | "seguimiento"
  | "reunion"
  | "muestra"
  | "prelisting"
  | "vai"
  | "factibilidad"
  | "reserva"
  | "cierre";

type TrackerTab = "calendario" | "contactos" | "propiedades";
type KpiRange = "30d" | "90d" | "180d" | "365d";
type TrackerScope = "empresa" | "asesores" | "global";

interface TrackerContacto {
  id: string;
  empresa_id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  tipologia: string | null;
  tipo_operacion: string | null;
  origen: string | null;
  zona: string | null;
  estado: TrackerContactoEstado;
  motivo_descarte: string | null;
  created_at: string;
  updated_at: string;
}

interface TrackerActividad {
  id: string;
  empresa_id: string;
  contacto_id: string | null;
  titulo: string;
  tipo: TrackerActividadTipo;
  fecha_programada: string; // YYYY-MM-DD
  hora: string | null; // HH:mm
  notas: string | null;
  created_at: string;
  updated_at: string;
  asesor_id: string | null;
}

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
  dormitorios: number | null;
  precio_lista_inicial: number | null;
  precio_actual: number | null;
  precio_cierre: number | null;
  moneda: string | null;
  fecha_inicio_comercializacion: string | null;
  fecha_cierre: string | null;
  honorarios_pct_vendedor: number | null;
  honorarios_pct_comprador: number | null;
  asesor_id: string | null;
  created_at: string;
  updated_at: string;
  contacto?: {
    nombre: string | null;
    apellido: string | null;
  } | null;
}

interface Asesor {
  id: string;
  nombre: string | null;
  apellido: string | null;
}

interface FormPropiedadState {
  contacto_id: string;
  tipologia: string;
  dormitorios: string;
  tipo_operacion: string;
  direccion: string;
  zona: string;
  m2_lote: string;
  m2_cubiertos: string;
  precio_lista_inicial: string;
  precio_actual: string;
  precio_cierre: string;
  moneda: string;
  fecha_inicio_comercializacion: string;
  fecha_cierre: string;
  honorarios_pct_vendedor: string;
  honorarios_pct_comprador: string;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatDateShort(date: Date) {
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function formatTime(hora: string | null) {
  if (!hora) return "";
  return hora.substring(0, 5);
}

// Normalizamos fechas al formato YYYY-MM-DD (sin huso horario)
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonthMatrix(currentMonth: Date) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startWeekDay = firstDayOfMonth.getDay();
  const start = new Date(firstDayOfMonth);
  start.setDate(
    firstDayOfMonth.getDate() - (startWeekDay === 0 ? 6 : startWeekDay - 1)
  );

  const endWeekDay = lastDayOfMonth.getDay();
  const end = new Date(lastDayOfMonth);
  end.setDate(lastDayOfMonth.getDate() + (endWeekDay === 0 ? 0 : 7 - endWeekDay));

  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

function kpiStartDate(range: KpiRange): Date {
  const now = new Date();
  const d = new Date(now);
  if (range === "30d") d.setDate(d.getDate() - 30);
  if (range === "90d") d.setDate(d.getDate() - 90);
  if (range === "180d") d.setDate(d.getDate() - 180);
  if (range === "365d") d.setDate(d.getDate() - 365);
  return d;
}

function diasEntreFechas(
  inicio: string | null,
  fin: string | null
): number | null {
  if (!inicio) return null;
  const start = new Date(inicio);
  const end = fin ? new Date(fin) : new Date();
  const diffMs = end.getTime() - start.getTime();
  if (Number.isNaN(diffMs)) return null;
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return dias < 0 ? 0 : dias;
}

function labelTipoActividad(tipo: TrackerActividadTipo): string {
  switch (tipo) {
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
      return tipo;
  }
}

export default function EmpresaTrackerPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔐 Gating por plan (Trial o incluye_tracker)
  const [puedeUsarTracker, setPuedeUsarTracker] = useState<boolean | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);

  const [contactos, setContactos] = useState<TrackerContacto[]>([]);
  const [actividades, setActividades] = useState<TrackerActividad[]>([]);
  const [propiedades, setPropiedades] = useState<TrackerPropiedad[]>([]);
  const [asesores, setAsesores] = useState<Asesor[]>([]);

  const [activeTab, setActiveTab] = useState<TrackerTab>("calendario");
  const [kpiRange, setKpiRange] = useState<KpiRange>("30d");

  const [scope, setScope] = useState<TrackerScope>("empresa");
  const [selectedAsesorId, setSelectedAsesorId] = useState<string>("");

  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));

  const [showContactoModal, setShowContactoModal] = useState(false);
  const [editingContacto, setEditingContacto] = useState<TrackerContacto | null>(
    null
  );

  const [showActividadModal, setShowActividadModal] = useState(false);
  const [editingActividad, setEditingActividad] =
    useState<TrackerActividad | null>(null);

  const [showPropiedadModal, setShowPropiedadModal] = useState(false);
  const [editingPropiedad, setEditingPropiedad] =
    useState<TrackerPropiedad | null>(null);

  const [mensaje, setMensaje] = useState<string | null>(null);

  // 🔎 Filtro texto propiedades captadas
  const [propiedadesSearch, setPropiedadesSearch] = useState("");

  // Flags para evitar doble submit y duplicados
  const [savingContacto, setSavingContacto] = useState(false);
  const [savingActividad, setSavingActividad] = useState(false);
  const [savingPropiedad, setSavingPropiedad] = useState(false);

  const [formContacto, setFormContacto] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
    email: "",
    tipologia: "",
    tipo_operacion: "",
    origen: "",
    zona: "",
    estado: "sin_contactar" as TrackerContactoEstado,
    motivo_descarte: "",
    direccion: "",
  });

  const [formActividad, setFormActividad] = useState({
    titulo: "",
    tipo: "seguimiento" as TrackerActividadTipo,
    fecha_programada: new Date().toISOString().substring(0, 10),
    hora: "",
    contacto_id: "" as string | "",
    notas: "",
  });

  const [formPropiedad, setFormPropiedad] = useState<FormPropiedadState>({
    contacto_id: "",
    tipologia: "",
    dormitorios: "",
    tipo_operacion: "",
    direccion: "",
    zona: "",
    m2_lote: "",
    m2_cubiertos: "",
    precio_lista_inicial: "",
    precio_actual: "",
    precio_cierre: "",
    moneda: "ARS",
    fecha_inicio_comercializacion: "",
    fecha_cierre: "",
    honorarios_pct_vendedor: "",
    honorarios_pct_comprador: "",
  });

  // Referencias de hoy y mañana (hora local, sin mezclar TZ)
  const hoy = startOfDay(new Date());
  const manana = addDays(hoy, 1);

  // Claves normalizadas YYYY-MM-DD
  const hoyKey = toDateKey(hoy);
  const mananaKey = toDateKey(manana);
  const selectedKey = toDateKey(selectedDate);

  // Helper: tomar siempre solo "YYYY-MM-DD" de la fecha programada
  const actividadDateKey = (a: TrackerActividad) =>
    a.fecha_programada ? a.fecha_programada.substring(0, 10) : "";

  // 🔐 Verificar estado de plan para habilitar Tracker
  useEffect(() => {
    const fetchEstadoPlan = async () => {
      try {
        const res = await fetch("/api/billing/estado", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Respuesta no OK de /api/billing/estado");
        }
        const data = await res.json();
        const plan = data?.plan;

        const incluyeTracker = plan?.incluye_tracker === true;
        const esTrial =
          plan?.es_trial === true || plan?.nombre === "Trial";

        const habilitado = incluyeTracker || esTrial;

        setPuedeUsarTracker(habilitado);

        if (!habilitado) {
          // Redirigimos a planes si el plan no incluye el tracker
          router.replace("/dashboard/empresa/planes");
        }
      } catch (error) {
        console.error("Error consultando plan para Tracker:", error);
        setPuedeUsarTracker(false);
        router.replace("/dashboard/empresa/planes");
      } finally {
        setBillingLoading(false);
      }
    };

    fetchEstadoPlan();
  }, [router]);

  // Filtrado por scope (empresa / asesores / global)
  const actividadesFiltradas = useMemo(() => {
    if (scope === "global") return actividades;

    if (scope === "empresa") {
      return actividades.filter((a) => !a.asesor_id);
    }

    // scope === "asesores"
    if (!selectedAsesorId) {
      // Todos los asesores (cualquier actividad con asesor_id)
      return actividades.filter((a) => !!a.asesor_id);
    }
    return actividades.filter((a) => a.asesor_id === selectedAsesorId);
  }, [actividades, scope, selectedAsesorId]);

  const propiedadesFiltradas = useMemo(() => {
    if (scope === "global") return propiedades;

    if (scope === "empresa") {
      return propiedades.filter((p) => !p.asesor_id);
    }

    // scope === "asesores"
    if (!selectedAsesorId) {
      return propiedades.filter((p) => !!p.asesor_id);
    }
    return propiedades.filter((p) => p.asesor_id === selectedAsesorId);
  }, [propiedades, scope, selectedAsesorId]);

  // 🔎 Filtro por texto sobre propiedadesFiltradas
  const propiedadesFiltradasPorTexto = useMemo(() => {
    const term = propiedadesSearch.trim().toLowerCase();
    if (!term) return propiedadesFiltradas;

    return propiedadesFiltradas.filter((p) => {
      const contacto =
        p.contacto_id && contactoPorId(p.contacto_id)
          ? contactoPorId(p.contacto_id)
          : p.contacto ?? null;

      const nombreCliente = contacto
        ? contactoNombreCorto(contacto).toLowerCase()
        : "";

      const tipologia = (p.tipologia ?? "").toLowerCase();
      const operacion = (p.tipo_operacion ?? "").toLowerCase();
      const direccion = (p.direccion ?? "").toLowerCase();
      const zona = (p.zona ?? "").toLowerCase();

      const precioActual =
        p.precio_actual != null
          ? String(p.precio_actual)
          : p.precio_lista_inicial != null
          ? String(p.precio_lista_inicial)
          : "";

      const fechaInicio =
        p.fecha_inicio_comercializacion?.substring(0, 10) ?? "";
      const fechaCierre = p.fecha_cierre?.substring(0, 10) ?? "";

      let gapTexto = "";
      if (
        p.precio_lista_inicial != null &&
        p.precio_lista_inicial > 0 &&
        p.precio_cierre != null
      ) {
        const diff =
          ((p.precio_lista_inicial - p.precio_cierre) /
            p.precio_lista_inicial) *
          100;
        const gap = Math.abs(Math.round(diff));
        if (!isNaN(gap)) gapTexto = `${gap}%`;
      }

      const diasVenta = diasEntreFechas(
        p.fecha_inicio_comercializacion,
        p.fecha_cierre
      );
      const diasVentaTexto =
        diasVenta != null ? `${diasVenta} días` : "";

      const blob = (
        nombreCliente +
        " " +
        tipologia +
        " " +
        operacion +
        " " +
        direccion +
        " " +
        zona +
        " " +
        precioActual +
        " " +
        fechaInicio +
        " " +
        fechaCierre +
        " " +
        gapTexto +
        " " +
        diasVentaTexto
      ).toLowerCase();

      return blob.includes(term);
    });
  }, [propiedadesFiltradas, propiedadesSearch, contactos]);

  const actividadesHoy = useMemo(
    () =>
      actividadesFiltradas.filter((a) => {
        if (!a.fecha_programada) return false;
        const key = actividadDateKey(a);
        return key === hoyKey;
      }),
    [actividadesFiltradas, hoyKey]
  );

  const actividadesManana = useMemo(
    () =>
      actividadesFiltradas.filter((a) => {
        if (!a.fecha_programada) return false;
        const key = actividadDateKey(a);
        return key === mananaKey;
      }),
    [actividadesFiltradas, mananaKey]
  );

  const actividadesSelectedDate = useMemo(
    () =>
      actividadesFiltradas.filter((a) => {
        if (!a.fecha_programada) return false;
        const key = actividadDateKey(a);
        return key === selectedKey;
      }),
    [actividadesFiltradas, selectedKey]
  );

  const actividadesByDateMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of actividadesFiltradas) {
      if (!a.fecha_programada) continue;
      const key = actividadDateKey(a); // siempre "YYYY-MM-DD" sin TZ
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [actividadesFiltradas]);

  const startKpiDate = useMemo(() => kpiStartDate(kpiRange), [kpiRange]);

  const kpis = useMemo(() => {
    const start = startKpiDate;
    const startKey = toDateKey(start);

    // Contactos creados dentro del período (base)
    const contactosInRangeBase = contactos.filter((c) => {
      const created = new Date(c.created_at);
      return created >= start;
    });

    // Actividades dentro del período (ya filtradas por scope)
    const actividadesInRange = actividadesFiltradas.filter((a) => {
      if (!a.fecha_programada) return false;
      const key = actividadDateKey(a);
      return key >= startKey;
    });

    // Para scope empresa/asesores: contactos con al menos una actividad en este scope
    let contactosInRange = contactosInRangeBase;
    if (scope !== "global") {
      const contactoIdsConActividad = new Set(
        actividadesInRange
          .map((a) => a.contacto_id)
          .filter((id): id is string => !!id)
      );
      contactosInRange = contactosInRangeBase.filter((c) =>
        contactoIdsConActividad.has(c.id)
      );
    }

    // ---- PRELISTING ----
    // 1) contactos que (en algún momento del circuito) llegaron al tramo
    //    prelisting / vai_factibilidad / captado / cierre
    const idsPrelistingEstado = contactosInRange
      .filter((c) =>
        ["prelisting", "vai_factibilidad", "captado", "cierre"].includes(
          c.estado
        )
      )
      .map((c) => c.id);

    // 2) contactos que tuvieron al menos una actividad tipo "prelisting"
    const idsPrelistingActividad = new Set<string>();
    for (const act of actividadesInRange) {
      if (act.tipo === "prelisting" && act.contacto_id) {
        idsPrelistingActividad.add(act.contacto_id);
      }
    }

    // 3) Unión: si alguna vez estuvo en prelisting (por estado o actividad),
    // cuenta como prelisting aunque hoy esté en "captado" o "cierre"
    const prelistingSet = new Set<string>(idsPrelistingEstado);
    for (const id of idsPrelistingActividad) {
      prelistingSet.add(id);
    }
    const prelistingCount = prelistingSet.size;

    // CAPTACIONES: contactos que hoy están en "captado" o "cierre"
    const captacionesSet = new Set<string>();
    for (const c of contactosInRange) {
      if (c.estado === "captado" || c.estado === "cierre") {
        captacionesSet.add(c.id);
      }
    }
    const captacionesCount = captacionesSet.size;

    // CIERRES: contactos que hoy están en "cierre"
    const cierresCount = contactosInRange.filter(
      (c) => c.estado === "cierre"
    ).length;

    return {
      prospectos: contactosInRange.length,
      prelisting: prelistingCount,
      captaciones: captacionesCount,
      cierres: cierresCount,
    };
  }, [
    contactos,
    actividadesFiltradas,
    startKpiDate,
    scope,
  ]);
  // Buscar empresa_id desde profile
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
        console.error("Error buscando empresa para tracker:", error);
        setEmpresaId(null);
        setLoading(false);
        return;
      }

      setEmpresaId(data?.id ?? null);
      setLoading(false);
    };

    fetchEmpresa();
  }, [user]);

  // Carga inicial (contactos + actividades + propiedades)
  useEffect(() => {
    if (!empresaId) return;

    const fetchAll = async () => {
      try {
        setLoading(true);

        const [{ data: cData }, { data: aData }, { data: pData }] =
          await Promise.all([
            supabase
              .from("tracker_contactos")
              .select("*")
             
              .order("created_at", { ascending: false }),
            supabase
              .from("tracker_actividades")
              .select("*")
              
              .order("fecha_programada", { ascending: true }),
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
                  dormitorios,
                  precio_lista_inicial,
                  precio_actual,
                  precio_cierre,
                  moneda,
                  fecha_inicio_comercializacion,
                  fecha_cierre,
                  honorarios_pct_vendedor,
                  honorarios_pct_comprador,
                  asesor_id,
                  created_at,
                  updated_at,
                  contacto:tracker_contactos (nombre, apellido)
                `
              )
              
              .order("created_at", { ascending: false }),
          ]);

        setContactos((cData as TrackerContacto[]) ?? []);
        setActividades((aData as TrackerActividad[]) ?? []);

        const propsNormalizadas: TrackerPropiedad[] = (pData ?? []).map(
          (row: any) => {
            const contactoRaw = Array.isArray(row.contacto)
              ? row.contacto[0]
              : row.contacto;

            return {
              id: row.id,
              empresa_id: row.empresa_id,
              contacto_id: row.contacto_id,
              tipologia: row.tipologia,
              tipo_operacion: row.tipo_operacion,
              direccion: row.direccion,
              zona: row.zona,
              m2_lote: row.m2_lote,
              m2_cubiertos: row.m2_cubiertos,
              dormitorios: row.dormitorios,
              precio_lista_inicial: row.precio_lista_inicial,
              precio_actual: row.precio_actual,
              precio_cierre: row.precio_cierre,
              moneda: row.moneda,
              fecha_inicio_comercializacion: row.fecha_inicio_comercializacion,
              fecha_cierre: row.fecha_cierre,
              honorarios_pct_vendedor: row.honorarios_pct_vendedor,
              honorarios_pct_comprador: row.honorarios_pct_comprador,
              asesor_id: row.asesor_id,
              created_at: row.created_at,
              updated_at: row.updated_at,
              contacto: contactoRaw
                ? {
                    nombre: contactoRaw.nombre ?? null,
                    apellido: contactoRaw.apellido ?? null,
                  }
                : null,
            } as TrackerPropiedad;
          }
        );

        setPropiedades(propsNormalizadas);
      } catch (err) {
        console.error("Error cargando tracker:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [empresaId]);

  // Cargar asesores para el filtro
  useEffect(() => {
    if (!empresaId) return;

    const fetchAsesores = async () => {
      try {
        const { data, error } = await supabase
          .from("asesores")
          .select("id, nombre, apellido")
          .eq("empresa_id", empresaId)
          .order("nombre", { ascending: true });

        if (error) {
          console.error("Error cargando asesores para filtro:", error);
          return;
        }

        setAsesores((data as Asesor[]) ?? []);
      } catch (err) {
        console.error("Error inesperado cargando asesores:", err);
      }
    };

    fetchAsesores();
  }, [empresaId]);

  const showMessage = (text: string) => {
    setMensaje(text);
    setTimeout(() => setMensaje(null), 3200);
  };

  // Helpers de contacto / actividades por contacto
  const contactoNombreCorto = (
    c: { nombre?: string | null; apellido?: string | null } | null | undefined
  ) => {
    if (!c) return "Sin contacto";
    const nom = [c.nombre, c.apellido].filter(Boolean).join(" ");
    return nom || "Sin nombre";
  };

  const contactoPorId = (id: string | null) => {
    if (!id) return null;
    return contactos.find((c) => c.id === id) ?? null;
  };

  const actividadesDeContacto = (contactoId: string) =>
    actividades
      .filter((a) => a.contacto_id === contactoId)
      .sort(
        (a, b) =>
          new Date(b.fecha_programada).getTime() -
          new Date(a.fecha_programada).getTime()
      );

  // ----- CRUD CONTACTOS -----

  const openNuevoContacto = () => {
    setEditingContacto(null);
    setFormContacto({
      nombre: "",
      apellido: "",
      telefono: "",
      email: "",
      tipologia: "",
      tipo_operacion: "",
      origen: "",
      zona: "",
      estado: "sin_contactar",
      motivo_descarte: "",
      direccion: "",
    });
    setShowContactoModal(true);
  };

  const openEditarContacto = (c: TrackerContacto) => {
    setEditingContacto(c);
    setFormContacto({
      nombre: c.nombre ?? "",
      apellido: c.apellido ?? "",
      telefono: c.telefono ?? "",
      email: c.email ?? "",
      tipologia: c.tipologia ?? "",
      tipo_operacion: c.tipo_operacion ?? "",
      origen: c.origen ?? "",
      zona: c.zona ?? "",
      estado: c.estado,
      motivo_descarte: c.motivo_descarte ?? "",
      direccion: "",
    });
    setShowContactoModal(true);
  };

  const guardarContacto = async () => {
    if (!empresaId || savingContacto) return;
    setSavingContacto(true);

    try {
      if (editingContacto) {
        const { error } = await supabase
          .from("tracker_contactos")
          .update({
            nombre: formContacto.nombre,
            apellido: formContacto.apellido,
            telefono: formContacto.telefono || null,
            email: formContacto.email || null,
            tipologia: formContacto.tipologia || null,
            tipo_operacion: formContacto.tipo_operacion || null,
            origen: formContacto.origen || null,
            zona: formContacto.zona || null,
            estado: formContacto.estado,
            motivo_descarte:
              formContacto.estado === "descarte"
                ? formContacto.motivo_descarte || null
                : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingContacto.id)
          .eq("empresa_id", empresaId);

        if (error) {
          console.error("Error actualizando contacto:", error);
          showMessage("❌ No se pudo actualizar el contacto.");
          return;
        }
      } else {
        const { error } = await supabase.from("tracker_contactos").insert({
          empresa_id: empresaId,
          nombre: formContacto.nombre,
          apellido: formContacto.apellido,
          telefono: formContacto.telefono || null,
          email: formContacto.email || null,
          tipologia: formContacto.tipologia || null,
          tipo_operacion: formContacto.tipo_operacion || null,
          origen: formContacto.origen || null,
          zona: formContacto.zona || null,
          estado: formContacto.estado,
          motivo_descarte:
            formContacto.estado === "descarte"
              ? formContacto.motivo_descarte || null
              : null,
        });

        if (error) {
          console.error("Error creando contacto:", error);
          showMessage("❌ No se pudo crear el contacto.");
          return;
        }
      }

      showMessage("✅ Contacto guardado.");
      setShowContactoModal(false);

      const { data: cData } = await supabase
        .from("tracker_contactos")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });

      setContactos((cData as TrackerContacto[]) ?? []);
    } catch (err) {
      console.error("Error guardando contacto:", err);
      showMessage("❌ Error inesperado al guardar contacto.");
    } finally {
      setSavingContacto(false);
    }
  };

  const eliminarContacto = async (id: string) => {
    if (!empresaId) return;
    if (!confirm("¿Eliminar este contacto? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("tracker_contactos")
        .delete()
        .eq("id", id)
        .eq("empresa_id", empresaId);

      if (error) {
        console.error("Error eliminando contacto:", error);
        showMessage("❌ No se pudo eliminar el contacto.");
        return;
      }

      showMessage("✅ Contacto eliminado.");
      setContactos((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Error eliminando contacto:", err);
      showMessage("❌ Error inesperado al eliminar.");
    }
  };

  // ----- CRUD ACTIVIDADES -----

  const openNuevaActividad = (date?: Date) => {
    const baseDate = date ?? selectedDate ?? new Date();
    setEditingActividad(null);
    setFormActividad({
      titulo: "",
      tipo: "seguimiento",
      fecha_programada: toDateKey(baseDate),
      hora: "",
      contacto_id: "",
      notas: "",
    });
    setShowActividadModal(true);
  };

  const openEditarActividad = (a: TrackerActividad) => {
    setEditingActividad(a);
    setFormActividad({
      titulo: a.titulo,
      tipo: a.tipo,
      fecha_programada: a.fecha_programada.substring(0, 10),
      hora: a.hora ?? "",
      contacto_id: a.contacto_id ?? "",
      notas: a.notas ?? "",
    });
    setShowActividadModal(true);
  };

  const guardarActividad = async () => {
    if (!empresaId || savingActividad) return;
    setSavingActividad(true);

    try {
      if (editingActividad) {
        const { error } = await supabase
          .from("tracker_actividades")
          .update({
            titulo: formActividad.titulo,
            tipo: formActividad.tipo,
            fecha_programada: formActividad.fecha_programada,
            hora: formActividad.hora || null,
            contacto_id: formActividad.contacto_id || null,
            notas: formActividad.notas || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingActividad.id)
          .eq("empresa_id", empresaId);

        if (error) {
          console.error("Error actualizando actividad:", error);
          showMessage("❌ No se pudo actualizar la actividad.");
          return;
        }
      } else {
        const { error } = await supabase.from("tracker_actividades").insert({
          empresa_id: empresaId,
          titulo: formActividad.titulo,
          tipo: formActividad.tipo,
          fecha_programada: formActividad.fecha_programada,
          hora: formActividad.hora || null,
          contacto_id: formActividad.contacto_id || null,
          notas: formActividad.notas || null,
        });

        if (error) {
          console.error("Error creando actividad:", error);
          showMessage("❌ No se pudo crear la actividad.");
          return;
        }
      }

      showMessage("✅ Actividad guardada.");
      setShowActividadModal(false);

      const { data: aData } = await supabase
        .from("tracker_actividades")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("fecha_programada", { ascending: true });

      setActividades((aData as TrackerActividad[]) ?? []);
    } catch (err) {
      console.error("Error guardando actividad:", err);
      showMessage("❌ Error inesperado al guardar actividad.");
    } finally {
      setSavingActividad(false);
    }
  };

  const eliminarActividad = async (id: string) => {
    if (!empresaId) return;
    if (!confirm("¿Eliminar esta actividad?")) return;

    try {
      const { error } = await supabase
        .from("tracker_actividades")
        .delete()
        .eq("id", id)
        .eq("empresa_id", empresaId);

      if (error) {
        console.error("Error eliminando actividad:", error);
        showMessage("❌ No se pudo eliminar la actividad.");
        return;
      }

      showMessage("✅ Actividad eliminada.");
      setActividades((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Error eliminando actividad:", err);
      showMessage("❌ Error inesperado al eliminar actividad.");
    }
  };

  // ----- CRUD PROPIEDADES -----

  const openNuevaPropiedad = (contactoId?: string) => {
    setEditingPropiedad(null);
    setFormPropiedad({
      contacto_id: contactoId ?? "",
      tipologia: "",
      dormitorios: "",
      tipo_operacion: "",
      direccion: "",
      zona: "",
      m2_lote: "",
      m2_cubiertos: "",
      precio_lista_inicial: "",
      precio_actual: "",
      precio_cierre: "",
      moneda: "ARS",
      fecha_inicio_comercializacion: "",
      fecha_cierre: "",
      honorarios_pct_vendedor: "",
      honorarios_pct_comprador: "",
    });
    setShowPropiedadModal(true);
  };

  const openEditarPropiedad = (p: TrackerPropiedad) => {
    setEditingPropiedad(p);
    setFormPropiedad({
      contacto_id: p.contacto_id ?? "",
      tipologia: p.tipologia ?? "",
      dormitorios: p.dormitorios != null ? String(p.dormitorios) : "",
      tipo_operacion: p.tipo_operacion ?? "",
      direccion: p.direccion ?? "",
      zona: p.zona ?? "",
      m2_lote: p.m2_lote != null ? String(p.m2_lote) : "",
      m2_cubiertos: p.m2_cubiertos != null ? String(p.m2_cubiertos) : "",
      precio_lista_inicial:
        p.precio_lista_inicial != null ? String(p.precio_lista_inicial) : "",
      precio_actual: p.precio_actual != null ? String(p.precio_actual) : "",
      precio_cierre: p.precio_cierre != null ? String(p.precio_cierre) : "",
      moneda: p.moneda ?? "ARS",
      fecha_inicio_comercializacion:
        p.fecha_inicio_comercializacion?.substring(0, 10) ?? "",
      fecha_cierre: p.fecha_cierre?.substring(0, 10) ?? "",
      honorarios_pct_vendedor:
        p.honorarios_pct_vendedor != null
          ? String(p.honorarios_pct_vendedor)
          : "",
      honorarios_pct_comprador:
        p.honorarios_pct_comprador != null
          ? String(p.honorarios_pct_comprador)
          : "",
    });
    setShowPropiedadModal(true);
  };

  const parseNumberOrNull = (value: string) => {
    if (!value) return null;
    const parsed = parseFloat(value.replace(/\./g, "").replace(",", "."));
    return isNaN(parsed) ? null : parsed;
  };

  // Cálculo de honorarios estimados en base al precio de cierre y los % cargados
  const honorariosEstimados = useMemo(() => {
    const precioCierre = parseNumberOrNull(formPropiedad.precio_cierre);
    if (precioCierre == null) {
      return {
        vendedor: null as number | null,
        comprador: null as number | null,
        total: null as number | null,
      };
    }

    const pctVendedor = parseNumberOrNull(
      formPropiedad.honorarios_pct_vendedor
    );
    const pctComprador = parseNumberOrNull(
      formPropiedad.honorarios_pct_comprador
    );

    const vendedor =
      pctVendedor != null ? (precioCierre * pctVendedor) / 100 : null;
    const comprador =
      pctComprador != null ? (precioCierre * pctComprador) / 100 : null;

    const totalRaw = (vendedor ?? 0) + (comprador ?? 0);
    const total = totalRaw > 0 ? totalRaw : null;

    return {
      vendedor,
      comprador,
      total,
    };
  }, [
    formPropiedad.precio_cierre,
    formPropiedad.honorarios_pct_vendedor,
    formPropiedad.honorarios_pct_comprador,
  ]);

  const guardarPropiedad = async () => {
    if (!empresaId || savingPropiedad) return;
    setSavingPropiedad(true);

    const payload = {
      empresa_id: empresaId,
      contacto_id: formPropiedad.contacto_id || null,
      tipologia: formPropiedad.tipologia || null,
      dormitorios: parseNumberOrNull(formPropiedad.dormitorios),
      tipo_operacion: formPropiedad.tipo_operacion || null,
      direccion: formPropiedad.direccion || null,
      zona: formPropiedad.zona || null,
      m2_lote: parseNumberOrNull(formPropiedad.m2_lote),
      m2_cubiertos: parseNumberOrNull(formPropiedad.m2_cubiertos),
      precio_lista_inicial: parseNumberOrNull(
        formPropiedad.precio_lista_inicial
      ),
      precio_actual: parseNumberOrNull(formPropiedad.precio_actual),
      precio_cierre: parseNumberOrNull(formPropiedad.precio_cierre),
      moneda: formPropiedad.moneda || null,
      fecha_inicio_comercializacion:
        formPropiedad.fecha_inicio_comercializacion || null,
      fecha_cierre: formPropiedad.fecha_cierre || null,
      honorarios_pct_vendedor: parseNumberOrNull(
        formPropiedad.honorarios_pct_vendedor
      ),
      honorarios_pct_comprador: parseNumberOrNull(
        formPropiedad.honorarios_pct_comprador
      ),
    };

    try {
      if (editingPropiedad) {
        const { error } = await supabase
          .from("tracker_propiedades")
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingPropiedad.id)
          .eq("empresa_id", empresaId);

        if (error) {
          console.error("Error actualizando propiedad:", error);
          showMessage("❌ No se pudo actualizar la propiedad.");
          return;
        }
      } else {
        const { error } = await supabase
          .from("tracker_propiedades")
          .insert(payload);

        if (error) {
          console.error("Error creando propiedad:", error);
          showMessage("❌ No se pudo crear la propiedad.");
          return;
        }
      }

      showMessage("✅ Propiedad guardada.");
      setShowPropiedadModal(false);

      const { data: pData } = await supabase
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
            dormitorios,
            precio_lista_inicial,
            precio_actual,
            precio_cierre,
            moneda,
            fecha_inicio_comercializacion,
            fecha_cierre,
            honorarios_pct_vendedor,
            honorarios_pct_comprador,
            asesor_id,
            created_at,
            updated_at,
            contacto:tracker_contactos (nombre, apellido)
          `
        )
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });

      const propsNormalizadas: TrackerPropiedad[] = (pData ?? []).map(
        (row: any) => {
          const contactoRaw = Array.isArray(row.contacto)
            ? row.contacto[0]
            : row.contacto;

          return {
            id: row.id,
            empresa_id: row.empresa_id,
            contacto_id: row.contacto_id,
            tipologia: row.tipologia,
            tipo_operacion: row.tipo_operacion,
            direccion: row.direccion,
            zona: row.zona,
            m2_lote: row.m2_lote,
            m2_cubiertos: row.m2_cubiertos,
            dormitorios: row.dormitorios,
            precio_lista_inicial: row.precio_lista_inicial,
            precio_actual: row.precio_actual,
            precio_cierre: row.precio_cierre,
            moneda: row.moneda,
            fecha_inicio_comercializacion: row.fecha_inicio_comercializacion,
            fecha_cierre: row.fecha_cierre,
            honorarios_pct_vendedor: row.honorarios_pct_vendedor,
            honorarios_pct_comprador: row.honorarios_pct_comprador,
            asesor_id: row.asesor_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
            contacto: contactoRaw
              ? {
                  nombre: contactoRaw.nombre ?? null,
                  apellido: contactoRaw.apellido ?? null,
                }
              : null,
          } as TrackerPropiedad;
        }
      );

      setPropiedades(propsNormalizadas);
    } catch (err) {
      console.error("Error guardando propiedad:", err);
      showMessage("❌ Error inesperado al guardar propiedad.");
    } finally {
      setSavingPropiedad(false);
    }
  };

  const eliminarPropiedad = async (id: string) => {
    if (!empresaId) return;
    if (!confirm("¿Eliminar esta propiedad captada?")) return;

    try {
      const { error } = await supabase
        .from("tracker_propiedades")
        .delete()
        .eq("id", id)
        .eq("empresa_id", empresaId);

      if (error) {
        console.error("Error eliminando propiedad:", error);
        showMessage("❌ No se pudo eliminar la propiedad.");
        return;
      }

      showMessage("✅ Propiedad eliminada.");
      setPropiedades((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Error eliminando propiedad:", err);
      showMessage("❌ Error inesperado al eliminar propiedad.");
    }
  };

  const labelEstadoContacto = (estado: TrackerContactoEstado) => {
    switch (estado) {
      case "sin_contactar":
        return "Sin contactar";
      case "primer_llamado":
        return "1° llamado";
      case "seguimiento":
        return "Seguimiento";
      case "prelisting":
        return "Prelisting";
      case "vai_factibilidad":
        return "VAI / Factibilidad";
      case "captado":
        return "Captación";
      case "cierre":
        return "Cierre";
      case "descarte":
        return "Descartado";
      default:
        return estado;
    }
  };

  const classEstadoContacto = (estado: TrackerContactoEstado) => {
    switch (estado) {
      case "sin_contactar":
        return "bg-gray-100 text-gray-700";
      case "primer_llamado":
        return "bg-blue-50 text-blue-700";
      case "seguimiento":
        return "bg-indigo-50 text-indigo-700";
      case "prelisting":
        return "bg-amber-50 text-amber-700";
      case "vai_factibilidad":
        return "bg-purple-50 text-purple-700";
      case "captado":
        return "bg-emerald-50 text-emerald-700";
      case "cierre":
        return "bg-sky-50 text-sky-700";
      case "descarte":
        return "bg-red-50 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const fmtCurrency = (n: number | null | undefined) => {
    if (n == null || isNaN(n)) return "—";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(n);
  };

  // 🔐 Guardas de carga / plan
  if (billingLoading || puedeUsarTracker === null) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-500">
        Cargando tracker de trabajo…
      </div>
    );
  }

  if (puedeUsarTracker === false) {
    // Ya redirigimos a /dashboard/empresa/planes
    return null;
  }

  if (loading && !empresaId) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-500">
        Cargando tracker de trabajo…
      </div>
    );
  }

  const monthMatrix = getMonthMatrix(currentMonth);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl xl:max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Encabezado principal */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
              Agenda de Actividades
            </h1>
            <p className="mt-1 text-sm md:text-base text-slate-600 max-w-xl">
              Tu tablero de mando diario para medir prospección, prelisting,
              captaciones y cierres.
            </p>

            {/* Filtro de vista: Empresa / Asesores / Global */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Vista:</span>
                <div className="inline-flex rounded-full border border-gray-300 bg-white p-0.5">
                  {[
                    { id: "empresa" as TrackerScope, label: "Empresa" },
                    { id: "asesores" as TrackerScope, label: "Asesores" },
                    { id: "global" as TrackerScope, label: "Global" },
                  ].map((opt) => {
                    const active = scope === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setScope(opt.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                          active
                            ? "bg-black text-white"
                            : "text-slate-700 hover:bg-gray-100"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {scope === "asesores" && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Asesor:</span>
                  <select
                    className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700"
                    value={selectedAsesorId}
                    onChange={(e) => setSelectedAsesorId(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {asesores.map((a) => (
                      <option key={a.id} value={a.id}>
                        {contactoNombreCorto(a)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Hoy / Mañana resumen */}
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="rounded-xl bg-white border border-gray-200 shadow-sm px-4 py-3 w-full md:w-56">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Hoy
                </span>
                <span className="text-[10px] text-slate-400">
                  {formatDateShort(hoy)}
                </span>
              </div>
              <div className="mt-1 text-2xl md:text-3xl font-semibold text-slate-900">
                {actividadesHoy.length}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                tareas programadas
              </div>
              <ul className="mt-2 space-y-1 max-h-20 overflow-y-auto">
                {actividadesHoy.slice(0, 3).map((a) => (
                  <li
                    key={a.id}
                    className="text-[11px] text-slate-700 flex items-center justify-between"
                  >
                    <span className="truncate">{a.titulo}</span>
                    {a.hora && (
                      <span className="ml-2 text-[10px] text-slate-400">
                        {formatTime(a.hora)}
                      </span>
                    )}
                  </li>
                ))}
                {actividadesHoy.length === 0 && (
                  <li className="text-[11px] text-slate-400">
                    Sin actividades para hoy.
                  </li>
                )}
              </ul>
            </div>

            <div className="rounded-xl bg-white border border-gray-200 shadow-sm px-4 py-3 w-full md:w-56">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Mañana
                </span>
                <span className="text-[10px] text-slate-400">
                  {formatDateShort(manana)}
                </span>
              </div>
              <div className="mt-1 text-2xl md:text-3xl font-semibold text-slate-900">
                {actividadesManana.length}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                tareas programadas
              </div>
              <ul className="mt-2 space-y-1 max-h-20 overflow-y-auto">
                {actividadesManana.slice(0, 3).map((a) => (
                  <li
                    key={a.id}
                    className="text-[11px] text-slate-700 flex items-center justify-between"
                  >
                    <span className="truncate">{a.titulo}</span>
                    {a.hora && (
                      <span className="ml-2 text-[10px] text-slate-400">
                        {formatTime(a.hora)}
                      </span>
                    )}
                  </li>
                ))}
                {actividadesManana.length === 0 && (
                  <li className="text-[11px] text-slate-400">
                    Sin actividades para mañana.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </header>

        {/* KPIs principales */}
        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm md:text-base font-semibold text-slate-900">
                Resumen de actividad
              </h2>
              <p className="text-xs text-slate-500">
                Visualizá cuántos contactos avanzan en cada etapa del circuito
                según la vista seleccionada.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Período:</span>
              <select
                value={kpiRange}
                onChange={(e) => setKpiRange(e.target.value as KpiRange)}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700"
              >
                <option value="30d">Últimos 30 días</option>
                <option value="90d">Últimos 3 meses</option>
                <option value="180d">Últimos 6 meses</option>
                <option value="365d">Último año</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Prospectos / Clientes</p>
              <p className="mt-1 text-2xl md:text-3xl font-semibold text-slate-900">
                {kpis.prospectos}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Nuevos contactos que entraron al circuito.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Prelisting</p>
              <p className="mt-1 text-2xl md:text-3xl font-semibold text-slate-900">
                {kpis.prelisting}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Propiedades con visita y análisis previo.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Captaciones</p>
              <p className="mt-1 text-2xl md:text-3xl font-semibold text-slate-900">
                {kpis.captaciones}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Propietarios que te dieron la propiedad.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Cierres</p>
              <p className="mt-1 text-2xl md:text-3xl font-semibold text-slate-900">
                {kpis.cierres}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Operaciones finalizadas con precio de cierre.
              </p>
            </div>
          </div>
        </section>

        {/* Tabs + botón hacia Business Analytics */}
        <nav className="flex flex-wrap gap-2 text-sm">
          {[
            { id: "calendario", label: "Calendario" },
            { id: "contactos", label: "Contactos / Captaciones" },
            { id: "propiedades", label: "Propiedades captadas" },
          ].map((tab) => {
            const isActive = activeTab === (tab.id as TrackerTab);
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TrackerTab)}
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
          <button
            type="button"
            onClick={() =>
              router.push("/dashboard/empresa/tracker-analytics")
            }
            className="rounded-full px-4 py-1.5 border text-sm transition bg-white text-slate-700 border-gray-300 hover:bg-gray-100"
          >
            Business Analytics
          </button>
        </nav>

        {/* CONTENIDO DE TABS */}
        {activeTab === "calendario" && (
          <section className="space-y-4">
            <div className="grid gap-6 md:grid-cols-[2fr_1.1fr] items-start">
              {/* Calendario mensual */}
              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Calendario
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {currentMonth.toLocaleDateString("es-AR", {
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setCurrentMonth(
                          new Date(
                            currentMonth.getFullYear(),
                            currentMonth.getMonth() - 1,
                            1
                          )
                        )
                      }
                      className="rounded-full border border-gray-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-gray-100"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => {
                        const now = new Date();
                        setCurrentMonth(
                          new Date(now.getFullYear(), now.getMonth(), 1)
                        );
                        setSelectedDate(startOfDay(now));
                      }}
                      className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-gray-100"
                    >
                      Hoy
                    </button>
                    <button
                      onClick={() =>
                        setCurrentMonth(
                          new Date(
                            currentMonth.getFullYear(),
                            currentMonth.getMonth() + 1,
                            1
                          )
                        )
                      }
                      className="rounded-full border border-gray-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-gray-100"
                    >
                      →
                    </button>
                  </div>
                </div>

                {/* Cabecera días semana */}
                <div className="grid grid-cols-7 text-[11px] text-slate-500 mb-1">
                  {["L", "M", "M", "J", "V", "S", "D"].map((d) => (
                    <div
                      key={d}
                      className="py-1 text-center uppercase tracking-wide"
                    >
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-rows-6 gap-y-1">
                  {monthMatrix.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-x-1">
                      {week.map((day, di) => {
                        const isCurrentMonth =
                          day.getMonth() === currentMonth.getMonth();
                        const isSelected = isSameDay(day, selectedDate);
                        const key = toDateKey(day);
                        const count = actividadesByDateMap.get(key) ?? 0;

                        return (
                          <button
                            key={di}
                            type="button"
                            onClick={() => setSelectedDate(startOfDay(day))}
                            className={`flex flex-col items-center justify-center rounded-lg border px-1.5 py-1.5 text-[11px] transition ${
                              isSelected
                                ? "border-black bg-black text-white"
                                : isCurrentMonth
                                ? "bg-white border-gray-200 text-slate-900 hover:bg-gray-50"
                                : "bg-gray-50 border-gray-200 text-slate-400 hover:bg-gray-100"
                            }`}
                          >
                            <span className="leading-none">
                              {day.getDate()}
                            </span>
                            {count > 0 && (
                              <span className="mt-1 inline-flex items-center rounded-full bg-[rgba(230,169,48,0.08)] px-1.5 py-0.5 text-[9px] font-medium text-[rgba(230,169,48,0.95)]">
                                {count} act.
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actividades del día */}
              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Actividades del día
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDate(selectedDate)}
                    </p>
                  </div>
                  <button
                    onClick={() => openNuevaActividad(selectedDate)}
                    className="inline-flex items-center gap-1 rounded-full bg-black text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-900"
                  >
                    <span className="text-sm">＋</span>
                    Agregar tarea
                  </button>
                </div>

                {actividadesSelectedDate.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No hay actividades registradas en esta fecha.
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-[360px] overflow-y-auto">
                    {actividadesSelectedDate.map((a) => {
                      const contacto = contactoPorId(a.contacto_id);
                      return (
                        <li
                          key={a.id}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-900">
                              {a.titulo}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {a.hora ? formatTime(a.hora) : "Sin hora"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-500">
                              {contactoNombreCorto(contacto)}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEditarActividad(a)}
                                className="text-[11px] text-slate-600 hover:text-black"
                              >
                                Ver / Editar
                              </button>
                              <button
                                onClick={() => eliminarActividad(a.id)}
                                className="text-[11px] text-red-600 hover:text-red-700"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Tip visual con ejemplos */}
            <div className="rounded-xl border-l-4 border-[#E6A930] bg-amber-50/60 px-4 py-3 text-[11px] text-amber-900">
              <p className="font-medium text-xs mb-1">Tip para usar el tracker</p>
              <p>
                Si hoy no tenés actividades agendadas, programá al menos{" "}
                <span className="font-semibold">3 llamadas de seguimiento</span>{" "}
                o{" "}
                <span className="font-semibold">1 prelisting</span>. Ejemplos:
                &nbsp;“Seguimiento Casa 3D en Centro” a las 10:00, “Prelisting
                Dúplex zona norte” a las 17:00. Así tu flujo de captaciones se
                mantiene siempre activo.
              </p>
            </div>
          </section>
        )}

        {activeTab === "contactos" && (
          <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Contactos / Captaciones
                </h2>
                <p className="text-xs text-slate-500">
                  Guardá propietarios y clientes potenciales, y movelos por el
                  circuito: sin contactar → seguimiento → prelisting →
                  VAI/Factibilidad → captación → cierre.
                </p>
              </div>
              <button
                onClick={openNuevoContacto}
                className="inline-flex items-center gap-1 rounded-full bg-black text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-900"
              >
                <span className="text-sm">＋</span>
                Nuevo prospecto / cliente
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-[11px] text-slate-500">
                    <th className="px-3 py-2 text-left font-medium">Contacto</th>
                    <th className="px-3 py-2 text-left font-medium">Teléfono</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Tipología
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Operación
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Estado</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Origen
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Última act.
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {contactos.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-6 text-center text-xs text-slate-500"
                      >
                        Todavía no cargaste prospectos. Empezá agregando el
                        próximo propietario o cliente potencial.
                      </td>
                    </tr>
                  )}
                  {contactos.map((c) => {
                    const ultAct = actividadesDeContacto(c.id)[0];

                    return (
                      <tr
                        key={c.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium text-slate-900">
                            {contactoNombreCorto(c)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {c.email || "Sin email"}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-slate-700">
                          {c.telefono || "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-slate-700">
                          {c.tipologia || "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-slate-700">
                          {c.tipo_operacion || "—"}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${classEstadoContacto(
                              c.estado
                            )}`}
                          >
                            {labelEstadoContacto(c.estado)}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top text-[11px] text-slate-600">
                          {c.origen || "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-[11px] text-slate-600">
                          {ultAct
                            ? `${ultAct.fecha_programada.substring(
                                8,
                                10
                              )}/${ultAct.fecha_programada.substring(5, 7)}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEditarContacto(c)}
                              className="text-[11px] text-slate-600 hover:text-black"
                            >
                              Ver / Editar
                            </button>
                            <button
                              onClick={() => openNuevaPropiedad(c.id)}
                              className="text-[11px] text-[rgba(230,169,48,0.95)] hover:text-[rgba(230,169,48,1)]"
                            >
                              Propiedad
                            </button>
                            <button
                              onClick={() => eliminarContacto(c.id)}
                              className="text-[11px] text-red-600 hover:text-red-700"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "propiedades" && (
          <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Propiedades captadas
                </h2>
                <p className="text-xs text-slate-500">
                  Seguimiento de propiedades en cartera, ajustes de precio y
                  fechas de cierre para calcular tu tasa de absorción real.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full md:w-auto">
                <button
                  onClick={() => openNuevaPropiedad()}
                  className="inline-flex items-center justify-center gap-1 rounded-full bg-black text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-900"
                >
                  <span className="text-sm">＋</span>
                  Nueva propiedad captada
                </button>
                <input
                  type="text"
                  value={propiedadesSearch}
                  onChange={(e) => setPropiedadesSearch(e.target.value)}
                  placeholder="Filtrar por cliente, tipología, operación, zona..."
                  className="w-full sm:w-64 rounded-full border border-gray-300 px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[rgba(230,169,48,0.9)]"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-[11px] text-slate-500">
                    <th className="px-3 py-2 text-left font-medium">Cliente</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Tipología
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Operación
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Dirección / Zona
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Precio actual
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Inicio / Días en venta
                    </th>
                    <th className="px-3 py-2 text-left font-medium">GAP</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {propiedadesFiltradasPorTexto.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-6 text-center text-xs text-slate-500"
                      >
                        Todavía no cargaste propiedades captadas.
                      </td>
                    </tr>
                  )}
                  {propiedadesFiltradasPorTexto.map((p) => {
                    const contacto =
                      p.contacto_id && contactoPorId(p.contacto_id)
                        ? contactoPorId(p.contacto_id)
                        : p.contacto ?? null;

                    const isCerrada = !!p.fecha_cierre;
                    const diasVenta = diasEntreFechas(
                      p.fecha_inicio_comercializacion,
                      p.fecha_cierre
                    );

                    const rowBase =
                      "border-b border-gray-100 hover:bg-gray-50";
                    const rowClosed = isCerrada ? "bg-emerald-200" : "";

                    let gapTexto = "—";
                    if (
                      p.precio_lista_inicial != null &&
                      p.precio_lista_inicial > 0 &&
                      p.precio_cierre != null
                    ) {
                      const diff =
                        ((p.precio_lista_inicial - p.precio_cierre) /
                          p.precio_lista_inicial) *
                        100;
                      const gap = Math.abs(Math.round(diff));
                      if (!isNaN(gap)) gapTexto = `${gap}%`;
                    }

                    return (
                      <tr key={p.id} className={`${rowBase} ${rowClosed}`}>
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium text-slate-900">
                            {contacto
                              ? contactoNombreCorto(contacto)
                              : "Sin asignar"}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-slate-700">
                          {p.tipologia || "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-slate-700">
                          {p.tipo_operacion || "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                          {p.direccion || "—"}
                          {p.zona ? ` · ${p.zona}` : ""}
                        </td>
                        <td className="px-3 py-2 align-top text-slate-700">
                          {fmtCurrency(p.precio_actual ?? p.precio_lista_inicial)}
                        </td>
                        <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                          {p.fecha_inicio_comercializacion
                            ? p.fecha_inicio_comercializacion.substring(0, 10)
                            : "—"}{" "}
                          /{" "}
                          {diasVenta != null ? `${diasVenta} días` : "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-slate-700">
                          {gapTexto}
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEditarPropiedad(p)}
                              className="text-[11px] text-slate-600 hover:text-black"
                            >
                              Ver / Editar
                            </button>
                            <button
                              onClick={() => eliminarPropiedad(p.id)}
                              className="text-[11px] text-red-600 hover:text-red-700"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Mensaje flotante */}
        {mensaje && (
          <div className="fixed bottom-4 right-4 rounded-full bg-black text-white px-4 py-2 text-xs shadow-lg">
            {mensaje}
          </div>
        )}
        {/* MODAL CONTACTO */}
        {showContactoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-gray-200">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {editingContacto ? "Editar contacto" : "Nuevo prospecto / cliente"}
                </h3>
                <button
                  onClick={() => setShowContactoModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto px-4 py-3 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Nombre
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      placeholder="Ej: Juan"
                      value={formContacto.nombre}
                      onChange={(e) =>
                        setFormContacto((f) => ({
                          ...f,
                          nombre: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Apellido
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      placeholder="Ej: Pérez"
                      value={formContacto.apellido}
                      onChange={(e) =>
                        setFormContacto((f) => ({
                          ...f,
                          apellido: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Teléfono
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      placeholder="Ej: 351 000 0000"
                      value={formContacto.telefono}
                      onChange={(e) =>
                        setFormContacto((f) => ({
                          ...f,
                          telefono: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Email
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      placeholder="Ej: juan@cliente.com"
                      value={formContacto.email}
                      onChange={(e) =>
                        setFormContacto((f) => ({
                          ...f,
                          email: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Tipología
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      value={formContacto.tipologia}
                      onChange={(e) =>
                        setFormContacto((f) => ({
                          ...f,
                          tipologia: e.target.value,
                        }))
                      }
                    >
                      <option value="">Seleccionar…</option>
                      <option value="casa">Casa</option>
                      <option value="departamento">Departamento</option>
                      <option value="duplex">Dúplex</option>
                      <option value="local">Local</option>
                      <option value="oficina">Oficina</option>
                      <option value="galpon">Galpón</option>
                      <option value="ph">PH</option>
                      <option value="terreno">Terreno / Lote</option>
                      <option value="cochera">Cochera</option>
                      <option value="campo">Campo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Operación
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      value={formContacto.tipo_operacion}
                      onChange={(e) =>
                        setFormContacto((f) => ({
                          ...f,
                          tipo_operacion: e.target.value,
                        }))
                      }
                    >
                      <option value="">Seleccionar…</option>
                      <option value="venta">Venta</option>
                      <option value="alquiler">Alquiler</option>
                      <option value="alquiler_temporario">
                        Alquiler temporario
                      </option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Origen del contacto
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      value={formContacto.origen}
                      onChange={(e) =>
                        setFormContacto((f) => ({
                          ...f,
                          origen: e.target.value,
                        }))
                      }
                    >
                      <option value="">Seleccionar…</option>
                      <option value="recomendacion">Recomendación</option>
                      <option value="redes">Redes sociales</option>
                      <option value="portal">Portal inmobiliario</option>
                      <option value="cartel">Cartel</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Zona / barrio
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      placeholder="Ej: Nueva Córdoba"
                      value={formContacto.zona}
                      onChange={(e) =>
                        setFormContacto((f) => ({
                          ...f,
                          zona: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Estado del contacto
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                    value={formContacto.estado}
                    onChange={(e) =>
                      setFormContacto((f) => ({
                        ...f,
                        estado: e.target.value as TrackerContactoEstado,
                      }))
                    }
                  >
                    <option value="sin_contactar">Sin contactar</option>
                    <option value="primer_llamado">1° llamado</option>
                    <option value="seguimiento">Seguimiento</option>
                    <option value="prelisting">Prelisting</option>
                    <option value="vai_factibilidad">VAI / Factibilidad</option>
                    <option value="captado">Captación</option>
                    <option value="cierre">Cierre</option>
                    <option value="descarte">Descartado</option>
                  </select>
                </div>

                {formContacto.estado === "descarte" && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Motivo de descarte
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      rows={2}
                      placeholder="Ej: Prefiere trabajar con otra inmobiliaria, no quiere firmar exclusividad, etc."
                      value={formContacto.motivo_descarte}
                      onChange={(e) =>
                        setFormContacto((f) => ({
                          ...f,
                          motivo_descarte: e.target.value,
                        }))
                      }
                    />
                  </div>
                )}

                {/* Historial de actividades del contacto */}
                {editingContacto && (
                  <div className="border-t border-gray-200 pt-3 mt-2">
                    <h4 className="text-[11px] font-semibold text-slate-700 mb-1">
                      Historial de actividades
                    </h4>
                    {(() => {
                      const historial = actividadesDeContacto(
                        editingContacto.id
                      );
                      if (historial.length === 0) {
                        return (
                          <p className="text-[11px] text-slate-500">
                            Este contacto todavía no tiene actividades
                            registradas en el tracker.
                          </p>
                        );
                      }
                      const ultima = historial[0];
                      return (
                        <div className="space-y-2">
                          <p className="text-[11px] text-slate-600">
                            <span className="font-semibold">
                              Última actividad:
                            </span>{" "}
                            {labelTipoActividad(ultima.tipo)} ·{" "}
                            {ultima.fecha_programada}{" "}
                            {ultima.hora ? `· ${formatTime(ultima.hora)}` : ""}
                          </p>
                          <ul className="space-y-1 max-h-32 overflow-y-auto">
                            {historial.map((a) => (
                              <li
                                key={a.id}
                                className="text-[11px] text-slate-600 flex justify-between gap-2"
                              >
                                <span className="truncate">
                                  {labelTipoActividad(a.tipo)} · {a.titulo}
                                </span>
                                <span className="shrink-0 text-slate-400">
                                  {a.fecha_programada.substring(8, 10)}/
                                  {a.fecha_programada.substring(5, 7)}{" "}
                                  {a.hora ? `· ${formatTime(a.hora)}` : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
                <button
                  onClick={() => setShowContactoModal(false)}
                  className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarContacto}
                  disabled={savingContacto}
                  className={`rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-900 ${
                    savingContacto ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  {savingContacto ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL ACTIVIDAD */}
        {showActividadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-gray-200">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {editingActividad ? "Editar actividad" : "Nueva actividad"}
                </h3>
                <button
                  onClick={() => setShowActividadModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto px-4 py-3 space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Título de la actividad
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                    placeholder="Ej: Seguimiento Casa 3D en Centro"
                    value={formActividad.titulo}
                    onChange={(e) =>
                      setFormActividad((f) => ({
                        ...f,
                        titulo: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Tipo
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      value={formActividad.tipo}
                      onChange={(e) =>
                        setFormActividad((f) => ({
                          ...f,
                          tipo: e.target.value as TrackerActividadTipo,
                        }))
                      }
                    >
                      <option value="seguimiento">Seguimiento</option>
                      <option value="reunion">Reunión</option>
                      <option value="muestra">Muestra</option>
                      <option value="prelisting">Prelisting</option>
                      <option value="vai">VAI</option>
                      <option value="factibilidad">Factibilidad</option>
                      <option value="reserva">Reserva</option>
                      <option value="cierre">Cierre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Contacto
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      value={formActividad.contacto_id}
                      onChange={(e) =>
                        setFormActividad((f) => ({
                          ...f,
                          contacto_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">Sin asignar</option>
                      {contactos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {contactoNombreCorto(c)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Fecha
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      value={formActividad.fecha_programada}
                      onChange={(e) =>
                        setFormActividad((f) => ({
                          ...f,
                          fecha_programada: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Hora
                    </label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      value={formActividad.hora}
                      onChange={(e) =>
                        setFormActividad((f) => ({
                          ...f,
                          hora: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Notas
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                    rows={3}
                    placeholder="Ej: Segunda llamada, quedó en revisar condiciones y me devuelve esta semana."
                    value={formActividad.notas}
                    onChange={(e) =>
                      setFormActividad((f) => ({
                        ...f,
                        notas: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
                <button
                  onClick={() => setShowActividadModal(false)}
                  className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarActividad}
                  disabled={savingActividad}
                  className={`rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-900 ${
                    savingActividad ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  {savingActividad ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL PROPIEDAD */}
        {showPropiedadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-gray-200">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {editingPropiedad
                    ? "Editar propiedad captada"
                    : "Nueva propiedad captada"}
                </h3>
                <button
                  onClick={() => setShowPropiedadModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto px-4 py-3 space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Cliente
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                    value={formPropiedad.contacto_id}
                    onChange={(e) =>
                      setFormPropiedad((f) => ({
                        ...f,
                        contacto_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">Seleccionar…</option>
                    {contactos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {contactoNombreCorto(c)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Tipología
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      value={formPropiedad.tipologia}
                      onChange={(e) =>
                        setFormPropiedad((f) => ({
                          ...f,
                          tipologia: e.target.value,
                        }))
                      }
                    >
                      <option value="">Seleccionar…</option>
                      <option value="casa">Casa</option>
                      <option value="departamento">Departamento</option>
                      <option value="duplex">Dúplex</option>
                      <option value="local">Local</option>
                      <option value="oficina">Oficina</option>
                      <option value="galpon">Galpón</option>
                      <option value="ph">PH</option>
                      <option value="terreno">Terreno / Lote</option>
                      <option value="cochera">Cochera</option>
                      <option value="campo">Campo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Dormitorios
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      placeholder="Ej: 3"
                      value={formPropiedad.dormitorios}
                      onChange={(e) =>
                        setFormPropiedad((f) => ({
                          ...f,
                          dormitorios: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Operación
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      value={formPropiedad.tipo_operacion}
                      onChange={(e) =>
                        setFormPropiedad((f) => ({
                          ...f,
                          tipo_operacion: e.target.value,
                        }))
                      }
                    >
                      <option value="">Seleccionar…</option>
                      <option value="venta">Venta</option>
                      <option value="alquiler">Alquiler</option>
                      <option value="alquiler_temporario">
                        Alquiler temporario
                      </option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Dirección
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                    placeholder="Ej: Av. Siempreviva 123"
                    value={formPropiedad.direccion}
                    onChange={(e) =>
                      setFormPropiedad((f) => ({
                        ...f,
                        direccion: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Zona / barrio
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      placeholder="Ej: Barrio Centro"
                      value={formPropiedad.zona}
                      onChange={(e) =>
                        setFormPropiedad((f) => ({
                          ...f,
                          zona: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Moneda
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      value={formPropiedad.moneda}
                      onChange={(e) =>
                        setFormPropiedad((f) => ({
                          ...f,
                          moneda: e.target.value,
                        }))
                      }
                    >
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      m² lote
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      value={formPropiedad.m2_lote}
                      onChange={(e) =>
                        setFormPropiedad((f) => ({
                          ...f,
                          m2_lote: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      m² cubiertos
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      value={formPropiedad.m2_cubiertos}
                      onChange={(e) =>
                        setFormPropiedad((f) => ({
                          ...f,
                          m2_cubiertos: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Precio lista inicial
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      placeholder="Ej: 120000"
                      value={formPropiedad.precio_lista_inicial}
                      onChange={(e) =>
                        setFormPropiedad((f) => ({
                          ...f,
                          precio_lista_inicial: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Precio actual
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      placeholder="Ej: 115000"
                      value={formPropiedad.precio_actual}
                      onChange={(e) =>
                        setFormPropiedad((f) => ({
                          ...f,
                          precio_actual: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Precio de cierre
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      placeholder="Ej: 110000"
                      value={formPropiedad.precio_cierre}
                      onChange={(e) =>
                        setFormPropiedad((f) => ({
                          ...f,
                          precio_cierre: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Inicio comercialización
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      value={formPropiedad.fecha_inicio_comercializacion}
                      onChange={(e) =>
                        setFormPropiedad((f) => ({
                          ...f,
                          fecha_inicio_comercializacion: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Fecha de cierre
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      value={formPropiedad.fecha_cierre}
                      onChange={(e) =>
                        setFormPropiedad((f) => ({
                          ...f,
                          fecha_cierre: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Honorarios */}
                <div className="border-t border-gray-200 pt-3 mt-2 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-700">
                    Honorarios
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Vendedor (%)
                      </label>
                      <input
                        className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                        placeholder="Ej: 3"
                        value={formPropiedad.honorarios_pct_vendedor}
                        onChange={(e) =>
                          setFormPropiedad((f) => ({
                            ...f,
                            honorarios_pct_vendedor: e.target.value,
                          }))
                        }
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Neto estimado:{" "}
                        {honorariosEstimados.vendedor != null
                          ? fmtCurrency(honorariosEstimados.vendedor)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Comprador (%)
                      </label>
                      <input
                        className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                        placeholder="Ej: 3"
                        value={formPropiedad.honorarios_pct_comprador}
                        onChange={(e) =>
                          setFormPropiedad((f) => ({
                            ...f,
                            honorarios_pct_comprador: e.target.value,
                          }))
                        }
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Neto estimado:{" "}
                        {honorariosEstimados.comprador != null
                          ? fmtCurrency(honorariosEstimados.comprador)
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Total estimado:{" "}
                    {honorariosEstimados.total != null
                      ? fmtCurrency(honorariosEstimados.total)
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
                <button
                  onClick={() => setShowPropiedadModal(false)}
                  className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarPropiedad}
                  disabled={savingPropiedad}
                  className={`rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-900 ${
                    savingPropiedad ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  {savingPropiedad ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
