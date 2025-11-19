"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

export const dynamic = "force-dynamic";

type EstadoPipeline =
  | "sin_contactar"
  | "primer_llamado"
  | "seguimiento"
  | "prelisting"
  | "vai_factibilidad"
  | "captacion"
  | "reserva"
  | "cierre"
  | "descartado"
  // legacy
  | "no_contactado"
  | "contactado"
  | "en_seguimiento"
  | "captado";

interface TrackerContacto {
  id: string;
  empresa_id: string;
  created_at: string | null;
  updated_at?: string | null;
  nombre: string;
  apellido?: string | null;
  telefono?: string | null;
  email?: string | null;
  origen?: string | null;
  tipologia?: string | null;
  tipo_operacion?: string | null;
  direccion?: string | null;
  link_referencia?: string | null;
  estado_pipeline?: EstadoPipeline | null;
  motivo_descartado?: string | null;
  notas?: string | null;
}

interface TrackerActividad {
  id: string;
  empresa_id: string;
  contacto_id?: string | null;
  tipo?: string | null;
  fecha_programada?: string | null; // timestamptz
  notas?: string | null;
  created_at?: string | null;
}

interface TrackerPropiedad {
  id: string;
  empresa_id: string;
  contacto_id: string;
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
  created_at: string | null;
  updated_at: string | null;
  contacto?: {
    nombre: string | null;
    apellido: string | null;
  } | null;
}

interface TrackerPrecioPropiedad {
  id: string;
  propiedad_id: string;
  precio: number;
  moneda: string | null;
  fecha_cambio: string | null;
  motivo: string | null;
  created_at: string | null;
}

const ESTADOS_PIPELINE_LABEL: Record<EstadoPipeline, string> = {
  sin_contactar: "Sin contactar",
  primer_llamado: "Primer llamado",
  seguimiento: "Seguimiento",
  prelisting: "Prelisting",
  vai_factibilidad: "VAI / Factibilidad",
  captacion: "Captación",
  reserva: "Reserva",
  cierre: "Cierre",
  descartado: "Descartado",

  no_contactado: "Sin contactar",
  contactado: "Primer llamado",
  en_seguimiento: "Seguimiento",
  captado: "Captación",
};

const ESTADOS_PIPELINE_OPCIONES: EstadoPipeline[] = [
  "sin_contactar",
  "primer_llamado",
  "seguimiento",
  "prelisting",
  "vai_factibilidad",
  "captacion",
  "reserva",
  "cierre",
  "descartado",
];

const ORIGENES_CONTACTO = [
  "Portal inmobiliario",
  "Redes sociales",
  "Referido",
  "Cartel / Walk-in",
  "Base propia",
  "Otro",
] as const;

const TIPOS_ACTIVIDAD = [
  "Llamada en frío",
  "Seguimiento",
  "Prelisting",
  "VAI",
  "Factibilidad",
  "Reunión",
  "Muestra",
  "Reserva",
  "Cierre",
] as const;

const TIPOLOGIAS = [
  "Casa",
  "Departamento",
  "Dúplex",
  "Local",
  "Oficina",
  "Galpón / Depósito",
  "Cochera",
  "Campo",
] as const;

const TIPOS_OPERACION = ["Venta", "Alquiler", "Alquiler temporal", "Otro"] as const;

type RangoKPI = "30d" | "90d" | "180d" | "365d";

const RANGO_LABEL: Record<RangoKPI, string> = {
  "30d": "Últimos 30 días",
  "90d": "Últimos 3 meses",
  "180d": "Últimos 6 meses",
  "365d": "Último año",
};

const normalizarEstado = (raw?: string | null): EstadoPipeline => {
  if (!raw) return "sin_contactar";
  const v = raw as EstadoPipeline;
  switch (v) {
    case "no_contactado":
      return "sin_contactar";
    case "contactado":
      return "primer_llamado";
    case "en_seguimiento":
      return "seguimiento";
    case "captado":
      return "captacion";
    default:
      return v;
  }
};

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

const addMonths = (d: Date, diff: number) =>
  new Date(d.getFullYear(), d.getMonth() + diff, 1);

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const fmtCurrency = (value?: number | null, currency: string = "ARS") => {
  if (value == null || !isFinite(value)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
};

const fmtDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR");
};

const diffDays = (from?: string | null, to?: string | null) => {
  if (!from) return null;
  const a = new Date(from);
  const b = to ? new Date(to) : new Date();
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};

function calcDesde(now: Date, rango: RangoKPI) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const days =
    rango === "30d" ? 30 : rango === "90d" ? 90 : rango === "180d" ? 180 : 365;
  return new Date(now.getTime() - days * msPerDay);
}

function resolveEtapaActividad(tipo: string): string {
  switch (tipo) {
    case "Llamada en frío":
      return "Primer llamado";
    case "Seguimiento":
      return "Seguimiento";
    case "Prelisting":
      return "Prelisting";
    case "VAI":
    case "Factibilidad":
      return "VAI / Factibilidad";
    case "Reserva":
      return "Reserva";
    case "Cierre":
      return "Cierre";
    case "Muestra":
      return "Muestra";
    case "Reunión":
      return "Reunión";
    default:
      return "Actividad";
  }
}

type Section = "calendario" | "contactos" | "propiedades";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function KpiCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.9)]">
      <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
        {title}
      </p>
      <p className="mt-2 text-2xl font-semibold text-neutral-50">{value}</p>
      {subtitle && (
        <p className="mt-1 text-[11px] text-neutral-400">{subtitle}</p>
      )}
    </div>
  );
}

export default function EmpresaTrackerPage() {
  const { user } = useAuth();
  const empresaId = user?.empresa_id ?? null;

  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>("calendario");

  const [contactos, setContactos] = useState<TrackerContacto[]>([]);
  const [actividades, setActividades] = useState<TrackerActividad[]>([]);
  const [propiedades, setPropiedades] = useState<TrackerPropiedad[]>([]);

  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [monthCursor, setMonthCursor] = useState<Date>(
    startOfMonth(new Date())
  );
  const [rangoKPIs, setRangoKPIs] = useState<RangoKPI>("90d");

  // Nuevo contacto (modal)
  const [showNuevoContacto, setShowNuevoContacto] = useState(false);
  const [ncNombre, setNcNombre] = useState("");
  const [ncApellido, setNcApellido] = useState("");
  const [ncTelefono, setNcTelefono] = useState("");
  const [ncEmail, setNcEmail] = useState("");
  const [ncOrigen, setNcOrigen] =
    useState<(typeof ORIGENES_CONTACTO)[number]>("Portal inmobiliario");
  const [ncTipologia, setNcTipologia] =
    useState<(typeof TIPOLOGIAS)[number]>("Departamento");
  const [ncTipoOperacion, setNcTipoOperacion] =
    useState<(typeof TIPOS_OPERACION)[number]>("Venta");
  const [ncDireccion, setNcDireccion] = useState("");
  const [ncLinkReferencia, setNcLinkReferencia] = useState("");
  const [ncEstadoPipeline, setNcEstadoPipeline] =
    useState<EstadoPipeline>("sin_contactar");
  const [ncNotas, setNcNotas] = useState("");
  const [ncSaving, setNcSaving] = useState(false);

  // Contacto seleccionado (ficha)
  const [selectedContacto, setSelectedContacto] =
    useState<TrackerContacto | null>(null);

  // Nueva actividad (modal)
  const [showNuevaActividadModal, setShowNuevaActividadModal] = useState(false);
  const [newActTipo, setNewActTipo] = useState<string>("Llamada en frío");
  const [newActContactoId, setNewActContactoId] = useState<string | null>(null);
  const [newActHora, setNewActHora] = useState("10:00");
  const [newActNotas, setNewActNotas] = useState("");
  const [newActSaving, setNewActSaving] = useState(false);
  const [newActMsg, setNewActMsg] = useState<string | null>(null);

  // Propiedad captada (modal desde ficha contacto)
  const [showPropiedadModal, setShowPropiedadModal] = useState(false);
  const [propTipologia, setPropTipologia] =
    useState<(typeof TIPOLOGIAS)[number]>("Departamento");
  const [propTipoOperacion, setPropTipoOperacion] =
    useState<(typeof TIPOS_OPERACION)[number]>("Venta");
  const [propDireccion, setPropDireccion] = useState("");
  const [propZona, setPropZona] = useState("");
  const [propM2Lote, setPropM2Lote] = useState<string>("");
  const [propM2Cubiertos, setPropM2Cubiertos] = useState<string>("");
  const [propPrecioInicial, setPropPrecioInicial] = useState<string>("");
  const [propMoneda, setPropMoneda] = useState("ARS");
  const [propSaving, setPropSaving] = useState(false);

  // Ver / editar propiedad (desde sección Propiedades captadas)
  const [selectedPropiedad, setSelectedPropiedad] =
    useState<TrackerPropiedad | null>(null);
  const [showPropiedadDetalleModal, setShowPropiedadDetalleModal] =
    useState(false);
  const [propDetallePrecioCierre, setPropDetallePrecioCierre] =
    useState<string>("");
  const [propDetalleFechaCierre, setPropDetalleFechaCierre] =
    useState<string>("");
  const [propDetalleSaving, setPropDetalleSaving] = useState(false);

  // Historial de precios de la propiedad seleccionada
  const [preciosPropiedad, setPreciosPropiedad] = useState<
    TrackerPrecioPropiedad[]
  >([]);
  const [newPrecioValor, setNewPrecioValor] = useState<string>("");
  const [newPrecioMotivo, setNewPrecioMotivo] = useState<string>("");
  const [newPrecioSaving, setNewPrecioSaving] = useState(false);
  const actividadesDelDia = useMemo(() => {
    return actividades.filter((a) => {
      if (!a.fecha_programada) return false;
      const d = new Date(a.fecha_programada);
      return isSameDay(d, selectedDate);
    });
  }, [actividades, selectedDate]);

  const actividadesPorContacto = useMemo(() => {
    const map = new Map<string, TrackerActividad[]>();
    actividades.forEach((a) => {
      if (!a.contacto_id) return;
      const prev = map.get(a.contacto_id) ?? [];
      prev.push(a);
      map.set(a.contacto_id, prev);
    });
    return map;
  }, [actividades]);

  const { prospectos, prelisting, captaciones, cierres } = useMemo(() => {
    const ahora = new Date();
    const desde = calcDesde(ahora, rangoKPIs);

    let prospectos = 0;
    let prelisting = 0;
    let captaciones = 0;
    let cierres = 0;

    contactos.forEach((c) => {
      const created = c.created_at ? new Date(c.created_at) : null;
      if (!created || created < desde) return;

      const estado = normalizarEstado(c.estado_pipeline);
      prospectos += 1;

      if (estado === "prelisting") prelisting += 1;
      if (estado === "captacion") captaciones += 1;
      if (estado === "cierre") cierres += 1;
    });

    return { prospectos, prelisting, captaciones, cierres };
  }, [contactos, rangoKPIs]);

  const propiedadesConContacto = useMemo(() => {
    return propiedades.map((p) => ({
      ...p,
      contactoNombre:
        p.contacto?.nombre || p.contacto?.apellido
          ? `${p.contacto?.nombre ?? ""} ${p.contacto?.apellido ?? ""}`.trim()
          : "",
    }));
  }, [propiedades]);

   // Carga inicial
  useEffect(() => {
    if (!empresaId) {
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      try {
        setLoading(true);

        const [{ data: cData }, { data: aData }, { data: pData }] =
          await Promise.all([
            supabase
              .from("tracker_contactos")
              .select("*")
              .eq("empresa_id", empresaId)
              .order("created_at", { ascending: false }),
            supabase
              .from("tracker_actividades")
              .select("*")
              .eq("empresa_id", empresaId)
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
                  precio_lista_inicial,
                  precio_actual,
                  precio_cierre,
                  moneda,
                  fecha_inicio_comercializacion,
                  fecha_cierre,
                  created_at,
                  updated_at,
                  contacto:tracker_contactos (nombre, apellido)
                `
              )
              .eq("empresa_id", empresaId)
              .order("created_at", { ascending: false }),
          ]);

        setContactos((cData as TrackerContacto[]) ?? []);
        setActividades((aData as TrackerActividad[]) ?? []);

        // 👇 Normalizamos la relación contacto (Supabase la devuelve como array)
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
              precio_lista_inicial: row.precio_lista_inicial,
              precio_actual: row.precio_actual,
              precio_cierre: row.precio_cierre,
              moneda: row.moneda,
              fecha_inicio_comercializacion:
                row.fecha_inicio_comercializacion,
              fecha_cierre: row.fecha_cierre,
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


  const handleCrearContacto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) return;
    if (!ncNombre.trim()) {
      alert("El nombre es obligatorio");
      return;
    }

    try {
      setNcSaving(true);

      const { data, error } = await supabase
        .from("tracker_contactos")
        .insert({
          empresa_id: empresaId,
          nombre: ncNombre.trim(),
          apellido: ncApellido.trim() || null,
          telefono: ncTelefono.trim() || null,
          email: ncEmail.trim() || null,
          origen: ncOrigen,
          tipologia: ncTipologia,
          tipo_operacion: ncTipoOperacion,
          direccion: ncDireccion.trim() || null,
          link_referencia: ncLinkReferencia.trim() || null,
          estado_pipeline: ncEstadoPipeline,
          notas: ncNotas.trim() || null,
        })
        .select("*")
        .single();

      if (error) throw error;

      setContactos((prev) => [data as TrackerContacto, ...prev]);

      setShowNuevoContacto(false);
      setNcNombre("");
      setNcApellido("");
      setNcTelefono("");
      setNcEmail("");
      setNcOrigen("Portal inmobiliario");
      setNcTipologia("Departamento");
      setNcTipoOperacion("Venta");
      setNcDireccion("");
      setNcLinkReferencia("");
      setNcEstadoPipeline("sin_contactar");
      setNcNotas("");
    } catch (err) {
      console.error("Error creando contacto:", err);
      alert("No se pudo crear el contacto");
    } finally {
      setNcSaving(false);
    }
  };

  const handleChangeEstadoContacto = async (
    contactoId: string,
    nuevoEstado: EstadoPipeline
  ) => {
    try {
      let motivo_descartado: string | null = null;

      if (nuevoEstado === "descartado") {
        motivo_descartado =
          window.prompt(
            "Motivo del descarte (este dato queda guardado en la ficha):"
          ) || null;
      }

      const { error } = await supabase
        .from("tracker_contactos")
        .update({
          estado_pipeline: nuevoEstado,
          motivo_descartado,
        })
        .eq("id", contactoId);

      if (error) throw error;

      setContactos((prev) =>
        prev.map((c) =>
          c.id === contactoId
            ? {
                ...c,
                estado_pipeline: nuevoEstado,
                motivo_descartado:
                  nuevoEstado === "descartado" ? motivo_descartado : null,
              }
            : c
        )
      );
    } catch (err) {
      console.error(err);
      alert("No se pudo actualizar el estado del contacto");
    }
  };

  const handleNuevaActividad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) return;

    try {
      setNewActSaving(true);
      setNewActMsg(null);

      const [hours, mins] = newActHora.split(":").map((v) => parseInt(v, 10));
      const fecha = new Date(selectedDate);
      fecha.setHours(hours || 0, mins || 0, 0, 0);

      const { data, error } = await supabase
        .from("tracker_actividades")
        .insert({
          empresa_id: empresaId,
          contacto_id: newActContactoId,
          tipo: newActTipo,
          fecha_programada: fecha.toISOString(),
          notas: newActNotas.trim() || null,
        })
        .select("*")
        .single();

      if (error) throw error;

      setActividades((prev) => [...prev, data as TrackerActividad]);

      setNewActMsg("Actividad registrada en el calendario.");
      setTimeout(() => setNewActMsg(null), 2500);

      setShowNuevaActividadModal(false);
      setNewActTipo("Llamada en frío");
      setNewActContactoId(null);
      setNewActHora("10:00");
      setNewActNotas("");
    } catch (err) {
      console.error("Error creando actividad:", err);
      alert("No se pudo crear la actividad");
    } finally {
      setNewActSaving(false);
    }
  };

  const handleCrearPropiedad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId || !selectedContacto) return;
    if (!propPrecioInicial.trim()) {
      alert("Ingresá un precio inicial");
      return;
    }

    try {
      setPropSaving(true);
      const precioN = parseFloat(propPrecioInicial.replace(/\./g, "").replace(",", "."));
      if (!isFinite(precioN)) {
        alert("Precio inválido");
        setPropSaving(false);
        return;
      }

      const m2Lote =
        propM2Lote.trim() === ""
          ? null
          : parseFloat(propM2Lote.replace(",", "."));
      const m2Cub =
        propM2Cubiertos.trim() === ""
          ? null
          : parseFloat(propM2Cubiertos.replace(",", "."));

      const { data, error } = await supabase
        .from("tracker_propiedades")
        .insert({
          empresa_id: empresaId,
          contacto_id: selectedContacto.id,
          tipologia: propTipologia,
          tipo_operacion: propTipoOperacion,
          direccion: propDireccion.trim() || null,
          zona: propZona.trim() || null,
          m2_lote: isFinite(m2Lote ?? NaN) ? m2Lote : null,
          m2_cubiertos: isFinite(m2Cub ?? NaN) ? m2Cub : null,
          precio_lista_inicial: precioN,
          precio_actual: precioN,
          moneda: propMoneda,
          fecha_inicio_comercializacion: new Date().toISOString(),
        })
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
          updated_at
        `
        )
        .single();

      if (error) throw error;

      setPropiedades((prev) => [
        {
          ...(data as any),
          contacto: {
            nombre: selectedContacto.nombre,
            apellido: selectedContacto.apellido ?? null,
          },
        } as TrackerPropiedad,
        ...prev,
      ]);

      // También insertamos el primer registro en historial de precios
      await supabase.from("tracker_precios_propiedad").insert({
        propiedad_id: (data as any).id,
        precio: precioN,
        moneda: propMoneda,
        motivo: "Precio inicial",
      });

      setShowPropiedadModal(false);
      setPropTipologia("Departamento");
      setPropTipoOperacion("Venta");
      setPropDireccion("");
      setPropZona("");
      setPropM2Lote("");
      setPropM2Cubiertos("");
      setPropPrecioInicial("");
      setPropMoneda("ARS");
    } catch (err) {
      console.error("Error creando propiedad:", err);
      alert("No se pudo crear la propiedad captada");
    } finally {
      setPropSaving(false);
    }
  };

  const abrirDetallePropiedad = async (prop: TrackerPropiedad) => {
    setSelectedPropiedad(prop);
    setShowPropiedadDetalleModal(true);
    setPropDetallePrecioCierre(
      prop.precio_cierre != null ? String(prop.precio_cierre) : ""
    );
    setPropDetalleFechaCierre(
      prop.fecha_cierre ? prop.fecha_cierre.slice(0, 10) : ""
    );
    setNewPrecioValor("");
    setNewPrecioMotivo("");

    try {
      const { data, error } = await supabase
        .from("tracker_precios_propiedad")
        .select("*")
        .eq("propiedad_id", prop.id)
        .order("fecha_cambio", { ascending: true });

      if (error) throw error;
      setPreciosPropiedad((data as TrackerPrecioPropiedad[]) ?? []);
    } catch (err) {
      console.error("Error cargando historial precios:", err);
      setPreciosPropiedad([]);
    }
  };

  const handleRegistrarAjustePrecio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropiedad) return;
    if (!newPrecioValor.trim()) {
      alert("Ingresá un nuevo precio");
      return;
    }

    try {
      setNewPrecioSaving(true);
      const precioN = parseFloat(
        newPrecioValor.replace(/\./g, "").replace(",", ".")
      );
      if (!isFinite(precioN)) {
        alert("Precio inválido");
        setNewPrecioSaving(false);
        return;
      }

      const fechaCambio = new Date().toISOString().slice(0, 10);

      const { error: errIns } = await supabase
        .from("tracker_precios_propiedad")
        .insert({
          propiedad_id: selectedPropiedad.id,
          precio: precioN,
          moneda: selectedPropiedad.moneda ?? "ARS",
          fecha_cambio: fechaCambio,
          motivo: newPrecioMotivo.trim() || null,
        });

      if (errIns) throw errIns;

      const { data: updated, error: errUpd } = await supabase
        .from("tracker_propiedades")
        .update({
          precio_actual: precioN,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedPropiedad.id)
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
          updated_at
        `
        )
        .single();

      if (errUpd) throw errUpd;

      setPropiedades((prev) =>
        prev.map((p) =>
          p.id === selectedPropiedad.id
            ? {
                ...(updated as TrackerPropiedad),
                contacto: selectedPropiedad.contacto ?? null,
              }
            : p
        )
      );

      setPreciosPropiedad((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          propiedad_id: selectedPropiedad.id,
          precio: precioN,
          moneda: selectedPropiedad.moneda ?? "ARS",
          fecha_cambio: fechaCambio,
          motivo: newPrecioMotivo.trim() || null,
          created_at: new Date().toISOString(),
        },
      ]);

      setNewPrecioValor("");
      setNewPrecioMotivo("");
    } catch (err) {
      console.error("Error registrando ajuste de precio:", err);
      alert("No se pudo registrar el ajuste de precio");
    } finally {
      setNewPrecioSaving(false);
    }
  };

  const handleGuardarCierreOperacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropiedad) return;

    try {
      setPropDetalleSaving(true);

      const precioCierre =
        propDetallePrecioCierre.trim() === ""
          ? null
          : parseFloat(
              propDetallePrecioCierre.replace(/\./g, "").replace(",", ".")
            );
      const fechaCierre =
        propDetalleFechaCierre.trim() === ""
          ? null
          : propDetalleFechaCierre.trim();

      const { data: updated, error } = await supabase
        .from("tracker_propiedades")
        .update({
          precio_cierre: isFinite(precioCierre ?? NaN)
            ? precioCierre
            : null,
          fecha_cierre: fechaCierre,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedPropiedad.id)
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
          updated_at
        `
        )
        .single();

      if (error) throw error;

      setPropiedades((prev) =>
        prev.map((p) =>
          p.id === selectedPropiedad.id
            ? {
                ...(updated as TrackerPropiedad),
                contacto: selectedPropiedad.contacto ?? null,
              }
            : p
        )
      );

      setSelectedPropiedad((prev) =>
        prev
          ? ({
              ...(updated as TrackerPropiedad),
              contacto: prev.contacto ?? null,
            } as TrackerPropiedad)
          : prev
      );
    } catch (err) {
      console.error("Error guardando cierre de operación:", err);
      alert("No se pudo guardar el cierre de la operación");
    } finally {
      setPropDetalleSaving(false);
    }
  };

  const handleDeleteContacto = async (id: string) => {
    if (!window.confirm("¿Eliminar este contacto y su historial?")) return;
    try {
      const { error } = await supabase
        .from("tracker_contactos")
        .delete()
        .eq("id", id);
      if (error) throw error;

      setContactos((prev) => prev.filter((c) => c.id !== id));
      setActividades((prev) =>
        prev.filter((a) => a.contacto_id !== id)
      );
      setPropiedades((prev) =>
        prev.filter((p) => p.contacto_id !== id)
      );
    } catch (err) {
      console.error("Error eliminando contacto:", err);
      alert("No se pudo eliminar el contacto");
    }
  };

  const handleDeletePropiedad = async (id: string) => {
    if (!window.confirm("¿Eliminar esta propiedad y su historial de precios?"))
      return;
    try {
      const { error } = await supabase
        .from("tracker_propiedades")
        .delete()
        .eq("id", id);
      if (error) throw error;

      setPropiedades((prev) => prev.filter((p) => p.id !== id));
      if (selectedPropiedad?.id === id) {
        setShowPropiedadDetalleModal(false);
        setSelectedPropiedad(null);
      }
    } catch (err) {
      console.error("Error eliminando propiedad:", err);
      alert("No se pudo eliminar la propiedad");
    }
  };

  // Calendario
  const buildMonthDays = () => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();

    const firstDay = new Date(year, month, 1);
    const firstWeekDay = firstDay.getDay(); // 0-domingo

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Date[] = [];
    const prevDays = (firstWeekDay + 6) % 7;

    for (let i = prevDays; i > 0; i--) {
      cells.push(new Date(year, month, 1 - i));
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(year, month, d));
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1];
      cells.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
    }
    return cells;
  };

  const calendarDays = buildMonthDays();

  const contactosConPropiedad = useMemo(() => {
    const setIds = new Set(propiedades.map((p) => p.contacto_id));
    return contactos.map((c) => ({
      ...c,
      tienePropiedad: setIds.has(c.id),
    }));
  }, [contactos, propiedades]);

  const loadingState = loading && (
    <div className="flex h-[60vh] items-center justify-center text-sm text-neutral-400">
      Cargando tracker de trabajo…
    </div>
  );

  if (!empresaId) {
    return (
      <div className="p-6 text-sm text-neutral-300">
        No se encontró una empresa asociada al usuario actual.
      </div>
    );
  }

  if (loading) {
    return loadingState;
  }

  const actividadesHoy = actividades.filter((a) => {
    if (!a.fecha_programada) return false;
    const d = new Date(a.fecha_programada);
    return isSameDay(d, startOfDay(new Date()));
  });

  const actividadesManiana = actividades.filter((a) => {
    if (!a.fecha_programada) return false;
    const d = new Date(a.fecha_programada);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return isSameDay(d, startOfDay(tomorrow));
  });

  return (
    <div className="space-y-6 p-6 text-neutral-50">
      {/* HEADER TRACKER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-50">
            Tracker de trabajo
          </h1>
          <p className="mt-1 max-w-lg text-xs text-neutral-300">
            Registrá tu prospección diaria, seguimiento, prelisting, VAI /
            factibilidad, captaciones y cierres. Pensado para que veas tu
            avance medible, todos los días.
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-2 md:flex-row md:justify-end">
          {/* Hoy */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 px-4 py-3 text-xs">
            <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Hoy
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-50">
              {new Date().toLocaleDateString("es-AR", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
              })}
            </p>
            <p className="mt-1 text-[11px] text-neutral-300">
              {actividadesHoy.length > 0
                ? `${actividadesHoy.length} actividad(es) programadas`
                : "Sin actividades registradas para hoy"}
            </p>
          </div>

          {/* Mañana */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 px-4 py-3 text-xs">
            <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Mañana
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-50">
              {(() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                return d.toLocaleDateString("es-AR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                });
              })()}
            </p>
            <p className="mt-1 text-[11px] text-neutral-300">
              {actividadesManiana.length > 0
                ? `${actividadesManiana.length} actividad(es) programadas`
                : "Sin actividades registradas para mañana"}
            </p>
          </div>
        </div>
      </div>

      {/* KPIs PRINCIPALES */}
      <section className="space-y-3 rounded-3xl border border-neutral-800 bg-neutral-950/80 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.9)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              Visión rápida
            </p>
            <p className="text-sm text-neutral-300">
              Panorama de tu pipeline en el rango seleccionado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(Object.keys(RANGO_LABEL) as RangoKPI[]).map((rk) => (
              <button
                key={rk}
                type="button"
                onClick={() => setRangoKPIs(rk)}
                className={classNames(
                  "rounded-full px-3 py-1.5 text-[11px]",
                  rangoKPIs === rk
                    ? "bg-[rgba(230,169,48,0.95)] text-black font-semibold"
                    : "border border-neutral-700 text-neutral-300 hover:bg-neutral-900"
                )}
              >
                {RANGO_LABEL[rk]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <KpiCard
            title="Prospectos"
            value={prospectos}
            subtitle={RANGO_LABEL[rangoKPIs]}
          />
          <KpiCard
            title="Prelisting"
            value={prelisting}
            subtitle="Propiedades en análisis previo"
          />
          <KpiCard
            title="Captaciones"
            value={captaciones}
            subtitle="Propiedades ya tomadas"
          />
          <KpiCard
            title="Cierres"
            value={cierres}
            subtitle={RANGO_LABEL[rangoKPIs]}
          />
        </div>
      </section>

      {/* NAV SECCIONES */}
      <section className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setActiveSection("calendario")}
          className={classNames(
            "rounded-full px-4 py-2 text-xs font-medium",
            activeSection === "calendario"
              ? "bg-[rgba(230,169,48,0.95)] text-black"
              : "border border-neutral-700 text-neutral-200 hover:bg-neutral-900"
          )}
        >
          Calendario
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("contactos")}
          className={classNames(
            "rounded-full px-4 py-2 text-xs font-medium",
            activeSection === "contactos"
              ? "bg-[rgba(230,169,48,0.95)] text-black"
              : "border border-neutral-700 text-neutral-200 hover:bg-neutral-900"
          )}
        >
          Contactos / Captaciones
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("propiedades")}
          className={classNames(
            "rounded-full px-4 py-2 text-xs font-medium",
            activeSection === "propiedades"
              ? "bg-[rgba(230,169,48,0.95)] text-black"
              : "border border-neutral-700 text-neutral-200 hover:bg-neutral-900"
          )}
        >
          Propiedades captadas
        </button>
      </section>

      {/* SECCIÓN PRINCIPAL: contenido según pestaña */}
      {activeSection === "calendario" && (
        <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          {/* Calendario mensual */}
          <div className="rounded-3xl border border-neutral-800 bg-neutral-950/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                  Calendario
                </p>
                <p className="text-sm text-neutral-200">
                  {monthCursor.toLocaleDateString("es-AR", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setMonthCursor((d) => addMonths(d, -1))
                  }
                  className="rounded-full border border-neutral-700 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-900"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMonthCursor(startOfMonth(new Date()))
                  }
                  className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-900"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => setMonthCursor((d) => addMonths(d, 1))}
                  className="rounded-full border border-neutral-700 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-900"
                >
                  →
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-neutral-400">
              <div>Lun</div>
              <div>Mar</div>
              <div>Mié</div>
              <div>Jue</div>
              <div>Vie</div>
              <div>Sáb</div>
              <div>Dom</div>
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1 text-xs">
              {calendarDays.map((day) => {
                const hasActivities = actividades.some((a) => {
                  if (!a.fecha_programada) return false;
                  const d = new Date(a.fecha_programada);
                  return isSameDay(d, day);
                });
                const isCurrentMonth =
                  day.getMonth() === monthCursor.getMonth();
                const isToday = isSameDay(day, startOfDay(new Date()));
                const isSelected = isSameDay(day, selectedDate);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(startOfDay(day))}
                    className={classNames(
                      "flex h-9 flex-col items-center justify-center rounded-lg border text-[11px]",
                      isSelected
                        ? "border-[rgba(230,169,48,0.9)] bg-[rgba(230,169,48,0.1)] text-neutral-50"
                        : isToday
                        ? "border-neutral-600 bg-neutral-900 text-neutral-50"
                        : "border-neutral-800 bg-neutral-950 text-neutral-300",
                      !isCurrentMonth && "opacity-40"
                    )}
                  >
                    <span>{day.getDate()}</span>
                    {hasActivities && (
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-[rgba(230,169,48,0.9)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel de actividades del día */}
          <div className="rounded-3xl border border-neutral-800 bg-neutral-950/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                  Actividades del día
                </p>
                <p className="text-sm text-neutral-100">
                  {selectedDate.toLocaleDateString("es-AR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNuevaActividadModal(true)}
                className="inline-flex items-center rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-100 hover:bg-neutral-900"
              >
                + Agregar tarea
              </button>
            </div>

            {actividadesDelDia.length === 0 ? (
              <p className="mt-4 text-xs text-neutral-400">
                No hay actividades registradas en esta fecha.
              </p>
            ) : (
              <ul className="mt-2 space-y-2 text-xs">
                {actividadesDelDia.map((a) => {
                  const d = a.fecha_programada
                    ? new Date(a.fecha_programada)
                    : null;
                  const tipo = a.tipo ?? "Actividad";
                  const hora = d
                    ? d.toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";

                  const contacto = contactos.find(
                    (c) => c.id === a.contacto_id
                  );

                  return (
                    <li
                      key={a.id}
                      className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold text-neutral-50">
                            {resolveEtapaActividad(tipo)}
                          </p>
                          <p className="text-[11px] text-neutral-300">
                            {tipo}
                            {hora ? ` · ${hora} hs` : ""}
                          </p>
                        </div>
                        {contacto && (
                          <button
                            type="button"
                            onClick={() => setSelectedContacto(contacto)}
                            className="rounded-full border border-neutral-700 px-2 py-1 text-[10px] text-neutral-200 hover:bg-neutral-900"
                          >
                            Ver contacto
                          </button>
                        )}
                      </div>
                      {a.notas && (
                        <p className="mt-1 text-[11px] text-neutral-400">
                          {a.notas}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      {activeSection === "contactos" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-neutral-100">
                Contactos / Captaciones
              </p>
              <p className="text-xs text-neutral-400">
                Gestioná prospectos, estados y la evolución de cada oportunidad.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNuevoContacto(true)}
              className="rounded-full border border-[rgba(230,169,48,0.9)] bg-[rgba(230,169,48,0.95)] px-4 py-1.5 text-xs font-semibold text-black hover:bg-[rgba(230,169,48,1)]"
            >
              + Nuevo prospecto / cliente
            </button>
          </div>

          <div className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950/80">
            <table className="min-w-full text-left text-xs text-neutral-200">
              <thead className="bg-neutral-950/90 text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Contacto</th>
                  <th className="px-3 py-2">Teléfono</th>
                  <th className="px-3 py-2">Tipología</th>
                  <th className="px-3 py-2">Operación</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Propiedad</th>
                  <th className="px-3 py-2">Creado</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {contactosConPropiedad.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-4 text-center text-xs text-neutral-400"
                    >
                      Todavía no cargaste contactos en el tracker.
                    </td>
                  </tr>
                ) : (
                  contactosConPropiedad.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t border-neutral-800/80 hover:bg-neutral-900/60"
                    >
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-neutral-50">
                            {c.nombre} {c.apellido ?? ""}
                          </span>
                          {c.email && (
                            <span className="text-[11px] text-neutral-400">
                              {c.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-neutral-300">
                        {c.telefono ?? "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-neutral-300">
                        {c.tipologia ?? "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-neutral-300">
                        {c.tipo_operacion ?? "—"}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select
                          value={normalizarEstado(c.estado_pipeline)}
                          onChange={(e) =>
                            handleChangeEstadoContacto(
                              c.id,
                              e.target.value as EstadoPipeline
                            )
                          }
                          className="rounded-full border border-neutral-700 bg-neutral-900/80 px-2 py-1 text-[11px]"
                        >
                          {ESTADOS_PIPELINE_OPCIONES.map((estado) => (
                            <option key={estado} value={estado}>
                              {ESTADOS_PIPELINE_LABEL[estado]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 align-top text-xs">
                        {c.tienePropiedad ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] text-emerald-200">
                            Propiedad captada
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-neutral-900/80 px-2 py-0.5 text-[10px] text-neutral-400">
                            Sin propiedad aún
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-neutral-400">
                        {fmtDate(c.created_at)}
                      </td>
                      <td className="px-3 py-2 align-top text-right text-xs">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedContacto(c)}
                            className="rounded-full border border-neutral-700 px-2 py-1 text-[11px] text-neutral-100 hover:bg-neutral-900"
                          >
                            Ver / Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteContacto(c.id)}
                            className="rounded-full border border-red-900 px-2 py-1 text-[11px] text-red-200 hover:bg-red-950/80"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSection === "propiedades" && (
        <section className="space-y-3">
          <div>
            <p className="text-sm font-medium text-neutral-100">
              Propiedades captadas
            </p>
            <p className="text-xs text-neutral-400">
              Vista resumida de las propiedades en cartera: precios, días en
              mercado y estado de cierre.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950/80">
            <table className="min-w-full text-left text-xs text-neutral-200">
              <thead className="bg-neutral-950/90 text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Propietario</th>
                  <th className="px-3 py-2">Tipología</th>
                  <th className="px-3 py-2">Operación</th>
                  <th className="px-3 py-2">Zona / Dirección</th>
                  <th className="px-3 py-2">Precio actual</th>
                  <th className="px-3 py-2">Días en mercado</th>
                  <th className="px-3 py-2">Cierre</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {propiedadesConContacto.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-4 text-center text-xs text-neutral-400"
                    >
                      Todavía no tenés propiedades captadas registradas.
                    </td>
                  </tr>
                ) : (
                  propiedadesConContacto.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-neutral-800/80 hover:bg-neutral-900/60"
                    >
                      <td className="px-3 py-2 align-top text-xs text-neutral-100">
                        {p.contactoNombre || "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-neutral-300">
                        {p.tipologia ?? "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-neutral-300">
                        {p.tipo_operacion ?? "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-neutral-300">
                        {p.zona ?? p.direccion ?? "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-neutral-100">
                        {fmtCurrency(p.precio_actual ?? p.precio_lista_inicial)}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-neutral-300">
                        {diffDays(
                          p.fecha_inicio_comercializacion ??
                            p.created_at,
                          p.fecha_cierre
                        ) ?? "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-neutral-300">
                        {p.fecha_cierre
                          ? `Cerrado · ${fmtDate(p.fecha_cierre)}`
                          : "Abierta"}
                      </td>
                      <td className="px-3 py-2 align-top text-right text-xs">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => abrirDetallePropiedad(p)}
                            className="rounded-full border border-neutral-700 px-2 py-1 text-[11px] text-neutral-100 hover:bg-neutral-900"
                          >
                            Ver / Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePropiedad(p.id)}
                            className="rounded-full border border-red-900 px-2 py-1 text-[11px] text-red-200 hover:bg-red-950/80"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {/* MODAL NUEVO CONTACTO */}
      {showNuevoContacto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-xs text-neutral-100">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Nuevo prospecto / cliente</h2>
              <button
                type="button"
                onClick={() => setShowNuevoContacto(false)}
                className="text-[11px] text-neutral-400 hover:text-neutral-100"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleCrearContacto} className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-[11px] text-neutral-400">
                    Nombre *
                  </label>
                  <input
                    value={ncNombre}
                    onChange={(e) => setNcNombre(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-400">
                    Apellido
                  </label>
                  <input
                    value={ncApellido}
                    onChange={(e) => setNcApellido(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="block text-[11px] text-neutral-400">
                    Teléfono
                  </label>
                  <input
                    value={ncTelefono}
                    onChange={(e) => setNcTelefono(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5 text-xs"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] text-neutral-400">
                    Email
                  </label>
                  <input
                    value={ncEmail}
                    onChange={(e) => setNcEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="block text-[11px] text-neutral-400">
                    Origen
                  </label>
                  <select
                    value={ncOrigen}
                    onChange={(e) =>
                      setNcOrigen(e.target.value as (typeof ORIGENES_CONTACTO)[number])
                    }
                    className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5 text-xs"
                  >
                    {ORIGENES_CONTACTO.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-400">
                    Tipología
                  </label>
                  <select
                    value={ncTipologia}
                    onChange={(e) =>
                      setNcTipologia(e.target.value as (typeof TIPOLOGIAS)[number])
                    }
                    className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5 text-xs"
                  >
                    {TIPOLOGIAS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-400">
                    Operación
                  </label>
                  <select
                    value={ncTipoOperacion}
                    onChange={(e) =>
                      setNcTipoOperacion(
                        e.target.value as (typeof TIPOS_OPERACION)[number]
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5 text-xs"
                  >
                    {TIPOS_OPERACION.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-neutral-400">
                  Dirección
                </label>
                <input
                  value={ncDireccion}
                  onChange={(e) => setNcDireccion(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5 text-xs"
                  placeholder="Ej: Av. Colón 1234, B° Centro"
                />
              </div>

              <div>
                <label className="block text-[11px] text-neutral-400">
                  Link de referencia
                </label>
                <input
                  value={ncLinkReferencia}
                  onChange={(e) => setNcLinkReferencia(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5 text-xs"
                  placeholder="Ej: link al portal donde viste la propiedad"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-[11px] text-neutral-400">
                    Estado del pipeline
                  </label>
                  <select
                    value={ncEstadoPipeline}
                    onChange={(e) =>
                      setNcEstadoPipeline(e.target.value as EstadoPipeline)
                    }
                    className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5 text-xs"
                  >
                    {ESTADOS_PIPELINE_OPCIONES.map((estado) => (
                      <option key={estado} value={estado}>
                        {ESTADOS_PIPELINE_LABEL[estado]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-neutral-400">
                  Notas
                </label>
                <textarea
                  value={ncNotas}
                  onChange={(e) => setNcNotas(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5 text-xs"
                  placeholder="Ej: cómo llegaste al dueño, qué acordaron, objeciones, etc."
                />
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNuevoContacto(false)}
                  className="rounded-full border border-neutral-700 px-4 py-1.5 text-[11px] text-neutral-200 hover:bg-neutral-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={ncSaving}
                  className="rounded-full border border-[rgba(230,169,48,0.9)] bg-[rgba(230,169,48,0.95)] px-5 py-1.5 text-[11px] font-semibold text-black hover:bg-[rgba(230,169,48,1)] disabled:opacity-60"
                >
                  {ncSaving ? "Guardando…" : "Guardar contacto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FICHA CONTACTO */}
      {selectedContacto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-xs text-neutral-100">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-neutral-50">
                  {selectedContacto.nombre} {selectedContacto.apellido ?? ""}
                </h2>
                <p className="text-[11px] text-neutral-400">
                  Ficha completa del contacto
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedContacto(null)}
                className="text-[11px] text-neutral-400 hover:text-neutral-100"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
              {/* Datos principales */}
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] text-neutral-400">Teléfono</p>
                    <p className="text-xs text-neutral-100">
                      {selectedContacto.telefono ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400">Email</p>
                    <p className="text-xs text-neutral-100">
                      {selectedContacto.email ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] text-neutral-400">Tipología</p>
                    <p className="text-xs text-neutral-100">
                      {selectedContacto.tipologia ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400">Operación</p>
                    <p className="text-xs text-neutral-100">
                      {selectedContacto.tipo_operacion ?? "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-neutral-400">Dirección</p>
                  <p className="text-xs text-neutral-100">
                    {selectedContacto.direccion ?? "—"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-neutral-400">
                    Link de referencia
                  </p>
                  {selectedContacto.link_referencia ? (
                    <a
                      href={selectedContacto.link_referencia}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[rgba(230,169,48,0.95)] underline"
                    >
                      Abrir enlace
                    </a>
                  ) : (
                    <p className="text-xs text-neutral-100">—</p>
                  )}
                </div>

                <div>
                  <p className="text-[10px] text-neutral-400">Notas</p>
                  <p className="whitespace-pre-wrap text-xs text-neutral-100">
                    {selectedContacto.notas ?? "—"}
                  </p>
                </div>

                {selectedContacto.motivo_descartado && (
                  <div className="rounded-lg border border-rose-900 bg-rose-950/60 p-2">
                    <p className="text-[10px] text-rose-200">
                      Motivo de descarte:
                    </p>
                    <p className="text-[11px] text-rose-50">
                      {selectedContacto.motivo_descartado}
                    </p>
                  </div>
                )}

                {/* Mini métricas del contacto */}
                {(() => {
                  const acts =
                    actividadesPorContacto.get(selectedContacto.id) ?? [];
                  const llamadas = acts.filter((a) =>
                    (a.tipo ?? "").toLowerCase().includes("llam")
                  ).length;
                  const muestras = acts.filter(
                    (a) => a.tipo === "Muestra"
                  ).length;
                  const diasEnTracker = selectedContacto.created_at
                    ? diffDays(selectedContacto.created_at, null)
                    : null;

                  return (
                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-2">
                        <p className="text-[10px] text-neutral-400">
                          Llamadas registradas
                        </p>
                        <p className="mt-1 text-sm font-semibold text-neutral-50">
                          {llamadas}
                        </p>
                      </div>
                      <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-2">
                        <p className="text-[10px] text-neutral-400">
                          Muestras
                        </p>
                        <p className="mt-1 text-sm font-semibold text-neutral-50">
                          {muestras}
                        </p>
                      </div>
                      <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-2">
                        <p className="text-[10px] text-neutral-400">
                          Días en el tracker
                        </p>
                        <p className="mt-1 text-sm font-semibold text-neutral-50">
                          {diasEnTracker ?? "—"}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Panel lateral: pipeline y propiedad */}
              <div className="space-y-3">
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                    Estado del pipeline
                  </p>
                  <select
                    value={normalizarEstado(
                      selectedContacto.estado_pipeline
                    )}
                    onChange={(e) =>
                      handleChangeEstadoContacto(
                        selectedContacto.id,
                        e.target.value as EstadoPipeline
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950/80 px-2 py-1.5 text-xs"
                  >
                    {ESTADOS_PIPELINE_OPCIONES.map((estado) => (
                      <option key={estado} value={estado}>
                        {ESTADOS_PIPELINE_LABEL[estado]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                    Propiedad captada
                  </p>
                  {propiedades.find(
                    (p) => p.contacto_id === selectedContacto.id
                  ) ? (
                    <>
                      <p className="mt-1 text-[11px] text-neutral-300">
                        Ya hay una propiedad asociada a este contacto. Podés
                        verla desde la pestaña{" "}
                        <span className="font-semibold">
                          Propiedades captadas
                        </span>
                        .
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-[11px] text-neutral-300">
                        Una vez que el dueño te da la propiedad para trabajar,
                        cargá los datos básicos y el precio de salida al
                        mercado.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowPropiedadModal(true)}
                        className="mt-3 w-full rounded-full border border-[rgba(230,169,48,0.9)] bg-[rgba(230,169,48,0.95)] px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-[rgba(230,169,48,1)]"
                      >
                        Cargar propiedad captada
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA ACTIVIDAD */}
      {showNuevaActividadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-xs text-neutral-100">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-50">
                Nueva actividad
              </h2>
              <button
                type="button"
                onClick={() => setShowNuevaActividadModal(false)}
                className="text-[11px] text-neutral-400 hover:text-neutral-100"
              >
                Cerrar
              </button>
            </div>

            <form
              onSubmit={handleNuevaActividad}
              className="space-y-3 text-xs text-neutral-100"
            >
              <div>
                <label className="block text-[11px] text-neutral-400">
                  Tipo de actividad
                </label>
                <select
                  value={newActTipo}
                  onChange={(e) => setNewActTipo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5"
                >
                  {TIPOS_ACTIVIDAD.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-neutral-400">
                  Contacto / Cliente
                </label>
                <select
                  value={newActContactoId ?? ""}
                  onChange={(e) =>
                    setNewActContactoId(e.target.value || null)
                  }
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5"
                >
                  <option value="">Sin contacto asociado</option>
                  {contactos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.apellido ?? ""} ·{" "}
                      {c.telefono ?? c.email ?? ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-neutral-400">
                  Hora
                </label>
                <input
                  type="time"
                  value={newActHora}
                  onChange={(e) => setNewActHora(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5"
                />
              </div>

              <div>
                <label className="block text-[11px] text-neutral-400">
                  Notas
                </label>
                <textarea
                  value={newActNotas}
                  onChange={(e) => setNewActNotas(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5"
                  placeholder="Ej: 2º llamado, confirmar interés, objeciones, etc."
                />
              </div>

              {newActMsg && (
                <p className="text-[11px] text-emerald-300">{newActMsg}</p>
              )}

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNuevaActividadModal(false)}
                  className="rounded-full border border-neutral-700 px-4 py-1.5 text-[11px] text-neutral-200 hover:bg-neutral-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={newActSaving}
                  className="rounded-full border border-[rgba(230,169,48,0.9)] bg-[rgba(230,169,48,0.95)] px-5 py-1.5 text-[11px] font-semibold text-black hover:bg-[rgba(230,169,48,1)] disabled:opacity-60"
                >
                  {newActSaving ? "Guardando…" : "Guardar actividad"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CARGA PROPIEDAD CAPTADA */}
      {showPropiedadModal && selectedContacto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-xs text-neutral-100">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-neutral-50">
                  Propiedad captada
                </h2>
                <p className="text-[11px] text-neutral-400">
                  {selectedContacto.nombre} {selectedContacto.apellido ?? ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPropiedadModal(false)}
                className="text-[11px] text-neutral-400 hover:text-neutral-100"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleCrearPropiedad} className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-[11px] text-neutral-400">
                    Tipología
                  </label>
                  <select
                    value={propTipologia}
                    onChange={(e) =>
                      setPropTipologia(e.target.value as (typeof TIPOLOGIAS)[number])
                    }
                    className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5"
                  >
                    {TIPOLOGIAS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-400">
                    Operación
                  </label>
                  <select
                    value={propTipoOperacion}
                    onChange={(e) =>
                      setPropTipoOperacion(
                        e.target.value as (typeof TIPOS_OPERACION)[number]
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5"
                  >
                    {TIPOS_OPERACION.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-neutral-400">
                  Dirección
                </label>
                <input
                  value={propDireccion}
                  onChange={(e) => setPropDireccion(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5"
                  placeholder="Ej: Av. Colón 1234, B° Centro"
                />
              </div>

              <div>
                <label className="block text-[11px] text-neutral-400">
                  Zona / referencia
                </label>
                <input
                  value={propZona}
                  onChange={(e) => setPropZona(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5"
                  placeholder="Ej: Zona Nueva Córdoba, Zona Cerro, etc."
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-[11px] text-neutral-400">
                    m² lote (aprox)
                  </label>
                  <input
                    value={propM2Lote}
                    onChange={(e) => setPropM2Lote(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-400">
                    m² cubiertos (aprox)
                  </label>
                  <input
                    value={propM2Cubiertos}
                    onChange={(e) => setPropM2Cubiertos(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
                <div>
                  <label className="block text-[11px] text-neutral-400">
                    Precio de lista inicial *
                  </label>
                  <input
                    value={propPrecioInicial}
                    onChange={(e) => setPropPrecioInicial(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5"
                    placeholder="Ej: 120000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-400">
                    Moneda
                  </label>
                  <select
                    value={propMoneda}
                    onChange={(e) => setPropMoneda(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1.5"
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPropiedadModal(false)}
                  className="rounded-full border border-neutral-700 px-4 py-1.5 text-[11px] text-neutral-200 hover:bg-neutral-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={propSaving}
                  className="rounded-full border border-[rgba(230,169,48,0.9)] bg-[rgba(230,169,48,0.95)] px-5 py-1.5 text-[11px] font-semibold text-black hover:bg-[rgba(230,169,48,1)] disabled:opacity-60"
                >
                  {propSaving ? "Guardando…" : "Guardar propiedad"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLE PROPIEDAD */}
      {showPropiedadDetalleModal && selectedPropiedad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-xs text-neutral-100">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-neutral-50">
                  Detalle de propiedad
                </h2>
                <p className="text-[11px] text-neutral-400">
                  {selectedPropiedad.contacto?.nombre}{" "}
                  {selectedPropiedad.contacto?.apellido}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPropiedadDetalleModal(false)}
                className="text-[11px] text-neutral-400 hover:text-neutral-100"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
              {/* Izquierda: datos y cierre */}
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] text-neutral-400">Tipología</p>
                    <p className="text-xs text-neutral-100">
                      {selectedPropiedad.tipologia ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400">
                      Operación
                    </p>
                    <p className="text-xs text-neutral-100">
                      {selectedPropiedad.tipo_operacion ?? "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-neutral-400">
                    Dirección / zona
                  </p>
                  <p className="text-xs text-neutral-100">
                    {selectedPropiedad.direccion ??
                      selectedPropiedad.zona ??
                      "—"}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] text-neutral-400">
                      m² lote
                    </p>
                    <p className="text-xs text-neutral-100">
                      {selectedPropiedad.m2_lote ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400">
                      m² cubiertos
                    </p>
                    <p className="text-xs text-neutral-100">
                      {selectedPropiedad.m2_cubiertos ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] text-neutral-400">
                      Precio lista inicial
                    </p>
                    <p className="text-xs text-neutral-100">
                      {fmtCurrency(
                        selectedPropiedad.precio_lista_inicial,
                        selectedPropiedad.moneda ?? "ARS"
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400">
                      Precio actual
                    </p>
                    <p className="text-xs text-neutral-100">
                      {fmtCurrency(
                        selectedPropiedad.precio_actual ??
                          selectedPropiedad.precio_lista_inicial,
                        selectedPropiedad.moneda ?? "ARS"
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] text-neutral-400">
                      Inicio comercialización
                    </p>
                    <p className="text-xs text-neutral-100">
                      {fmtDate(
                        selectedPropiedad.fecha_inicio_comercializacion ??
                          selectedPropiedad.created_at
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400">
                      Días en mercado
                    </p>
                    <p className="text-xs text-neutral-100">
                      {diffDays(
                        selectedPropiedad.fecha_inicio_comercializacion ??
                          selectedPropiedad.created_at,
                        selectedPropiedad.fecha_cierre
                      ) ?? "—"}
                    </p>
                  </div>
                </div>

                {/* Cierre de operación */}
                <form
                  onSubmit={handleGuardarCierreOperacion}
                  className="mt-3 space-y-2 rounded-xl border border-emerald-900 bg-emerald-950/40 p-3"
                >
                  <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200">
                    Cierre de operación
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <label className="block text-[11px] text-emerald-100">
                        Precio de cierre
                      </label>
                      <input
                        value={propDetallePrecioCierre}
                        onChange={(e) =>
                          setPropDetallePrecioCierre(e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-emerald-800 bg-emerald-950/60 px-2 py-1.5 text-xs text-emerald-50"
                        placeholder="Ej: 115000"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-emerald-100">
                        Fecha de cierre
                      </label>
                      <input
                        type="date"
                        value={propDetalleFechaCierre}
                        onChange={(e) =>
                          setPropDetalleFechaCierre(e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-emerald-800 bg-emerald-950/60 px-2 py-1.5 text-xs text-emerald-50"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={propDetalleSaving}
                      className="rounded-full border border-emerald-400 bg-emerald-500/90 px-4 py-1.5 text-[11px] font-semibold text-emerald-950 hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {propDetalleSaving
                        ? "Guardando cierre…"
                        : "Guardar cierre"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Derecha: historial de precios */}
              <div className="space-y-3">
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                    Historial de precios
                  </p>

                  {preciosPropiedad.length === 0 ? (
                    <p className="mt-2 text-[11px] text-neutral-400">
                      Aún no registraste cambios de precio.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-[11px] text-neutral-200">
                      {preciosPropiedad.map((h) => (
                        <li
                          key={h.id}
                          className="rounded-lg border border-neutral-800 bg-neutral-950/80 p-2"
                        >
                          <p className="text-neutral-100">
                            {fmtCurrency(
                              h.precio,
                              h.moneda ?? selectedPropiedad.moneda ?? "ARS"
                            )}
                          </p>
                          <p className="text-[10px] text-neutral-400">
                            {fmtDate(h.fecha_cambio)}{" "}
                            {h.motivo ? `· ${h.motivo}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <form
                  onSubmit={handleRegistrarAjustePrecio}
                  className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/70 p-3"
                >
                  <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                    Registrar ajuste de precio
                  </p>
                  <div>
                    <label className="block text-[11px] text-neutral-400">
                      Nuevo precio
                    </label>
                    <input
                      value={newPrecioValor}
                      onChange={(e) => setNewPrecioValor(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-2 py-1.5 text-xs"
                      placeholder="Ej: 115000"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400">
                      Motivo / nota
                    </label>
                    <textarea
                      value={newPrecioMotivo}
                      onChange={(e) => setNewPrecioMotivo(e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-2 py-1.5 text-xs"
                      placeholder="Ej: ajuste por mercado, negociación con cliente, etc."
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={newPrecioSaving}
                      className="rounded-full border border-[rgba(230,169,48,0.9)] bg-[rgba(230,169,48,0.95)] px-4 py-1.5 text-[11px] font-semibold text-black hover:bg-[rgba(230,169,48,1)] disabled:opacity-60"
                    >
                      {newPrecioSaving
                        ? "Registrando…"
                        : "Registrar ajuste"}
                    </button>
                  </div>
                </form>

                <button
                  type="button"
                  onClick={() => handleDeletePropiedad(selectedPropiedad.id)}
                  className="w-full rounded-full border border-red-900 bg-red-950/60 px-4 py-1.5 text-[11px] font-semibold text-red-200 hover:bg-red-900/70"
                >
                  Eliminar propiedad
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
