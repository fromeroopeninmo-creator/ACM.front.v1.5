// frontend/app/dashboard/empresa/tracker/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

type EstadoPipeline =
  | "no_contactado"
  | "contactado"
  | "en_seguimiento"
  | "captado"
  | "descartado";

interface TrackerContacto {
  id: string;
  empresa_id: string;
  asesor_id: string | null;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  tipo_contacto: string | null;
  estado_pipeline: EstadoPipeline | null;
  tipologia_propiedad: string | null;
  tipo_operacion: string | null;
  zona: string | null;
  origen: string | null;
  link_fuente: string | null;
  motivo_descartado: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

interface TrackerActividad {
  id: string;
  empresa_id: string;
  asesor_id: string | null;
  contacto_id: string;
  etapa: string | null;
  tipo: string | null;
  resultado: string | null;
  detalle: string | null;
  proximo_contacto_at: string | null;
  realizado_at: string;
  es_venta_cerrada: boolean;
  monto_operacion: number | null;
  moneda: string | null;
  fecha_cierre: string | null;
  created_at: string;
}

const ESTADOS_PIPELINE: { value: EstadoPipeline; label: string }[] = [
  { value: "no_contactado", label: "No contactado" },
  { value: "contactado", label: "Contactado" },
  { value: "en_seguimiento", label: "En seguimiento" },
  { value: "captado", label: "Captado" },
  { value: "descartado", label: "Descartado" },
];

const TIPOLOGIAS = [
  "Casa",
  "Departamento",
  "Dúplex",
  "PH",
  "Lote",
  "Local comercial",
  "Oficina",
  "Galpón / Depósito",
  "Otro",
];

const TIPOS_OPERACION = [
  "Venta",
  "Alquiler",
  "Alquiler temporal",
  "Permuta / Canje",
  "Otro",
];

const ORIGENES = [
  "Llamado en frío",
  "Portal inmobiliario",
  "Redes sociales",
  "Referido",
  "Cartel / Walk-in",
  "Base propia",
  "Otro",
];

const ETAPAS_ACTIVIDAD = [
  "Prospección",
  "Presentación de servicio",
  "Seguimiento",
  "Visita a propiedad",
  "Cierre",
  "Post-venta",
];

const TIPOS_ACTIVIDAD = [
  "Llamada",
  "WhatsApp",
  "Email",
  "Reunión presencial",
  "Visita a inmueble",
  "Otro",
];

const RESULTADOS_ACTIVIDAD = [
  "Sin respuesta",
  "Contactado",
  "Interesado",
  "No interesado",
  "Pedir que lo vuelva a llamar",
];

function formatDateTime(dt: string | null) {
  if (!dt) return "-";
  try {
    const d = new Date(dt);
    return d.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dt;
  }
}

function formatCurrency(val: number | null | undefined) {
  if (val == null || !isFinite(val)) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(val);
}

export const dynamic = "force-dynamic";

export default function EmpresaTrackerPage() {
  const { user } = useAuth();

  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [loadingEmpresa, setLoadingEmpresa] = useState(true);
  const [loadingData, setLoadingData] = useState(true);

  const [contactos, setContactos] = useState<TrackerContacto[]>([]);
  const [actividadesAgenda, setActividadesAgenda] = useState<TrackerActividad[]>([]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtros pipeline
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoPipeline | "todos">("todos");
  const [searchNombre, setSearchNombre] = useState("");

  // Form nuevo contacto
  const [ncNombre, setNcNombre] = useState("");
  const [ncTelefono, setNcTelefono] = useState("");
  const [ncEmail, setNcEmail] = useState("");
  const [ncTipologia, setNcTipologia] = useState<string>("");
  const [ncTipoOperacion, setNcTipoOperacion] = useState<string>("");
  const [ncZona, setNcZona] = useState("");
  const [ncOrigen, setNcOrigen] = useState<string>("");
  const [ncLinkFuente, setNcLinkFuente] = useState("");
  const [ncEstadoPipeline, setNcEstadoPipeline] = useState<EstadoPipeline>("no_contactado");
  const [ncNotas, setNcNotas] = useState("");
  const [ncSaving, setNcSaving] = useState(false);
  const [ncSuccessMsg, setNcSuccessMsg] = useState<string | null>(null);

  // Form nueva actividad (simple) asociada a un contacto
  const [selectedContactoActividad, setSelectedContactoActividad] = useState<TrackerContacto | null>(null);
  const [actEtapa, setActEtapa] = useState("");
  const [actTipo, setActTipo] = useState("");
  const [actResultado, setActResultado] = useState("");
  const [actDetalle, setActDetalle] = useState("");
  const [actProximoContacto, setActProximoContacto] = useState("");
  const [actSaving, setActSaving] = useState(false);
  const [actSuccessMsg, setActSuccessMsg] = useState<string | null>(null);

  // 1) Resolver empresa_id a partir del usuario actual
  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!user?.id) {
        setLoadingEmpresa(false);
        return;
      }
      setLoadingEmpresa(true);
      setErrorMsg(null);
      try {
        const { data, error } = await supabase
          .from("empresas")
          .select("id")
          .or(`user_id.eq.${user.id},id_usuario.eq.${user.id}`)
          .maybeSingle();

        if (error) {
          console.error("Error buscando empresa para tracker:", error);
          setErrorMsg("No se pudo identificar la empresa asociada al usuario.");
          setEmpresaId(null);
        } else {
          setEmpresaId(data?.id ?? null);
        }
      } catch (err) {
        console.error("Error inesperado buscando empresa:", err);
        setErrorMsg("Error al buscar la empresa asociada.");
        setEmpresaId(null);
      } finally {
        setLoadingEmpresa(false);
      }
    };

    fetchEmpresa();
  }, [user]);

  // 2) Cargar contactos + actividades de agenda para la empresa
  useEffect(() => {
    const fetchData = async () => {
      if (!empresaId) {
        setLoadingData(false);
        return;
      }
      setLoadingData(true);
      setErrorMsg(null);

      try {
        // Contactos de la empresa
        const { data: contactosData, error: contactosError } = await supabase
          .from("tracker_contactos")
          .select("*")
          .eq("empresa_id", empresaId)
          .order("created_at", { ascending: false });

        if (contactosError) {
          console.error("Error cargando contactos:", contactosError);
          throw contactosError;
        }

        // Actividades con próximo contacto (agenda)
        const hoy = new Date();
        const hoyISO = new Date(
          hoy.getFullYear(),
          hoy.getMonth(),
          hoy.getDate(),
          0,
          0,
          0,
          0
        ).toISOString();

        const { data: agendaData, error: agendaError } = await supabase
          .from("tracker_actividades")
          .select("*")
          .eq("empresa_id", empresaId)
          .not("proximo_contacto_at", "is", null)
          .gte("proximo_contacto_at", hoyISO)
          .order("proximo_contacto_at", { ascending: true });

        if (agendaError) {
          console.error("Error cargando agenda:", agendaError);
          throw agendaError;
        }

        setContactos((contactosData ?? []) as TrackerContacto[]);
        setActividadesAgenda((agendaData ?? []) as TrackerActividad[]);
      } catch (err: any) {
        console.error("Error cargando datos del tracker:", err);
        setErrorMsg("No se pudieron cargar los datos del tracker.");
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [empresaId]);

  // 3) Contactos filtrados por estado + búsqueda
  const contactosFiltrados = useMemo(() => {
    const search = searchNombre.trim().toLowerCase();
    return contactos.filter((c) => {
      const nombre = `${c.nombre ?? ""} ${c.email ?? ""}`.toLowerCase();
      const matchSearch = search === "" || nombre.includes(search);
      const matchEstado =
        estadoFiltro === "todos" ||
        (c.estado_pipeline ?? "no_contactado") === estadoFiltro;
      return matchSearch && matchEstado;
    });
  }, [contactos, estadoFiltro, searchNombre]);

  // 4) Contactos mapeados por id para usar en agenda
  const contactosById = useMemo(() => {
    const map = new Map<string, TrackerContacto>();
    contactos.forEach((c) => {
      map.set(c.id, c);
    });
    return map;
  }, [contactos]);

  // 5) KPIs simples
  const {
    nuevos30Dias,
    captados30Dias,
    actividades7Dias,
    ventasCerradasMonto,
  } = useMemo(() => {
    const ahora = new Date();
    const hace30 = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate() - 30
    );
    const hace7 = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate() - 7
    );

    let nuevos = 0;
    let captados = 0;

    contactos.forEach((c) => {
      const created = c.created_at ? new Date(c.created_at) : null;
      if (created && created >= hace30) {
        nuevos += 1;
        if (c.estado_pipeline === "captado") captados += 1;
      }
    });

    let acts7 = 0;
    let montoVentas = 0;

    actividadesAgenda.forEach((a) => {
      const realizado = a.realizado_at ? new Date(a.realizado_at) : null;
      if (realizado && realizado >= hace7) {
        acts7 += 1;
      }
      if (a.es_venta_cerrada && a.monto_operacion) {
        montoVentas += Number(a.monto_operacion) || 0;
      }
    });

    return {
      nuevos30Dias: nuevos,
      captados30Dias: captados,
      actividades7Dias: acts7,
      ventasCerradasMonto: montoVentas,
    };
  }, [contactos, actividadesAgenda]);

  // 6) Crear nuevo contacto
  const handleNuevoContacto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) return;

    setNcSaving(true);
    setNcSuccessMsg(null);
    setErrorMsg(null);

    try {
      const { error } = await supabase.from("tracker_contactos").insert([
        {
          empresa_id: empresaId,
          asesor_id: null, // la empresa crea el contacto
          nombre: ncNombre || null,
          telefono: ncTelefono || null,
          email: ncEmail || null,
          tipo_contacto: "prospecto",
          estado_pipeline: ncEstadoPipeline,
          tipologia_propiedad: ncTipologia || null,
          tipo_operacion: ncTipoOperacion || null,
          zona: ncZona || null,
          origen: ncOrigen || null,
          link_fuente: ncLinkFuente || null,
          motivo_descartado: null,
          notas: ncNotas || null,
        },
      ]);

      if (error) {
        console.error("Error creando contacto:", error);
        setErrorMsg("No se pudo crear el contacto. Intentalo de nuevo.");
        return;
      }

      setNcSuccessMsg("Contacto creado correctamente.");
      setNcNombre("");
      setNcTelefono("");
      setNcEmail("");
      setNcTipologia("");
      setNcTipoOperacion("");
      setNcZona("");
      setNcOrigen("");
      setNcLinkFuente("");
      setNcEstadoPipeline("no_contactado");
      setNcNotas("");

      // Recargar contactos
      if (empresaId) {
        const { data: contactosData } = await supabase
          .from("tracker_contactos")
          .select("*")
          .eq("empresa_id", empresaId)
          .order("created_at", { ascending: false });
        setContactos((contactosData ?? []) as TrackerContacto[]);
      }
    } catch (err) {
      console.error("Error inesperado creando contacto:", err);
      setErrorMsg("Ocurrió un error al crear el contacto.");
    } finally {
      setNcSaving(false);
      setTimeout(() => setNcSuccessMsg(null), 3000);
    }
  };

  // 7) Crear nueva actividad asociada a un contacto
  const handleNuevaActividad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId || !selectedContactoActividad) return;

    setActSaving(true);
    setActSuccessMsg(null);
    setErrorMsg(null);

    try {
      const proximo =
        actProximoContacto.trim().length > 0
          ? new Date(actProximoContacto)
          : null;

      const { error } = await supabase.from("tracker_actividades").insert([
        {
          empresa_id: empresaId,
          asesor_id: null, // luego podremos setear asesor
          contacto_id: selectedContactoActividad.id,
          etapa: actEtapa || null,
          tipo: actTipo || null,
          resultado: actResultado || null,
          detalle: actDetalle || null,
          proximo_contacto_at: proximo ? proximo.toISOString() : null,
          es_venta_cerrada: false,
          monto_operacion: null,
          moneda: "ARS",
          fecha_cierre: null,
        },
      ]);

      if (error) {
        console.error("Error creando actividad:", error);
        setErrorMsg("No se pudo registrar la actividad.");
        return;
      }

      setActSuccessMsg("Actividad registrada correctamente.");
      setActEtapa("");
      setActTipo("");
      setActResultado("");
      setActDetalle("");
      setActProximoContacto("");

      // Recargar agenda
      const hoy = new Date();
      const hoyISO = new Date(
        hoy.getFullYear(),
        hoy.getMonth(),
        hoy.getDate(),
        0,
        0,
        0,
        0
      ).toISOString();

      const { data: agendaData } = await supabase
        .from("tracker_actividades")
        .select("*")
        .eq("empresa_id", empresaId)
        .not("proximo_contacto_at", "is", null)
        .gte("proximo_contacto_at", hoyISO)
        .order("proximo_contacto_at", { ascending: true });

      setActividadesAgenda((agendaData ?? []) as TrackerActividad[]);
    } catch (err) {
      console.error("Error inesperado creando actividad:", err);
      setErrorMsg("Ocurrió un error al registrar la actividad.");
    } finally {
      setActSaving(false);
      setTimeout(() => setActSuccessMsg(null), 3000);
    }
  };

  const loading = loadingEmpresa || loadingData;

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <section className="bg-white shadow-sm rounded-xl p-5 border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Tracker de trabajo
            </h1>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              Registrá tus acciones diarias de prospección, seguimiento y
              captación. Este tablero te ayuda a ver si estás haciendo lo
              suficiente hoy para conseguir las captaciones y ventas de mañana.
            </p>
          </div>
          <div className="text-xs text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-lg px-3 py-2 max-w-xs">
            Tip: pensá este tracker como tu “control de mando” diario. Si
            hoy no hay actividades agendadas, es momento de generar nuevas.
          </div>
        </div>
      </section>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-4 py-3">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-[40vh] text-gray-500 text-sm">
          Cargando información del tracker…
        </div>
      ) : !empresaId ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
          No se encontró una empresa asociada al usuario actual. Verificá que
          este usuario tenga una empresa creada.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <section className="grid gap-4 md:grid-cols-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-[0.18em]">
                Prospectos nuevos (30 días)
              </div>
              <div className="mt-2 text-3xl font-semibold text-gray-900">
                {nuevos30Dias}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Personas o propiedades que ingresaste recientemente al pipeline.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-[0.18em]">
                Captaciones (30 días)
              </div>
              <div className="mt-2 text-3xl font-semibold text-gray-900">
                {captados30Dias}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Contactos que pasaron al estado “captado” en el último mes.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-[0.18em]">
                Actividades registradas (últimos 7 días)
              </div>
              <div className="mt-2 text-3xl font-semibold text-gray-900">
                {actividades7Dias}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Llamadas, mensajes, visitas y seguimientos cargados recientemente.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-[0.18em]">
                Ventas cerradas (monto registrado)
              </div>
              <div className="mt-2 text-xl font-semibold text-gray-900">
                {formatCurrency(ventasCerradasMonto)}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Suma de operaciones marcadas como venta cerrada en las actividades.
              </p>
            </div>
          </section>

          {/* Layout principal: Agenda + Pipeline + Nuevo contacto */}
          <section className="grid gap-6 lg:grid-cols-[2fr_1.6fr]">
            {/* Columna izquierda: Agenda + Pipeline */}
            <div className="space-y-6">
              {/* Agenda de próximos contactos */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">
                      Agenda de próximos contactos
                    </h2>
                    <p className="text-xs text-gray-500">
                      Actividades con fecha de seguimiento futura. Ideal para
                      no perder de vista a ningún prospecto.
                    </p>
                  </div>
                </div>

                {actividadesAgenda.length === 0 ? (
                  <p className="text-xs text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-2">
                    Todavía no tenés actividades con próximo contacto agendado.
                    Cada vez que cargues una actividad, podés dejar pautado
                    cuándo volver a hablar con el cliente.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="py-2 pr-3">Fecha / hora</th>
                          <th className="py-2 pr-3">Contacto</th>
                          <th className="py-2 pr-3">Tipo</th>
                          <th className="py-2 pr-3">Etapa</th>
                          <th className="py-2 pr-3">Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actividadesAgenda.map((act) => {
                          const contacto = contactosById.get(act.contacto_id);
                          return (
                            <tr
                              key={act.id}
                              className="border-b border-gray-50 hover:bg-gray-50/60"
                            >
                              <td className="py-2 pr-3 whitespace-nowrap text-gray-800">
                                {formatDateTime(act.proximo_contacto_at)}
                              </td>
                              <td className="py-2 pr-3">
                                <div className="font-medium text-gray-900">
                                  {contacto?.nombre || "Sin nombre"}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  {contacto?.tipo_operacion ?? "—"}{" "}
                                  {contacto?.tipologia_propiedad
                                    ? `· ${contacto.tipologia_propiedad}`
                                    : ""}
                                </div>
                              </td>
                              <td className="py-2 pr-3 text-gray-700">
                                {act.tipo || "—"}
                              </td>
                              <td className="py-2 pr-3 text-gray-700">
                                {act.etapa || "—"}
                              </td>
                              <td className="py-2 pr-3 text-gray-600">
                                {act.resultado || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pipeline de contactos */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">
                      Pipeline de contactos
                    </h2>
                    <p className="text-xs text-gray-500">
                      Vista rápida de tus prospectos, en qué etapa están y quién
                      necesita tu atención primero.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex items-center gap-1">
                      <label className="text-[11px] text-gray-500">
                        Estado:
                      </label>
                      <select
                        value={estadoFiltro}
                        onChange={(e) =>
                          setEstadoFiltro(
                            e.target.value as EstadoPipeline | "todos"
                          )
                        }
                        className="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-800 bg-white"
                      >
                        <option value="todos">Todos</option>
                        {ESTADOS_PIPELINE.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={searchNombre}
                      onChange={(e) => setSearchNombre(e.target.value)}
                      placeholder="Buscar por nombre o email..."
                      className="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-800 bg-white w-40"
                    />
                  </div>
                </div>

                {contactosFiltrados.length === 0 ? (
                  <p className="text-xs text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-2">
                    Todavía no hay contactos en el tracker con este filtro. Usá
                    el formulario de la derecha para cargar tu primer prospecto
                    (ej: dueño de una propiedad que querés captar).
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="py-2 pr-3">Contacto</th>
                          <th className="py-2 pr-3">Propiedad</th>
                          <th className="py-2 pr-3">Zona</th>
                          <th className="py-2 pr-3">Estado</th>
                          <th className="py-2 pr-3">Origen</th>
                          <th className="py-2 pr-3">Creado</th>
                          <th className="py-2 pr-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contactosFiltrados.map((c) => (
                          <tr
                            key={c.id}
                            className="border-b border-gray-50 hover:bg-gray-50/70"
                          >
                            <td className="py-2 pr-3">
                              <div className="font-medium text-gray-900">
                                {c.nombre || "Sin nombre"}
                              </div>
                              {c.telefono && (
                                <div className="text-[11px] text-gray-500">
                                  {c.telefono}
                                </div>
                              )}
                              {c.email && (
                                <div className="text-[11px] text-gray-500">
                                  {c.email}
                                </div>
                              )}
                            </td>
                            <td className="py-2 pr-3">
                              <div className="text-gray-800">
                                {c.tipologia_propiedad || "—"}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                {c.tipo_operacion || "—"}
                              </div>
                            </td>
                            <td className="py-2 pr-3 text-gray-800">
                              {c.zona || "—"}
                            </td>
                            <td className="py-2 pr-3">
                              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-700">
                                {
                                  ESTADOS_PIPELINE.find(
                                    (e) => e.value === c.estado_pipeline
                                  )?.label ?? "No definido"
                                }
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-gray-800">
                              {c.origen || "—"}
                            </td>
                            <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">
                              {formatDateTime(c.created_at)}
                            </td>
                            <td className="py-2 pr-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedContactoActividad(c)}
                                className="text-[11px] font-medium text-blue-700 hover:text-blue-800 underline underline-offset-2"
                              >
                                Registrar actividad
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Columna derecha: Nuevo contacto + Nueva actividad */}
            <div className="space-y-6">
              {/* Nuevo contacto */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">
                  Nuevo contacto
                </h2>
                <p className="text-xs text-gray-500 mb-3">
                  Usalo para registrar dueños, prospectos o clientes con los que
                  quieras trabajar una captación. Pensá en cada fila como una
                  oportunidad de negocio.
                </p>

                {ncSuccessMsg && (
                  <div className="mb-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">
                    {ncSuccessMsg}
                  </div>
                )}

                <form onSubmit={handleNuevoContacto} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Nombre del contacto
                      </label>
                      <input
                        type="text"
                        value={ncNombre}
                        onChange={(e) => setNcNombre(e.target.value)}
                        placeholder="Ej: Juan Pérez (dueño)"
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Teléfono
                      </label>
                      <input
                        type="text"
                        value={ncTelefono}
                        onChange={(e) => setNcTelefono(e.target.value)}
                        placeholder="Ej: 351 555 1234"
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={ncEmail}
                        onChange={(e) => setNcEmail(e.target.value)}
                        placeholder="Ej: juan@mail.com"
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Estado inicial
                      </label>
                      <select
                        value={ncEstadoPipeline}
                        onChange={(e) =>
                          setNcEstadoPipeline(e.target.value as EstadoPipeline)
                        }
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-800 bg-white"
                      >
                        {ESTADOS_PIPELINE.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Tipología de propiedad
                      </label>
                      <select
                        value={ncTipologia}
                        onChange={(e) => setNcTipologia(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-800 bg-white"
                      >
                        <option value="">Seleccioná una opción</option>
                        {TIPOLOGIAS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-gray-400">
                        Ej: Casa, departamento, dúplex, lote, local, etc.
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Tipo de operación
                      </label>
                      <select
                        value={ncTipoOperacion}
                        onChange={(e) => setNcTipoOperacion(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-800 bg-white"
                      >
                        <option value="">Seleccioná una opción</option>
                        {TIPOS_OPERACION.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Zona / barrio
                      </label>
                      <input
                        type="text"
                        value={ncZona}
                        onChange={(e) => setNcZona(e.target.value)}
                        placeholder="Ej: Nueva Córdoba, Gral. Paz"
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Origen del contacto
                      </label>
                      <select
                        value={ncOrigen}
                        onChange={(e) => setNcOrigen(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-800 bg-white"
                      >
                        <option value="">Seleccioná una opción</option>
                        {ORIGENES.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-gray-400">
                        Esto te va a ayudar a ver qué canal trae mejores
                        resultados.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Link de referencia (opcional)
                    </label>
                    <input
                      type="text"
                      value={ncLinkFuente}
                      onChange={(e) => setNcLinkFuente(e.target.value)}
                      placeholder="Ej: enlace al aviso donde viste la propiedad"
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Notas internas
                    </label>
                    <textarea
                      value={ncNotas}
                      onChange={(e) => setNcNotas(e.target.value)}
                      rows={3}
                      placeholder="Ej: Llamado frío. Está pensando vender, pero quiere hablar con la familia. Volver a contactar la semana que viene."
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-800 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={ncSaving}
                    className={`w-full rounded-lg py-2.5 text-xs font-semibold text-white transition ${
                      ncSaving
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {ncSaving ? "Guardando..." : "Guardar contacto en el tracker"}
                  </button>
                </form>
              </div>

              {/* Nueva actividad asociada a contacto */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">
                  Registrar actividad rápida
                </h2>
                <p className="text-xs text-gray-500 mb-3">
                  Elegí un contacto desde la tabla de pipeline y registrá la
                  última interacción (llamada, WhatsApp, visita, etc.). Podés
                  dejar agendada la próxima fecha de contacto para que aparezca
                  en la agenda.
                </p>

                {actSuccessMsg && (
                  <div className="mb-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">
                    {actSuccessMsg}
                  </div>
                )}

                {!selectedContactoActividad ? (
                  <p className="text-xs text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-2">
                    Seleccioná primero un contacto desde la tabla de pipeline
                    con el botón “Registrar actividad”.
                  </p>
                ) : (
                  <form onSubmit={handleNuevaActividad} className="space-y-3">
                    <div className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      Registrando actividad para:{" "}
                      <span className="font-semibold text-gray-900">
                        {selectedContactoActividad.nombre || "Sin nombre"}
                      </span>
                      {selectedContactoActividad.tipologia_propiedad && (
                        <>
                          {" "}
                          · {selectedContactoActividad.tipologia_propiedad}
                        </>
                      )}
                      {selectedContactoActividad.zona && (
                        <> · {selectedContactoActividad.zona}</>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">
                          Etapa
                        </label>
                        <select
                          value={actEtapa}
                          onChange={(e) => setActEtapa(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-800 bg-white"
                          required
                        >
                          <option value="">Seleccioná una etapa</option>
                          {ETAPAS_ACTIVIDAD.map((e) => (
                            <option key={e} value={e}>
                              {e}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">
                          Tipo de actividad
                        </label>
                        <select
                          value={actTipo}
                          onChange={(e) => setActTipo(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-800 bg-white"
                          required
                        >
                          <option value="">Seleccioná un tipo</option>
                          {TIPOS_ACTIVIDAD.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Resultado de esta interacción
                      </label>
                      <select
                        value={actResultado}
                        onChange={(e) => setActResultado(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-800 bg-white"
                        required
                      >
                        <option value="">Seleccioná un resultado</option>
                        {RESULTADOS_ACTIVIDAD.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-gray-400">
                        Esto te va a permitir ver tu tasa de conversión entre
                        llamados, interesados y captaciones.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Notas internas de la actividad
                      </label>
                      <textarea
                        value={actDetalle}
                        onChange={(e) => setActDetalle(e.target.value)}
                        rows={3}
                        placeholder="Ej: Llamada de 10 minutos. Le conté cómo trabajamos, le interesa pero quiere hablar con su pareja. Volver a llamar la semana próxima."
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-800 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Próximo contacto (opcional)
                      </label>
                      <input
                        type="datetime-local"
                        value={actProximoContacto}
                        onChange={(e) => setActProximoContacto(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-800"
                      />
                      <p className="mt-1 text-[11px] text-gray-400">
                        Si definís una fecha, esta actividad aparecerá en tu
                        agenda de “Próximos contactos”.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={actSaving}
                      className={`w-full rounded-lg py-2.5 text-xs font-semibold text-white transition ${
                        actSaving
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {actSaving
                        ? "Guardando actividad..."
                        : "Guardar actividad"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
