// app/dashboard/empresa/tracker/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type TrackerTab = "contactos" | "propiedades" | "terceros";
type KpiRange = "30d" | "90d" | "180d" | "365d";
type TrackerScope = "empresa" | "asesores" | "global";
type TipoOperacionFiltro = "todas" | "venta" | "alquiler";

interface TrackerContacto {
  id: string;
  empresa_id: string;
  asesor_id: string | null;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  tipologia: string | null;
  tipo_operacion: string | null;
  origen: string | null;
  zona: string | null;
  direccion: string | null;
  estado: TrackerContactoEstado;
  motivo_descarte: string | null;
  created_at: string;
  updated_at: string;
}

interface TrackerActividad {
  id: string;
  empresa_id: string;
  asesor_id: string | null;
  contacto_id: string | null;
  titulo: string | null;
  tipo: TrackerActividadTipo;
  fecha_programada: string;
  hora: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
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

interface TrackerPropiedadTercero {
  id: string;
  empresa_id: string;
  asesor_id: string | null;
  comprador_nombre: string | null;
  tipologia: string | null;
  tipo_operacion: string | null;
  direccion: string | null;
  zona: string | null;
  precio_cierre: number | null;
  moneda: string | null;
  fecha_cierre: string | null;
  honorarios_pct_comprador: number | null;
  honorarios_pct_vendedor: number | null;
  empresa_share_pct: number | null;
  porcentaje_asesor: number | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

interface Asesor {
  id: string;
  nombre: string | null;
  apellido: string | null;
}

interface FormContactoState {
  asesor_id: string;
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  tipologia: string;
  tipo_operacion: string;
  origen: string;
  zona: string;
  estado: TrackerContactoEstado;
  motivo_descarte: string;
  direccion: string;
}

interface FormPropiedadState {
  asesor_id: string;
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
  cobra_honorarios_vendedor: boolean;
  honorarios_pct_vendedor: string;
  cobra_honorarios_comprador: boolean;
  honorarios_pct_comprador: string;
}

interface FormTerceroState {
  asesor_id: string;
  comprador_nombre: string;
  tipologia: string;
  tipo_operacion: string;
  direccion: string;
  zona: string;
  precio_cierre: string;
  moneda: string;
  fecha_cierre: string;
  cobra_honorarios_vendedor: boolean;
  honorarios_pct_vendedor: string;
  cobra_honorarios_comprador: boolean;
  honorarios_pct_comprador: string;
  empresa_share_pct: string;
  porcentaje_asesor: string;
  notas: string;
}

const TIPOLOGIAS = [
  { value: "casa", label: "Casa" },
  { value: "departamento", label: "Departamento" },
  { value: "duplex", label: "Dúplex" },
  { value: "ph", label: "PH" },
  { value: "oficina", label: "Oficina" },
  { value: "local", label: "Local" },
  { value: "terreno", label: "Terreno" },
  { value: "galpon", label: "Galpón / Depósito" },
  { value: "cochera", label: "Cochera" },
  { value: "campo", label: "Campo" },
  { value: "otro", label: "Otro" },
];

const ESTADOS_CONTACTO: { value: TrackerContactoEstado; label: string }[] = [
  { value: "sin_contactar", label: "Sin contactar" },
  { value: "primer_llamado", label: "1° llamado" },
  { value: "seguimiento", label: "Seguimiento" },
  { value: "prelisting", label: "Prelisting" },
  { value: "vai_factibilidad", label: "VAI / Factibilidad" },
  { value: "captado", label: "Captación" },
  { value: "cierre", label: "Cierre" },
  { value: "descarte", label: "Descartado" },
];

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function dateKeyFromString(value: string | null | undefined): string {
  return value ? value.substring(0, 10) : "";
}

function isValidDateKey(value: string | null | undefined): boolean {
  if (!value) return false;
  const key = value.substring(0, 10);
  if (key === "0001-01-01") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

function parseNumberOrNull(value: string) {
  if (!value || !value.trim()) return null;
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseNumberOrZero(value: string) {
  return parseNumberOrNull(value) ?? 0;
}

function normalizePercentInput(value: string, enabled: boolean) {
  return enabled ? parseNumberOrZero(value) : 0;
}

function isValidClose(
  record: Pick<TrackerPropiedad, "fecha_cierre" | "precio_cierre">
) {
  return (
    isValidDateKey(record.fecha_cierre) &&
    record.precio_cierre != null &&
    record.precio_cierre > 0
  );
}

function isValidTerceroClose(record: TrackerPropiedadTercero) {
  return (
    isValidDateKey(record.fecha_cierre) &&
    record.precio_cierre != null &&
    record.precio_cierre > 0
  );
}

function labelTipoOperacion(tipo: string | null | undefined) {
  if (tipo === "venta") return "Venta";
  if (tipo === "alquiler") return "Alquiler";
  return tipo || "—";
}

function labelTipologia(value: string | null | undefined) {
  const found = TIPOLOGIAS.find((t) => t.value === value);
  return found?.label ?? value ?? "—";
}

export default function EmpresaTrackerPage() {
  const { user } = useAuth();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [contactos, setContactos] = useState<TrackerContacto[]>([]);
  const [actividades, setActividades] = useState<TrackerActividad[]>([]);
  const [propiedades, setPropiedades] = useState<TrackerPropiedad[]>([]);
  const [propiedadesTerceros, setPropiedadesTerceros] = useState<
    TrackerPropiedadTercero[]
  >([]);
  const [asesores, setAsesores] = useState<Asesor[]>([]);

  const [activeTab, setActiveTab] = useState<TrackerTab>("contactos");
  const [kpiRange, setKpiRange] = useState<KpiRange>("30d");
  const [scope, setScope] = useState<TrackerScope>("empresa");
  const [selectedAsesorId, setSelectedAsesorId] = useState<string>("");
  const [tipoOperacionFiltro, setTipoOperacionFiltro] =
    useState<TipoOperacionFiltro>("todas");
  const [tipologiaFiltro, setTipologiaFiltro] = useState<string>("");
  const [estadoFiltro, setEstadoFiltro] = useState<string>("");

  const [showContactoModal, setShowContactoModal] = useState(false);
  const [editingContacto, setEditingContacto] = useState<TrackerContacto | null>(
    null
  );

  const [showPropiedadModal, setShowPropiedadModal] = useState(false);
  const [editingPropiedad, setEditingPropiedad] =
    useState<TrackerPropiedad | null>(null);

  const [showTerceroModal, setShowTerceroModal] = useState(false);
  const [editingTercero, setEditingTercero] =
    useState<TrackerPropiedadTercero | null>(null);

  const [mensaje, setMensaje] = useState<string | null>(null);
  const [savingContacto, setSavingContacto] = useState(false);
  const [savingPropiedad, setSavingPropiedad] = useState(false);
  const [savingTercero, setSavingTercero] = useState(false);

  const defaultAsesorIdForNewRecord = useMemo(() => {
    if (scope === "asesores" && selectedAsesorId) return selectedAsesorId;
    return "";
  }, [scope, selectedAsesorId]);

  const [formContacto, setFormContacto] = useState<FormContactoState>({
    asesor_id: "",
    nombre: "",
    apellido: "",
    telefono: "",
    email: "",
    tipologia: "",
    tipo_operacion: "venta",
    origen: "",
    zona: "",
    estado: "sin_contactar",
    motivo_descarte: "",
    direccion: "",
  });

  const [formPropiedad, setFormPropiedad] = useState<FormPropiedadState>({
    asesor_id: "",
    contacto_id: "",
    tipologia: "",
    dormitorios: "",
    tipo_operacion: "venta",
    direccion: "",
    zona: "",
    m2_lote: "",
    m2_cubiertos: "",
    precio_lista_inicial: "",
    precio_actual: "",
    precio_cierre: "",
    moneda: "USD",
    fecha_inicio_comercializacion: toDateKey(new Date()),
    fecha_cierre: "",
    cobra_honorarios_vendedor: true,
    honorarios_pct_vendedor: "3",
    cobra_honorarios_comprador: false,
    honorarios_pct_comprador: "0",
  });

  const [formTercero, setFormTercero] = useState<FormTerceroState>({
    asesor_id: "",
    comprador_nombre: "",
    tipologia: "",
    tipo_operacion: "venta",
    direccion: "",
    zona: "",
    precio_cierre: "",
    moneda: "USD",
    fecha_cierre: toDateKey(new Date()),
    cobra_honorarios_vendedor: false,
    honorarios_pct_vendedor: "0",
    cobra_honorarios_comprador: true,
    honorarios_pct_comprador: "3",
    empresa_share_pct: "",
    porcentaje_asesor: "",
    notas: "",
  });

  const showMessage = (text: string) => {
    setMensaje(text);
    setTimeout(() => setMensaje(null), 3200);
  };

  const contactoNombreCorto = (
    c: { nombre?: string | null; apellido?: string | null } | null | undefined
  ) => {
    if (!c) return "Sin contacto";
    const nom = [c.nombre, c.apellido].filter(Boolean).join(" ");
    return nom || "Sin nombre";
  };

  const asesorNombre = (asesorId: string | null | undefined) => {
    if (!asesorId) return "Empresa";
    const asesor = asesores.find((a) => a.id === asesorId);
    return asesor ? contactoNombreCorto(asesor) : "Asesor";
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

  const normalizePropiedades = (rows: any[] | null): TrackerPropiedad[] =>
    (rows ?? []).map((row: any) => {
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
      };
    });

  const refetchTrackerData = useCallback(async () => {
    if (!empresaId) return;

    try {
      setLoading(true);

      const [
        contactosRes,
        actividadesRes,
        propiedadesRes,
        tercerosRes,
        asesoresRes,
      ] = await Promise.all([
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
          .order("created_at", { ascending: false }),
        supabase
          .from("tracker_propiedades_terceros")
          .select("*")
          .eq("empresa_id", empresaId)
          .order("fecha_cierre", { ascending: false }),
        supabase
          .from("asesores")
          .select("id, nombre, apellido")
          .eq("empresa_id", empresaId)
          .order("nombre", { ascending: true }),
      ]);

      if (contactosRes.error) {
        console.error("Error cargando contactos tracker:", contactosRes.error);
      }
      if (actividadesRes.error) {
        console.error(
          "Error cargando actividades tracker:",
          actividadesRes.error
        );
      }
      if (propiedadesRes.error) {
        console.error(
          "Error cargando propiedades tracker:",
          propiedadesRes.error
        );
      }
      if (tercerosRes.error) {
        console.error(
          "Error cargando propiedades de terceros:",
          tercerosRes.error
        );
      }
      if (asesoresRes.error) {
        console.error("Error cargando asesores tracker:", asesoresRes.error);
      }

      setContactos((contactosRes.data as TrackerContacto[]) ?? []);
      setActividades((actividadesRes.data as TrackerActividad[]) ?? []);
      setPropiedades(normalizePropiedades(propiedadesRes.data ?? []));
      setPropiedadesTerceros(
        (tercerosRes.data as TrackerPropiedadTercero[]) ?? []
      );
      setAsesores((asesoresRes.data as Asesor[]) ?? []);
    } catch (err) {
      console.error("Error cargando tracker:", err);
      showMessage("❌ No se pudieron actualizar los datos del tracker.");
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

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

  useEffect(() => {
    if (!empresaId) return;
    refetchTrackerData();
  }, [empresaId, refetchTrackerData]);

  const recordMatchesScope = (asesorId: string | null | undefined) => {
    if (scope === "global") return true;
    if (scope === "empresa") return !asesorId;
    if (!selectedAsesorId) return !!asesorId;
    return asesorId === selectedAsesorId;
  };

  const recordMatchesOperacion = (tipo: string | null | undefined) => {
    if (tipoOperacionFiltro === "todas") return true;
    return tipo === tipoOperacionFiltro;
  };

  const contactosFiltradosPorVista = useMemo(() => {
    return contactos.filter((c) => {
      if (!recordMatchesScope(c.asesor_id)) return false;
      if (!recordMatchesOperacion(c.tipo_operacion)) return false;
      if (tipologiaFiltro && c.tipologia !== tipologiaFiltro) return false;
      if (estadoFiltro && c.estado !== estadoFiltro) return false;
      return true;
    });
  }, [
    contactos,
    scope,
    selectedAsesorId,
    tipoOperacionFiltro,
    tipologiaFiltro,
    estadoFiltro,
  ]);

  const propiedadesFiltradas = useMemo(() => {
    return propiedades.filter((p) => {
      if (!recordMatchesScope(p.asesor_id)) return false;
      if (!recordMatchesOperacion(p.tipo_operacion)) return false;
      if (tipologiaFiltro && p.tipologia !== tipologiaFiltro) return false;
      return true;
    });
  }, [
    propiedades,
    scope,
    selectedAsesorId,
    tipoOperacionFiltro,
    tipologiaFiltro,
  ]);

  const tercerosFiltrados = useMemo(() => {
    return propiedadesTerceros.filter((p) => {
      if (!recordMatchesScope(p.asesor_id)) return false;
      if (!recordMatchesOperacion(p.tipo_operacion)) return false;
      if (tipologiaFiltro && p.tipologia !== tipologiaFiltro) return false;
      return true;
    });
  }, [
    propiedadesTerceros,
    scope,
    selectedAsesorId,
    tipoOperacionFiltro,
    tipologiaFiltro,
  ]);

  const startKpiDate = useMemo(() => kpiStartDate(kpiRange), [kpiRange]);

  const kpis = useMemo(() => {
    const startKey = toDateKey(startKpiDate);

    const contactosInRange = contactos
      .filter((c) => recordMatchesScope(c.asesor_id))
      .filter((c) => recordMatchesOperacion(c.tipo_operacion))
      .filter((c) => dateKeyFromString(c.created_at) >= startKey);

    const actividadesInRange = actividades
      .filter((a) => recordMatchesScope(a.asesor_id))
      .filter((a) => dateKeyFromString(a.fecha_programada) >= startKey);

    const propiedadesInRange = propiedades
      .filter((p) => recordMatchesScope(p.asesor_id))
      .filter((p) => recordMatchesOperacion(p.tipo_operacion))
      .filter((p) => {
        const fechaCaptacion =
          dateKeyFromString(p.fecha_inicio_comercializacion) ||
          dateKeyFromString(p.created_at);
        return fechaCaptacion >= startKey;
      });

    const cierresPropiosInRange = propiedades
      .filter((p) => recordMatchesScope(p.asesor_id))
      .filter((p) => recordMatchesOperacion(p.tipo_operacion))
      .filter((p) => isValidClose(p))
      .filter((p) => dateKeyFromString(p.fecha_cierre) >= startKey);

    const tercerosInRange = propiedadesTerceros
      .filter((p) => recordMatchesScope(p.asesor_id))
      .filter((p) => recordMatchesOperacion(p.tipo_operacion))
      .filter((p) => isValidTerceroClose(p))
      .filter((p) => dateKeyFromString(p.fecha_cierre) >= startKey);

    const prelistingIds = new Set<string>();

    contactosInRange.forEach((c) => {
      if (
        ["prelisting", "vai_factibilidad", "captado", "cierre"].includes(
          c.estado
        )
      ) {
        prelistingIds.add(c.id);
      }
    });

    actividadesInRange.forEach((a) => {
      if (a.tipo === "prelisting" && a.contacto_id) {
        prelistingIds.add(a.contacto_id);
      }
    });

    const honorariosPropios = cierresPropiosInRange.reduce((acc, p) => {
      const precio = p.precio_cierre ?? 0;
      const vendedor = p.honorarios_pct_vendedor ?? 0;
      const comprador = p.honorarios_pct_comprador ?? 0;
      return acc + (precio * (vendedor + comprador)) / 100;
    }, 0);

    const honorariosTerceros = tercerosInRange.reduce((acc, p) => {
      const precio = p.precio_cierre ?? 0;
      const vendedor = p.honorarios_pct_vendedor ?? 0;
      const comprador = p.honorarios_pct_comprador ?? 0;
      return acc + (precio * (vendedor + comprador)) / 100;
    }, 0);

    return {
      prospectos: contactosInRange.length,
      prelisting: prelistingIds.size,
      captacionesPropias: propiedadesInRange.length,
      cierresPropios: cierresPropiosInRange.length,
      ventasTerceros: tercerosInRange.length,
      ventasTotales: cierresPropiosInRange.length + tercerosInRange.length,
      honorariosTotal: honorariosPropios + honorariosTerceros,
    };
  }, [
    contactos,
    actividades,
    propiedades,
    propiedadesTerceros,
    startKpiDate,
    scope,
    selectedAsesorId,
    tipoOperacionFiltro,
  ]);

  const openNuevoContacto = () => {
    setEditingContacto(null);
    setFormContacto({
      asesor_id: defaultAsesorIdForNewRecord,
      nombre: "",
      apellido: "",
      telefono: "",
      email: "",
      tipologia: "",
      tipo_operacion:
        tipoOperacionFiltro === "todas" ? "venta" : tipoOperacionFiltro,
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
      asesor_id: c.asesor_id ?? "",
      nombre: c.nombre ?? "",
      apellido: c.apellido ?? "",
      telefono: c.telefono ?? "",
      email: c.email ?? "",
      tipologia: c.tipologia ?? "",
      tipo_operacion: c.tipo_operacion ?? "venta",
      origen: c.origen ?? "",
      zona: c.zona ?? "",
      estado: c.estado,
      motivo_descarte: c.motivo_descarte ?? "",
      direccion: c.direccion ?? "",
    });
    setShowContactoModal(true);
  };

  const guardarContacto = async () => {
    if (!empresaId || savingContacto) return;

    if (!formContacto.nombre.trim() && !formContacto.apellido.trim()) {
      showMessage("⚠️ Cargá al menos nombre o apellido.");
      return;
    }

    setSavingContacto(true);

    const payload = {
      empresa_id: empresaId,
      asesor_id: formContacto.asesor_id || null,
      nombre: formContacto.nombre.trim() || null,
      apellido: formContacto.apellido.trim() || null,
      telefono: formContacto.telefono.trim() || null,
      email: formContacto.email.trim() || null,
      tipologia: formContacto.tipologia || null,
      tipo_operacion: formContacto.tipo_operacion || null,
      origen: formContacto.origen.trim() || null,
      zona: formContacto.zona.trim() || null,
      direccion: formContacto.direccion.trim() || null,
      estado: formContacto.estado,
      motivo_descarte:
        formContacto.estado === "descarte"
          ? formContacto.motivo_descarte.trim() || null
          : null,
    };

    try {
      if (editingContacto) {
        const { error } = await supabase
          .from("tracker_contactos")
          .update({
            ...payload,
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
        const { error } = await supabase.from("tracker_contactos").insert(payload);

        if (error) {
          console.error("Error creando contacto:", error);
          showMessage("❌ No se pudo crear el contacto.");
          return;
        }
      }

      showMessage("✅ Contacto guardado.");
      setShowContactoModal(false);
      await refetchTrackerData();
    } catch (err) {
      console.error("Error guardando contacto:", err);
      showMessage("❌ Error inesperado al guardar contacto.");
    } finally {
      setSavingContacto(false);
    }
  };

  const eliminarContacto = async (id: string) => {
    if (!empresaId) return;
    if (
      !confirm(
        "¿Eliminar este contacto? Si tiene propiedades o actividades vinculadas, Supabase puede bloquear la eliminación."
      )
    ) {
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
      await refetchTrackerData();
    } catch (err) {
      console.error("Error eliminando contacto:", err);
      showMessage("❌ Error inesperado al eliminar.");
    }
  };

  const openNuevaPropiedad = (contactoId?: string) => {
    const contacto = contactoId ? contactoPorId(contactoId) : null;
    const tipoOperacion =
      contacto?.tipo_operacion ??
      (tipoOperacionFiltro === "todas" ? "venta" : tipoOperacionFiltro);
    const moneda = tipoOperacion === "alquiler" ? "ARS" : "USD";

    setEditingPropiedad(null);
    setFormPropiedad({
      asesor_id: contacto?.asesor_id ?? defaultAsesorIdForNewRecord,
      contacto_id: contactoId ?? "",
      tipologia: contacto?.tipologia ?? "",
      dormitorios: "",
      tipo_operacion: tipoOperacion,
      direccion: contacto?.direccion ?? "",
      zona: contacto?.zona ?? "",
      m2_lote: "",
      m2_cubiertos: "",
      precio_lista_inicial: "",
      precio_actual: "",
      precio_cierre: "",
      moneda,
      fecha_inicio_comercializacion: toDateKey(new Date()),
      fecha_cierre: "",
      cobra_honorarios_vendedor: true,
      honorarios_pct_vendedor: tipoOperacion === "alquiler" ? "0" : "3",
      cobra_honorarios_comprador: false,
      honorarios_pct_comprador: "0",
    });
    setShowPropiedadModal(true);
  };

  const openEditarPropiedad = (p: TrackerPropiedad) => {
    const pctVendedor = p.honorarios_pct_vendedor ?? 0;
    const pctComprador = p.honorarios_pct_comprador ?? 0;

    setEditingPropiedad(p);
    setFormPropiedad({
      asesor_id: p.asesor_id ?? "",
      contacto_id: p.contacto_id ?? "",
      tipologia: p.tipologia ?? "",
      dormitorios: p.dormitorios != null ? String(p.dormitorios) : "",
      tipo_operacion: p.tipo_operacion ?? "venta",
      direccion: p.direccion ?? "",
      zona: p.zona ?? "",
      m2_lote: p.m2_lote != null ? String(p.m2_lote) : "",
      m2_cubiertos: p.m2_cubiertos != null ? String(p.m2_cubiertos) : "",
      precio_lista_inicial:
        p.precio_lista_inicial != null ? String(p.precio_lista_inicial) : "",
      precio_actual: p.precio_actual != null ? String(p.precio_actual) : "",
      precio_cierre: p.precio_cierre != null ? String(p.precio_cierre) : "",
      moneda: p.moneda ?? "USD",
      fecha_inicio_comercializacion:
        dateKeyFromString(p.fecha_inicio_comercializacion) || toDateKey(new Date()),
      fecha_cierre:
        isValidDateKey(p.fecha_cierre) ? dateKeyFromString(p.fecha_cierre) : "",
      cobra_honorarios_vendedor: pctVendedor > 0,
      honorarios_pct_vendedor: String(pctVendedor),
      cobra_honorarios_comprador: pctComprador > 0,
      honorarios_pct_comprador: String(pctComprador),
    });
    setShowPropiedadModal(true);
  };

  const honorariosEstimados = useMemo(() => {
    const precioCierre = parseNumberOrNull(formPropiedad.precio_cierre);
    if (precioCierre == null) {
      return {
        vendedor: null as number | null,
        comprador: null as number | null,
        total: null as number | null,
      };
    }

    const pctVendedor = normalizePercentInput(
      formPropiedad.honorarios_pct_vendedor,
      formPropiedad.cobra_honorarios_vendedor
    );
    const pctComprador = normalizePercentInput(
      formPropiedad.honorarios_pct_comprador,
      formPropiedad.cobra_honorarios_comprador
    );

    const vendedor = (precioCierre * pctVendedor) / 100;
    const comprador = (precioCierre * pctComprador) / 100;
    const totalRaw = vendedor + comprador;

    return {
      vendedor: vendedor > 0 ? vendedor : null,
      comprador: comprador > 0 ? comprador : null,
      total: totalRaw > 0 ? totalRaw : null,
    };
  }, [
    formPropiedad.precio_cierre,
    formPropiedad.honorarios_pct_vendedor,
    formPropiedad.honorarios_pct_comprador,
    formPropiedad.cobra_honorarios_vendedor,
    formPropiedad.cobra_honorarios_comprador,
  ]);

  const honorariosTerceroEstimados = useMemo(() => {
    const precioCierre = parseNumberOrNull(formTercero.precio_cierre);
    if (precioCierre == null) {
      return {
        vendedor: null as number | null,
        comprador: null as number | null,
        total: null as number | null,
      };
    }

    const pctVendedor = normalizePercentInput(
      formTercero.honorarios_pct_vendedor,
      formTercero.cobra_honorarios_vendedor
    );
    const pctComprador = normalizePercentInput(
      formTercero.honorarios_pct_comprador,
      formTercero.cobra_honorarios_comprador
    );

    const vendedor = (precioCierre * pctVendedor) / 100;
    const comprador = (precioCierre * pctComprador) / 100;
    const totalRaw = vendedor + comprador;

    return {
      vendedor: vendedor > 0 ? vendedor : null,
      comprador: comprador > 0 ? comprador : null,
      total: totalRaw > 0 ? totalRaw : null,
    };
  }, [
    formTercero.precio_cierre,
    formTercero.honorarios_pct_vendedor,
    formTercero.honorarios_pct_comprador,
    formTercero.cobra_honorarios_vendedor,
    formTercero.cobra_honorarios_comprador,
  ]);

  const ensureContactoForPropiedad = async () => {
    if (formPropiedad.contacto_id) return formPropiedad.contacto_id;

    const nombreBase =
      formPropiedad.direccion.trim() ||
      formPropiedad.zona.trim() ||
      "Registro operativo";

    const { data, error } = await supabase
      .from("tracker_contactos")
      .insert({
        empresa_id: empresaId,
        asesor_id: formPropiedad.asesor_id || null,
        nombre: nombreBase,
        apellido: "",
        tipologia: formPropiedad.tipologia || null,
        tipo_operacion: formPropiedad.tipo_operacion || null,
        zona: formPropiedad.zona.trim() || null,
        direccion: formPropiedad.direccion.trim() || null,
        estado: isValidDateKey(formPropiedad.fecha_cierre)
          ? "cierre"
          : "captado",
        origen: "tracker",
      })
      .select("id")
      .single();

    if (error) throw error;
    return data.id as string;
  };

  const validateHonorarios = (vendedor: number, comprador: number) => {
    if (vendedor < 0 || comprador < 0) {
      showMessage("⚠️ Los porcentajes de honorarios no pueden ser negativos.");
      return false;
    }

    if (vendedor > 100 || comprador > 100) {
      showMessage("⚠️ Revisá los honorarios: no pueden superar el 100%.");
      return false;
    }

    if (
      (vendedor > 20 || comprador > 20) &&
      !confirm(
        "El porcentaje de honorarios parece alto. ¿Querés guardarlo igual?"
      )
    ) {
      return false;
    }

    return true;
  };

  const guardarPropiedad = async () => {
    if (!empresaId || savingPropiedad) return;

    const precioLista = parseNumberOrNull(formPropiedad.precio_lista_inicial);
    const precioCierre = parseNumberOrNull(formPropiedad.precio_cierre);
    const vendedorPct = normalizePercentInput(
      formPropiedad.honorarios_pct_vendedor,
      formPropiedad.cobra_honorarios_vendedor
    );
    const compradorPct = normalizePercentInput(
      formPropiedad.honorarios_pct_comprador,
      formPropiedad.cobra_honorarios_comprador
    );

    if (!formPropiedad.tipologia) {
      showMessage("⚠️ Seleccioná una tipología.");
      return;
    }

    if (!formPropiedad.tipo_operacion) {
      showMessage("⚠️ Seleccioná el tipo de operación.");
      return;
    }

    if (precioLista == null || precioLista <= 0) {
      showMessage("⚠️ Cargá un precio inicial válido.");
      return;
    }

    if (!formPropiedad.fecha_inicio_comercializacion) {
      showMessage("⚠️ Cargá la fecha de inicio de comercialización.");
      return;
    }

    if (precioCierre != null && precioCierre > 0 && !formPropiedad.fecha_cierre) {
      showMessage("⚠️ Si cargás precio de cierre, también debés cargar fecha de cierre.");
      return;
    }

    if (formPropiedad.fecha_cierre && (precioCierre == null || precioCierre <= 0)) {
      showMessage("⚠️ Si cargás fecha de cierre, también debés cargar precio de cierre.");
      return;
    }

    if (!validateHonorarios(vendedorPct, compradorPct)) return;

    setSavingPropiedad(true);

    try {
      const contactoId = await ensureContactoForPropiedad();

      const payload = {
        empresa_id: empresaId,
        asesor_id: formPropiedad.asesor_id || null,
        contacto_id: contactoId,
        tipologia: formPropiedad.tipologia,
        dormitorios: parseNumberOrNull(formPropiedad.dormitorios),
        tipo_operacion: formPropiedad.tipo_operacion,
        direccion: formPropiedad.direccion.trim() || null,
        zona: formPropiedad.zona.trim() || null,
        m2_lote: parseNumberOrNull(formPropiedad.m2_lote),
        m2_cubiertos: parseNumberOrNull(formPropiedad.m2_cubiertos),
        precio_lista_inicial: precioLista,
        precio_actual:
          parseNumberOrNull(formPropiedad.precio_actual) ?? precioLista,
        precio_cierre: precioCierre,
        moneda: formPropiedad.moneda || "USD",
        fecha_inicio_comercializacion:
          formPropiedad.fecha_inicio_comercializacion,
        fecha_cierre: formPropiedad.fecha_cierre || null,
        honorarios_pct_vendedor: vendedorPct,
        honorarios_pct_comprador: compradorPct,
      };

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
      await refetchTrackerData();
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
      await refetchTrackerData();
    } catch (err) {
      console.error("Error eliminando propiedad:", err);
      showMessage("❌ Error inesperado al eliminar propiedad.");
    }
  };

  const openNuevoTercero = () => {
    const tipoOperacion =
      tipoOperacionFiltro === "todas" ? "venta" : tipoOperacionFiltro;
    setEditingTercero(null);
    setFormTercero({
      asesor_id: defaultAsesorIdForNewRecord,
      comprador_nombre: "",
      tipologia: "",
      tipo_operacion: tipoOperacion,
      direccion: "",
      zona: "",
      precio_cierre: "",
      moneda: tipoOperacion === "alquiler" ? "ARS" : "USD",
      fecha_cierre: toDateKey(new Date()),
      cobra_honorarios_vendedor: false,
      honorarios_pct_vendedor: "0",
      cobra_honorarios_comprador: true,
      honorarios_pct_comprador: tipoOperacion === "alquiler" ? "5" : "3",
      empresa_share_pct: "",
      porcentaje_asesor: "",
      notas: "",
    });
    setShowTerceroModal(true);
  };

  const openEditarTercero = (p: TrackerPropiedadTercero) => {
    const pctVendedor = p.honorarios_pct_vendedor ?? 0;
    const pctComprador = p.honorarios_pct_comprador ?? 0;

    setEditingTercero(p);
    setFormTercero({
      asesor_id: p.asesor_id ?? "",
      comprador_nombre: p.comprador_nombre ?? "",
      tipologia: p.tipologia ?? "",
      tipo_operacion: p.tipo_operacion ?? "venta",
      direccion: p.direccion ?? "",
      zona: p.zona ?? "",
      precio_cierre: p.precio_cierre != null ? String(p.precio_cierre) : "",
      moneda: p.moneda ?? "USD",
      fecha_cierre:
        isValidDateKey(p.fecha_cierre) ? dateKeyFromString(p.fecha_cierre) : "",
      cobra_honorarios_vendedor: pctVendedor > 0,
      honorarios_pct_vendedor: String(pctVendedor),
      cobra_honorarios_comprador: pctComprador > 0,
      honorarios_pct_comprador: String(pctComprador),
      empresa_share_pct:
        p.empresa_share_pct != null ? String(p.empresa_share_pct) : "",
      porcentaje_asesor:
        p.porcentaje_asesor != null ? String(p.porcentaje_asesor) : "",
      notas: p.notas ?? "",
    });
    setShowTerceroModal(true);
  };

  const guardarTercero = async () => {
    if (!empresaId || savingTercero) return;

    const precioCierre = parseNumberOrNull(formTercero.precio_cierre);
    const vendedorPct = normalizePercentInput(
      formTercero.honorarios_pct_vendedor,
      formTercero.cobra_honorarios_vendedor
    );
    const compradorPct = normalizePercentInput(
      formTercero.honorarios_pct_comprador,
      formTercero.cobra_honorarios_comprador
    );

    if (!formTercero.tipologia) {
      showMessage("⚠️ Seleccioná una tipología.");
      return;
    }

    if (!formTercero.tipo_operacion) {
      showMessage("⚠️ Seleccioná el tipo de operación.");
      return;
    }

    if (precioCierre == null || precioCierre <= 0) {
      showMessage("⚠️ Cargá un precio de cierre válido.");
      return;
    }

    if (!formTercero.fecha_cierre) {
      showMessage("⚠️ Cargá la fecha de cierre.");
      return;
    }

    if (!validateHonorarios(vendedorPct, compradorPct)) return;

    setSavingTercero(true);

    const payload = {
      empresa_id: empresaId,
      asesor_id: formTercero.asesor_id || null,
      comprador_nombre: formTercero.comprador_nombre.trim() || null,
      tipologia: formTercero.tipologia,
      tipo_operacion: formTercero.tipo_operacion,
      direccion: formTercero.direccion.trim() || null,
      zona: formTercero.zona.trim() || null,
      precio_cierre: precioCierre,
      moneda: formTercero.moneda || "USD",
      fecha_cierre: formTercero.fecha_cierre,
      honorarios_pct_vendedor: vendedorPct,
      honorarios_pct_comprador: compradorPct,
      empresa_share_pct: parseNumberOrNull(formTercero.empresa_share_pct),
      porcentaje_asesor: parseNumberOrNull(formTercero.porcentaje_asesor),
      notas: formTercero.notas.trim() || null,
    };

    try {
      if (editingTercero) {
        const { error } = await supabase
          .from("tracker_propiedades_terceros")
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingTercero.id)
          .eq("empresa_id", empresaId);

        if (error) {
          console.error("Error actualizando propiedad de tercero:", error);
          showMessage("❌ No se pudo actualizar la venta de tercero.");
          return;
        }
      } else {
        const { error } = await supabase
          .from("tracker_propiedades_terceros")
          .insert(payload);

        if (error) {
          console.error("Error creando propiedad de tercero:", error);
          showMessage("❌ No se pudo crear la venta de tercero.");
          return;
        }
      }

      showMessage("✅ Venta de tercero guardada.");
      setShowTerceroModal(false);
      await refetchTrackerData();
    } catch (err) {
      console.error("Error guardando venta de tercero:", err);
      showMessage("❌ Error inesperado al guardar venta de tercero.");
    } finally {
      setSavingTercero(false);
    }
  };

  const eliminarTercero = async (id: string) => {
    if (!empresaId) return;
    if (!confirm("¿Eliminar esta venta de tercero?")) return;

    try {
      const { error } = await supabase
        .from("tracker_propiedades_terceros")
        .delete()
        .eq("id", id)
        .eq("empresa_id", empresaId);

      if (error) {
        console.error("Error eliminando venta de tercero:", error);
        showMessage("❌ No se pudo eliminar la venta de tercero.");
        return;
      }

      showMessage("✅ Venta de tercero eliminada.");
      await refetchTrackerData();
    } catch (err) {
      console.error("Error eliminando venta de tercero:", err);
      showMessage("❌ Error inesperado al eliminar venta de tercero.");
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

  const fmtCurrency = (
    n: number | null | undefined,
    currency?: string | null
  ) => {
    if (n == null || Number.isNaN(n)) return "—";

    const safeCurrency = currency === "USD" ? "USD" : "ARS";

    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 0,
    }).format(n);
  };

  const calcularHonorarios = (
    precio: number | null | undefined,
    vendedorPct: number | null | undefined,
    compradorPct: number | null | undefined
  ) => {
    if (precio == null || precio <= 0) return null;
    const totalPct = (vendedorPct ?? 0) + (compradorPct ?? 0);
    if (totalPct <= 0) return null;
    return (precio * totalPct) / 100;
  };

  const renderResponsableSelect = (
    value: string,
    onChange: (value: string) => void
  ) => (
    <div>
      <label className="block text-xs font-medium text-slate-600">
        Responsable
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">Empresa</option>
        {asesores.map((a) => (
          <option key={a.id} value={a.id}>
            {contactoNombreCorto(a)}
          </option>
        ))}
      </select>
    </div>
  );

  const renderTipologiaSelect = (
    value: string,
    onChange: (value: string) => void
  ) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
    >
      <option value="">Seleccionar</option>
      {TIPOLOGIAS.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );

  if (loading && !empresaId) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-500">
        Cargando tracker de trabajo…
      </div>
    );
  }

  if (!loading && (!user || user.role !== "empresa" || !empresaId)) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-500">
        No tenés acceso al tracker de empresa.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl xl:max-w-7xl mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
              Business Tracker
            </h1>
            <p className="mt-1 text-sm md:text-base text-slate-600 max-w-2xl">
              Medí prospección, prelisting, captaciones, cierres propios,
              ventas de terceros, alquileres y honorarios de la inmobiliaria.
            </p>

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

              <div className="flex items-center gap-2">
                <span className="text-slate-500">Operación:</span>
                <select
                  value={tipoOperacionFiltro}
                  onChange={(e) =>
                    setTipoOperacionFiltro(e.target.value as TipoOperacionFiltro)
                  }
                  className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700"
                >
                  <option value="todas">Todas</option>
                  <option value="venta">Venta</option>
                  <option value="alquiler">Alquiler</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 md:items-end">
            <Link
              href="/dashboard/empresa/tracker-analytics"
              className="inline-flex items-center gap-1 rounded-full bg-black text-white px-4 py-2 text-xs font-medium hover:bg-slate-900"
            >
              Business Analytics
            </Link>
            <button
              type="button"
              onClick={refetchTrackerData}
              className="rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-gray-100"
            >
              Actualizar datos
            </button>
          </div>
        </header>

        {mensaje && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            {mensaje}
          </div>
        )}

        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <h2 className="text-sm md:text-base font-semibold text-slate-900">
                Resumen comercial
              </h2>
              <p className="text-xs text-slate-500">
                Los cierres propios se cuentan solo con fecha válida y precio de
                cierre mayor a cero. Las ventas de terceros no suman a
                captaciones.
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

          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Prospectos</p>
              <p className="mt-1 text-2xl md:text-3xl font-semibold text-slate-900">
                {kpis.prospectos}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Contactos nuevos en el período.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Prelisting</p>
              <p className="mt-1 text-2xl md:text-3xl font-semibold text-slate-900">
                {kpis.prelisting}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Contactos que llegaron a prelisting o más.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Captaciones propias</p>
              <p className="mt-1 text-2xl md:text-3xl font-semibold text-slate-900">
                {kpis.captacionesPropias}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Propiedades propias cargadas/captadas.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Cierres propios</p>
              <p className="mt-1 text-2xl md:text-3xl font-semibold text-slate-900">
                {kpis.cierresPropios}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Captaciones propias cerradas.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Ventas totales</p>
              <p className="mt-1 text-2xl md:text-3xl font-semibold text-slate-900">
                {kpis.ventasTotales}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Terceros: {kpis.ventasTerceros} · Hon.:{" "}
                {fmtCurrency(kpis.honorariosTotal, tipoOperacionFiltro === "alquiler" ? "ARS" : "USD")}
              </p>
            </div>
          </div>
        </section>

        <nav className="flex flex-wrap gap-2 text-sm">
          {[
            { id: "contactos", label: "Contactos" },
            { id: "propiedades", label: "Propiedades captadas" },
            { id: "terceros", label: "Propiedades de terceros" },
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
        </nav>

        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">Tipología:</span>
            <select
              className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700"
              value={tipologiaFiltro}
              onChange={(e) => setTipologiaFiltro(e.target.value)}
            >
              <option value="">Todas</option>
              {TIPOLOGIAS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            {activeTab === "contactos" && (
              <>
                <span className="text-slate-500">Estado:</span>
                <select
                  className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700"
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value)}
                >
                  <option value="">Todos</option>
                  {ESTADOS_CONTACTO.map((estado) => (
                    <option key={estado.value} value={estado.value}>
                      {estado.label}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          {activeTab === "contactos" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Contactos
                  </h2>
                  <p className="text-xs text-slate-500">
                    Dato auxiliar para medir prospección y avance del circuito.
                  </p>
                </div>
                <button
                  onClick={openNuevoContacto}
                  className="inline-flex items-center gap-1 rounded-full bg-black text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-900"
                >
                  <span className="text-sm">＋</span>
                  Nuevo contacto
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-[11px] text-slate-500">
                      <th className="px-3 py-2 text-left font-medium">
                        Contacto
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Responsable
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Teléfono
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Tipología
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Operación
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Estado
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
                    {contactosFiltradosPorVista.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-3 py-6 text-center text-xs text-slate-500"
                        >
                          No hay contactos con los filtros seleccionados.
                        </td>
                      </tr>
                    )}

                    {contactosFiltradosPorVista.map((c) => {
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
                              {c.email || c.origen || "Sin email/origen"}
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700">
                            {asesorNombre(c.asesor_id)}
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700">
                            {c.telefono || "—"}
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700">
                            {labelTipologia(c.tipologia)}
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700">
                            {labelTipoOperacion(c.tipo_operacion)}
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
                            {ultAct
                              ? `${dateKeyFromString(
                                  ultAct.fecha_programada
                                ).substring(8, 10)}/${dateKeyFromString(
                                  ultAct.fecha_programada
                                ).substring(5, 7)}`
                              : "—"}
                          </td>
                          <td className="px-3 py-2 align-top text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openEditarContacto(c)}
                                className="text-[11px] text-slate-600 hover:text-black"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => openNuevaPropiedad(c.id)}
                                className="text-[11px] text-[rgba(230,169,48,0.95)] hover:text-[rgba(230,169,48,1)]"
                              >
                                Captar
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
            </div>
          )}

          {activeTab === "propiedades" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Propiedades captadas
                  </h2>
                  <p className="text-xs text-slate-500">
                    Captaciones propias. Sus cierres alimentan el embudo
                    captación → cierre.
                  </p>
                </div>
                <button
                  onClick={() => openNuevaPropiedad()}
                  className="inline-flex items-center gap-1 rounded-full bg-black text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-900"
                >
                  <span className="text-sm">＋</span>
                  Nueva propiedad captada
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-[11px] text-slate-500">
                      <th className="px-3 py-2 text-left font-medium">
                        Cliente
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Responsable
                      </th>
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
                        Cierre
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Honorarios
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {propiedadesFiltradas.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-3 py-6 text-center text-xs text-slate-500"
                        >
                          No hay propiedades captadas con los filtros
                          seleccionados.
                        </td>
                      </tr>
                    )}

                    {propiedadesFiltradas.map((p) => {
                      const contacto =
                        p.contacto_id && contactoPorId(p.contacto_id)
                          ? contactoPorId(p.contacto_id)
                          : p.contacto ?? null;

                      const cerrada = isValidClose(p);
                      const cierreIncompleto =
                        (!!p.fecha_cierre && !cerrada) ||
                        (!!p.precio_cierre && !p.fecha_cierre);
                      const diasVenta = diasEntreFechas(
                        p.fecha_inicio_comercializacion,
                        cerrada ? p.fecha_cierre : null
                      );
                      const honorarios = calcularHonorarios(
                        p.precio_cierre,
                        p.honorarios_pct_vendedor,
                        p.honorarios_pct_comprador
                      );

                      return (
                        <tr
                          key={p.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 ${
                            cerrada
                              ? "bg-emerald-50"
                              : cierreIncompleto
                              ? "bg-amber-50"
                              : ""
                          }`}
                        >
                          <td className="px-3 py-2 align-top">
                            <div className="font-medium text-slate-900">
                              {contacto
                                ? contactoNombreCorto(contacto)
                                : "Sin asignar"}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {diasVenta != null ? `${diasVenta} días` : "—"}
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700">
                            {asesorNombre(p.asesor_id)}
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700">
                            {labelTipologia(p.tipologia)}
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700">
                            {labelTipoOperacion(p.tipo_operacion)}
                          </td>
                          <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                            {p.direccion || "—"}
                            {p.zona ? ` · ${p.zona}` : ""}
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700">
                            {fmtCurrency(
                              p.precio_actual ?? p.precio_lista_inicial,
                              p.moneda
                            )}
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700">
                            {cerrada ? (
                              <div>
                                <div>
                                  {fmtCurrency(p.precio_cierre, p.moneda)}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {dateKeyFromString(p.fecha_cierre)}
                                </div>
                              </div>
                            ) : cierreIncompleto ? (
                              <span className="text-amber-700">
                                Cierre incompleto
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700">
                            {fmtCurrency(honorarios, p.moneda)}
                            <div className="text-[11px] text-slate-500">
                              V {p.honorarios_pct_vendedor ?? 0}% · C{" "}
                              {p.honorarios_pct_comprador ?? 0}%
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openEditarPropiedad(p)}
                                className="text-[11px] text-slate-600 hover:text-black"
                              >
                                Editar
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
            </div>
          )}

          {activeTab === "terceros" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Propiedades de terceros
                  </h2>
                  <p className="text-xs text-slate-500">
                    Ventas o alquileres donde participaste comercialmente sin
                    que la propiedad sea una captación propia.
                  </p>
                </div>
                <button
                  onClick={openNuevoTercero}
                  className="inline-flex items-center gap-1 rounded-full bg-black text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-900"
                >
                  <span className="text-sm">＋</span>
                  Nueva venta de tercero
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-[11px] text-slate-500">
                      <th className="px-3 py-2 text-left font-medium">
                        Comprador / Cliente
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Responsable
                      </th>
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
                        Cierre
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Honorarios
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tercerosFiltrados.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-3 py-6 text-center text-xs text-slate-500"
                        >
                          Todavía no hay propiedades de terceros con los filtros
                          seleccionados.
                        </td>
                      </tr>
                    )}

                    {tercerosFiltrados.map((p) => {
                      const honorarios = calcularHonorarios(
                        p.precio_cierre,
                        p.honorarios_pct_vendedor,
                        p.honorarios_pct_comprador
                      );

                      return (
                        <tr
                          key={p.id}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="px-3 py-2 align-top">
                            <div className="font-medium text-slate-900">
                              {p.comprador_nombre || "Sin comprador"}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Venta de tercero
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700">
                            {asesorNombre(p.asesor_id)}
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700">
                            {labelTipologia(p.tipologia)}
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700">
                            {labelTipoOperacion(p.tipo_operacion)}
                          </td>
                          <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                            {p.direccion || "—"}
                            {p.zona ? ` · ${p.zona}` : ""}
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700">
                            <div>{fmtCurrency(p.precio_cierre, p.moneda)}</div>
                            <div className="text-[11px] text-slate-500">
                              {dateKeyFromString(p.fecha_cierre)}
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700">
                            {fmtCurrency(honorarios, p.moneda)}
                            <div className="text-[11px] text-slate-500">
                              V {p.honorarios_pct_vendedor ?? 0}% · C{" "}
                              {p.honorarios_pct_comprador ?? 0}%
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openEditarTercero(p)}
                                className="text-[11px] text-slate-600 hover:text-black"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => eliminarTercero(p.id)}
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
            </div>
          )}
        </section>

        {showContactoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {editingContacto ? "Editar contacto" : "Nuevo contacto"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Dato auxiliar para prospección y embudo comercial.
                  </p>
                </div>
                <button
                  onClick={() => setShowContactoModal(false)}
                  className="rounded-full border border-gray-300 px-2 py-1 text-xs text-slate-600 hover:bg-gray-100"
                >
                  Cerrar
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {renderResponsableSelect(formContacto.asesor_id, (value) =>
                  setFormContacto((prev) => ({ ...prev, asesor_id: value }))
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Estado
                  </label>
                  <select
                    value={formContacto.estado}
                    onChange={(e) =>
                      setFormContacto((prev) => ({
                        ...prev,
                        estado: e.target.value as TrackerContactoEstado,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {ESTADOS_CONTACTO.map((estado) => (
                      <option key={estado.value} value={estado.value}>
                        {estado.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Nombre
                  </label>
                  <input
                    value={formContacto.nombre}
                    onChange={(e) =>
                      setFormContacto((prev) => ({
                        ...prev,
                        nombre: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Apellido
                  </label>
                  <input
                    value={formContacto.apellido}
                    onChange={(e) =>
                      setFormContacto((prev) => ({
                        ...prev,
                        apellido: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Teléfono
                  </label>
                  <input
                    value={formContacto.telefono}
                    onChange={(e) =>
                      setFormContacto((prev) => ({
                        ...prev,
                        telefono: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Email
                  </label>
                  <input
                    value={formContacto.email}
                    onChange={(e) =>
                      setFormContacto((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Tipo de operación
                  </label>
                  <select
                    value={formContacto.tipo_operacion}
                    onChange={(e) =>
                      setFormContacto((prev) => ({
                        ...prev,
                        tipo_operacion: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="venta">Venta</option>
                    <option value="alquiler">Alquiler</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Tipología
                  </label>
                  {renderTipologiaSelect(formContacto.tipologia, (value) =>
                    setFormContacto((prev) => ({ ...prev, tipologia: value }))
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Zona
                  </label>
                  <input
                    value={formContacto.zona}
                    onChange={(e) =>
                      setFormContacto((prev) => ({
                        ...prev,
                        zona: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Origen
                  </label>
                  <input
                    value={formContacto.origen}
                    onChange={(e) =>
                      setFormContacto((prev) => ({
                        ...prev,
                        origen: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600">
                    Dirección / referencia
                  </label>
                  <input
                    value={formContacto.direccion}
                    onChange={(e) =>
                      setFormContacto((prev) => ({
                        ...prev,
                        direccion: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                {formContacto.estado === "descarte" && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-600">
                      Motivo de descarte
                    </label>
                    <textarea
                      value={formContacto.motivo_descarte}
                      onChange={(e) =>
                        setFormContacto((prev) => ({
                          ...prev,
                          motivo_descarte: e.target.value,
                        }))
                      }
                      className="mt-1 min-h-[80px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setShowContactoModal(false)}
                  className="rounded-full border border-gray-300 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-gray-100"
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

        {showPropiedadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {editingPropiedad
                      ? "Editar propiedad captada"
                      : "Nueva propiedad captada"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Estas propiedades sí impactan en captaciones propias y en la
                    conversión captación → cierre.
                  </p>
                </div>
                <button
                  onClick={() => setShowPropiedadModal(false)}
                  className="rounded-full border border-gray-300 px-2 py-1 text-xs text-slate-600 hover:bg-gray-100"
                >
                  Cerrar
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {renderResponsableSelect(formPropiedad.asesor_id, (value) =>
                  setFormPropiedad((prev) => ({ ...prev, asesor_id: value }))
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Contacto vinculado
                  </label>
                  <select
                    value={formPropiedad.contacto_id}
                    onChange={(e) =>
                      setFormPropiedad((prev) => ({
                        ...prev,
                        contacto_id: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Sin contacto / crear automático</option>
                    {contactos
                      .filter((c) => recordMatchesScope(c.asesor_id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {contactoNombreCorto(c)}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Tipo de operación
                  </label>
                  <select
                    value={formPropiedad.tipo_operacion}
                    onChange={(e) => {
                      const next = e.target.value;
                      setFormPropiedad((prev) => ({
                        ...prev,
                        tipo_operacion: next,
                        moneda: next === "alquiler" ? "ARS" : "USD",
                      }));
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="venta">Venta</option>
                    <option value="alquiler">Alquiler</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Tipología
                  </label>
                  {renderTipologiaSelect(formPropiedad.tipologia, (value) =>
                    setFormPropiedad((prev) => ({ ...prev, tipologia: value }))
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Dormitorios
                  </label>
                  <input
                    type="number"
                    value={formPropiedad.dormitorios}
                    onChange={(e) =>
                      setFormPropiedad((prev) => ({
                        ...prev,
                        dormitorios: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Moneda
                  </label>
                  <select
                    value={formPropiedad.moneda}
                    onChange={(e) =>
                      setFormPropiedad((prev) => ({
                        ...prev,
                        moneda: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600">
                    Dirección
                  </label>
                  <input
                    value={formPropiedad.direccion}
                    onChange={(e) =>
                      setFormPropiedad((prev) => ({
                        ...prev,
                        direccion: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Zona
                  </label>
                  <input
                    value={formPropiedad.zona}
                    onChange={(e) =>
                      setFormPropiedad((prev) => ({
                        ...prev,
                        zona: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    m² lote
                  </label>
                  <input
                    value={formPropiedad.m2_lote}
                    onChange={(e) =>
                      setFormPropiedad((prev) => ({
                        ...prev,
                        m2_lote: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    m² cubiertos
                  </label>
                  <input
                    value={formPropiedad.m2_cubiertos}
                    onChange={(e) =>
                      setFormPropiedad((prev) => ({
                        ...prev,
                        m2_cubiertos: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Fecha inicio comercialización
                  </label>
                  <input
                    type="date"
                    value={formPropiedad.fecha_inicio_comercializacion}
                    onChange={(e) =>
                      setFormPropiedad((prev) => ({
                        ...prev,
                        fecha_inicio_comercializacion: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Precio inicial
                  </label>
                  <input
                    value={formPropiedad.precio_lista_inicial}
                    onChange={(e) =>
                      setFormPropiedad((prev) => ({
                        ...prev,
                        precio_lista_inicial: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Precio actual
                  </label>
                  <input
                    value={formPropiedad.precio_actual}
                    onChange={(e) =>
                      setFormPropiedad((prev) => ({
                        ...prev,
                        precio_actual: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Si queda vacío usa precio inicial"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Precio cierre
                  </label>
                  <input
                    value={formPropiedad.precio_cierre}
                    onChange={(e) =>
                      setFormPropiedad((prev) => ({
                        ...prev,
                        precio_cierre: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Fecha cierre
                  </label>
                  <input
                    type="date"
                    value={formPropiedad.fecha_cierre}
                    onChange={(e) =>
                      setFormPropiedad((prev) => ({
                        ...prev,
                        fecha_cierre: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 md:col-span-3">
                  <p className="text-xs font-semibold text-slate-800">
                    Honorarios
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={formPropiedad.cobra_honorarios_vendedor}
                        onChange={(e) =>
                          setFormPropiedad((prev) => ({
                            ...prev,
                            cobra_honorarios_vendedor: e.target.checked,
                            honorarios_pct_vendedor: e.target.checked
                              ? prev.honorarios_pct_vendedor || "3"
                              : "0",
                          }))
                        }
                      />
                      Cobra honorarios al vendedor
                    </label>

                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={formPropiedad.cobra_honorarios_comprador}
                        onChange={(e) =>
                          setFormPropiedad((prev) => ({
                            ...prev,
                            cobra_honorarios_comprador: e.target.checked,
                            honorarios_pct_comprador: e.target.checked
                              ? prev.honorarios_pct_comprador || "3"
                              : "0",
                          }))
                        }
                      />
                      Cobra honorarios al comprador
                    </label>

                    {formPropiedad.cobra_honorarios_vendedor && (
                      <div>
                        <label className="block text-xs font-medium text-slate-600">
                          % vendedor
                        </label>
                        <input
                          value={formPropiedad.honorarios_pct_vendedor}
                          onChange={(e) =>
                            setFormPropiedad((prev) => ({
                              ...prev,
                              honorarios_pct_vendedor: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                    )}

                    {formPropiedad.cobra_honorarios_comprador && (
                      <div>
                        <label className="block text-xs font-medium text-slate-600">
                          % comprador
                        </label>
                        <input
                          value={formPropiedad.honorarios_pct_comprador}
                          onChange={(e) =>
                            setFormPropiedad((prev) => ({
                              ...prev,
                              honorarios_pct_comprador: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-700">
                    Honorarios estimados:{" "}
                    <span className="font-semibold">
                      {fmtCurrency(honorariosEstimados.total, formPropiedad.moneda)}
                    </span>
                    <span className="ml-2 text-slate-500">
                      Vendedor:{" "}
                      {fmtCurrency(honorariosEstimados.vendedor, formPropiedad.moneda)}
                      {" · "}
                      Comprador:{" "}
                      {fmtCurrency(
                        honorariosEstimados.comprador,
                        formPropiedad.moneda
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setShowPropiedadModal(false)}
                  className="rounded-full border border-gray-300 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-gray-100"
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

        {showTerceroModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {editingTercero
                      ? "Editar propiedad de tercero"
                      : "Nueva propiedad de tercero"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Este registro impacta en ventas y honorarios, pero no en
                    captaciones propias.
                  </p>
                </div>
                <button
                  onClick={() => setShowTerceroModal(false)}
                  className="rounded-full border border-gray-300 px-2 py-1 text-xs text-slate-600 hover:bg-gray-100"
                >
                  Cerrar
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {renderResponsableSelect(formTercero.asesor_id, (value) =>
                  setFormTercero((prev) => ({ ...prev, asesor_id: value }))
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Tipo de operación
                  </label>
                  <select
                    value={formTercero.tipo_operacion}
                    onChange={(e) => {
                      const next = e.target.value;
                      setFormTercero((prev) => ({
                        ...prev,
                        tipo_operacion: next,
                        moneda: next === "alquiler" ? "ARS" : "USD",
                      }));
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="venta">Venta</option>
                    <option value="alquiler">Alquiler</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Moneda
                  </label>
                  <select
                    value={formTercero.moneda}
                    onChange={(e) =>
                      setFormTercero((prev) => ({
                        ...prev,
                        moneda: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Comprador / cliente
                  </label>
                  <input
                    value={formTercero.comprador_nombre}
                    onChange={(e) =>
                      setFormTercero((prev) => ({
                        ...prev,
                        comprador_nombre: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Tipología
                  </label>
                  {renderTipologiaSelect(formTercero.tipologia, (value) =>
                    setFormTercero((prev) => ({ ...prev, tipologia: value }))
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Fecha cierre
                  </label>
                  <input
                    type="date"
                    value={formTercero.fecha_cierre}
                    onChange={(e) =>
                      setFormTercero((prev) => ({
                        ...prev,
                        fecha_cierre: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600">
                    Dirección / propiedad
                  </label>
                  <input
                    value={formTercero.direccion}
                    onChange={(e) =>
                      setFormTercero((prev) => ({
                        ...prev,
                        direccion: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Zona
                  </label>
                  <input
                    value={formTercero.zona}
                    onChange={(e) =>
                      setFormTercero((prev) => ({
                        ...prev,
                        zona: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Precio cierre
                  </label>
                  <input
                    value={formTercero.precio_cierre}
                    onChange={(e) =>
                      setFormTercero((prev) => ({
                        ...prev,
                        precio_cierre: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    % empresa
                  </label>
                  <input
                    value={formTercero.empresa_share_pct}
                    onChange={(e) =>
                      setFormTercero((prev) => ({
                        ...prev,
                        empresa_share_pct: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Opcional"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    % asesor
                  </label>
                  <input
                    value={formTercero.porcentaje_asesor}
                    onChange={(e) =>
                      setFormTercero((prev) => ({
                        ...prev,
                        porcentaje_asesor: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Opcional"
                  />
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 md:col-span-3">
                  <p className="text-xs font-semibold text-slate-800">
                    Honorarios
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={formTercero.cobra_honorarios_vendedor}
                        onChange={(e) =>
                          setFormTercero((prev) => ({
                            ...prev,
                            cobra_honorarios_vendedor: e.target.checked,
                            honorarios_pct_vendedor: e.target.checked
                              ? prev.honorarios_pct_vendedor || "3"
                              : "0",
                          }))
                        }
                      />
                      Cobra honorarios al vendedor
                    </label>

                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={formTercero.cobra_honorarios_comprador}
                        onChange={(e) =>
                          setFormTercero((prev) => ({
                            ...prev,
                            cobra_honorarios_comprador: e.target.checked,
                            honorarios_pct_comprador: e.target.checked
                              ? prev.honorarios_pct_comprador || "3"
                              : "0",
                          }))
                        }
                      />
                      Cobra honorarios al comprador
                    </label>

                    {formTercero.cobra_honorarios_vendedor && (
                      <div>
                        <label className="block text-xs font-medium text-slate-600">
                          % vendedor
                        </label>
                        <input
                          value={formTercero.honorarios_pct_vendedor}
                          onChange={(e) =>
                            setFormTercero((prev) => ({
                              ...prev,
                              honorarios_pct_vendedor: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                    )}

                    {formTercero.cobra_honorarios_comprador && (
                      <div>
                        <label className="block text-xs font-medium text-slate-600">
                          % comprador
                        </label>
                        <input
                          value={formTercero.honorarios_pct_comprador}
                          onChange={(e) =>
                            setFormTercero((prev) => ({
                              ...prev,
                              honorarios_pct_comprador: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-700">
                    Honorarios estimados:{" "}
                    <span className="font-semibold">
                      {fmtCurrency(honorariosTerceroEstimados.total, formTercero.moneda)}
                    </span>
                    <span className="ml-2 text-slate-500">
                      Vendedor:{" "}
                      {fmtCurrency(
                        honorariosTerceroEstimados.vendedor,
                        formTercero.moneda
                      )}
                      {" · "}
                      Comprador:{" "}
                      {fmtCurrency(
                        honorariosTerceroEstimados.comprador,
                        formTercero.moneda
                      )}
                    </span>
                  </div>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-slate-600">
                    Notas
                  </label>
                  <textarea
                    value={formTercero.notas}
                    onChange={(e) =>
                      setFormTercero((prev) => ({
                        ...prev,
                        notas: e.target.value,
                      }))
                    }
                    className="mt-1 min-h-[90px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setShowTerceroModal(false)}
                  className="rounded-full border border-gray-300 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarTercero}
                  disabled={savingTercero}
                  className={`rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-900 ${
                    savingTercero ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  {savingTercero ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
