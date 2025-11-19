// frontend/app/dashboard/empresa/tracker/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

export const dynamic = "force-dynamic";

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

type KpiRange = "30d" | "3m" | "6m" | "1y";
type Section = "calendario" | "nuevo" | "captadas";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

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

function formatDate(dt: string | null) {
  if (!dt) return "-";
  try {
    const d = new Date(dt);
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
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

function getMonthLabel(d: Date) {
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function getStartOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getEndOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function getStartOfWeek(d: Date) {
  const day = d.getDay(); // 0 = domingo
  const diff = (day === 0 ? -6 : 1) - day; // arrancar en lunes
  return addDays(d, diff);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function EmpresaTrackerPage() {
  const { user } = useAuth();

  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [loadingEmpresa, setLoadingEmpresa] = useState(true);
  const [loadingData, setLoadingData] = useState(true);

  const [contactos, setContactos] = useState<TrackerContacto[]>([]);
  const [actividades, setActividades] = useState<TrackerActividad[]>([]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtros & UI
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoPipeline | "todos">("todos");
  const [searchNombre, setSearchNombre] = useState("");
  const [kpiRange, setKpiRange] = useState<KpiRange>("30d");
  const [activeSection, setActiveSection] = useState<Section>("calendario");

  // Calendario
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());

  // Form nuevo prospecto
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

  const accent = "#E6A930";

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

  // 2) Cargar contactos + actividades de la empresa
  useEffect(() => {
    const fetchData = async () => {
      if (!empresaId) {
        setLoadingData(false);
        return;
      }
      setLoadingData(true);
      setErrorMsg(null);

      try {
        const { data: contactosData, error: contactosError } = await supabase
          .from("tracker_contactos")
          .select("*")
          .eq("empresa_id", empresaId)
          .order("created_at", { ascending: false });

        if (contactosError) {
          console.error("Error cargando contactos:", contactosError);
          throw contactosError;
        }

        const { data: actividadesData, error: actividadesError } = await supabase
          .from("tracker_actividades")
          .select("*")
          .eq("empresa_id", empresaId)
          .order("proximo_contacto_at", { ascending: true });

        if (actividadesError) {
          console.error("Error cargando actividades:", actividadesError);
          throw actividadesError;
        }

        setContactos((contactosData ?? []) as TrackerContacto[]);
        setActividades((actividadesData ?? []) as TrackerActividad[]);
      } catch (err: any) {
        console.error("Error cargando datos del tracker:", err);
        setErrorMsg("No se pudieron cargar los datos del tracker.");
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [empresaId]);

  const loading = loadingEmpresa || loadingData;

  // Mapa de contactos por id para usar en actividades
  const contactosById = useMemo(() => {
    const map = new Map<string, TrackerContacto>();
    contactos.forEach((c) => map.set(c.id, c));
    return map;
  }, [contactos]);

  // Actividades de HOY y MAÑANA (para las cards del header)
  const { actividadesHoy, actividadesManiana } = useMemo(() => {
    const hoy = startOfDay(new Date());
    const finHoy = endOfDay(hoy);
    const manana = startOfDay(addDays(hoy, 1));
    const finManiana = endOfDay(manana);

    const hoyList: TrackerActividad[] = [];
    const mananaList: TrackerActividad[] = [];

    actividades.forEach((a) => {
      if (!a.proximo_contacto_at) return;
      const d = new Date(a.proximo_contacto_at);
      if (d >= hoy && d <= finHoy) hoyList.push(a);
      else if (d >= manana && d <= finManiana) mananaList.push(a);
    });

    hoyList.sort(
      (a, b) =>
        new Date(a.proximo_contacto_at ?? a.created_at).getTime() -
        new Date(b.proximo_contacto_at ?? b.created_at).getTime()
    );
    mananaList.sort(
      (a, b) =>
        new Date(a.proximo_contacto_at ?? a.created_at).getTime() -
        new Date(b.proximo_contacto_at ?? b.created_at).getTime()
    );

    return { actividadesHoy: hoyList, actividadesManiana: mananaList };
  }, [actividades]);

  // KPIs con rango
  const { kpiNuevos, kpiCaptados, kpiCierres } = useMemo(() => {
    const ahora = new Date();
    let desde: Date;

    switch (kpiRange) {
      case "3m":
        desde = addMonths(ahora, -3);
        break;
      case "6m":
        desde = addMonths(ahora, -6);
        break;
      case "1y":
        desde = addMonths(ahora, -12);
        break;
      case "30d":
      default:
        desde = addDays(ahora, -30);
        break;
    }

    let nuevos = 0;
    let captados = 0;
    let cierresMonto = 0;

    contactos.forEach((c) => {
      const created = c.created_at ? new Date(c.created_at) : null;
      if (!created || created < desde) return;
      nuevos += 1;
      if (c.estado_pipeline === "captado") captados += 1;
    });

    actividades.forEach((a) => {
      if (!a.es_venta_cerrada) return;
      const fecha = a.fecha_cierre
        ? new Date(a.fecha_cierre)
        : new Date(a.created_at);
      if (fecha >= desde) {
        cierresMonto += Number(a.monto_operacion || 0);
      }
    });

    return {
      kpiNuevos: nuevos,
      kpiCaptados: captados,
      kpiCierres: cierresMonto,
    };
  }, [contactos, actividades, kpiRange]);

  // Contactos filtrados para la tabla de "Contactos / Clientes"
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

  // Contactos captados para la sección "Propiedades captadas"
  const contactosCaptados = useMemo(
    () => contactos.filter((c) => c.estado_pipeline === "captado"),
    [contactos]
  );

  // Estructura de calendario: días del mes visible
  const calendarDays = useMemo(() => {
    const startMonth = getStartOfMonth(currentMonth);
    const endMonth = getEndOfMonth(currentMonth);
    const startGrid = getStartOfWeek(startMonth);

    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    let current = new Date(startGrid);

    while (current <= endMonth || days.length < 42) {
      days.push({
        date: new Date(current),
        isCurrentMonth:
          current.getMonth() === currentMonth.getMonth() &&
          current.getFullYear() === currentMonth.getFullYear(),
      });
      current = addDays(current, 1);
      if (days.length >= 42 && current > endMonth) break;
    }

    return days;
  }, [currentMonth]);

  // Actividades por día (para calendar & lista de día seleccionado)
  const activitiesByDay = useMemo(() => {
    const map = new Map<string, TrackerActividad[]>();
    actividades.forEach((a) => {
      if (!a.proximo_contacto_at) return;
      const d = new Date(a.proximo_contacto_at);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [actividades]);

  const selectedDayActivities = useMemo(() => {
    if (!selectedDate) return [];
    const key = selectedDate.toISOString().slice(0, 10);
    return activitiesByDay.get(key) ?? [];
  }, [selectedDate, activitiesByDay]);

  // Crear nuevo prospecto
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
          asesor_id: null,
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
        setErrorMsg("No se pudo crear el prospecto. Intentalo de nuevo.");
        return;
      }

      setNcSuccessMsg("Prospecto creado correctamente.");
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
      const { data: contactosData } = await supabase
        .from("tracker_contactos")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });

      setContactos((contactosData ?? []) as TrackerContacto[]);
    } catch (err) {
      console.error("Error inesperado creando contacto:", err);
      setErrorMsg("Ocurrió un error al crear el prospecto.");
    } finally {
      setNcSaving(false);
      setTimeout(() => setNcSuccessMsg(null), 3000);
    }
  };

  const kpiRangeLabel = (range: KpiRange) => {
    switch (range) {
      case "30d":
        return "Últimos 30 días";
      case "3m":
        return "Últimos 3 meses";
      case "6m":
        return "Últimos 6 meses";
      case "1y":
        return "Último año";
      default:
        return "";
    }
  };

  const daysOfWeek = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <section className="rounded-2xl border border-gray-200 bg-gradient-to-r from-white via-white to-gray-50 shadow-sm px-5 py-4">
        <div className="grid gap-4 lg:grid-cols-[2fr_1.2fr_1.2fr] items-stretch">
          {/* Izquierda: título + descripción */}
          <div className="flex flex-col justify-center">
            <h1 className="text-2xl font-semibold text-gray-900">
              Tracker de trabajo
            </h1>
            <p className="mt-1 text-sm text-gray-600 max-w-xl">
              Controlá, día a día, cómo estás alimentando tu negocio: nuevos
              prospectos, captaciones y seguimientos. Pensado como un “tablero
              de comando” para tu inmobiliaria.
            </p>
          </div>

          {/* Centro: Hoy */}
          <div className="rounded-xl border border-gray-200 bg-white/90 px-4 py-3 flex flex-col shadow-[0_8px_25px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Hoy
              </div>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
              >
                {actividadesHoy.length} actividad
                {actividadesHoy.length === 1 ? "" : "es"}
              </span>
            </div>
            {actividadesHoy.length === 0 ? (
              <p className="mt-2 text-[11px] text-gray-500">
                No tenés actividades agendadas para hoy. Es un buen momento
                para generar nuevos contactos o programar seguimientos.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5 max-h-28 overflow-y-auto">
                {actividadesHoy.slice(0, 4).map((a) => {
                  const c = contactosById.get(a.contacto_id);
                  return (
                    <li
                      key={a.id}
                      className="text-[11px] text-gray-800 flex items-start gap-2"
                    >
                      <span
                        className="mt-[3px] inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: accent }}
                      />
                      <div>
                        <div className="font-medium text-gray-900">
                          {a.tipo || "Actividad"} con{" "}
                          {c?.nombre || "Contacto sin nombre"}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {a.detalle
                            ? a.detalle.slice(0, 80)
                            : a.etapa || "Seguimiento"}{" "}
                          · {formatDateTime(a.proximo_contacto_at)}
                        </div>
                      </div>
                    </li>
                  );
                })}
                {actividadesHoy.length > 4 && (
                  <li className="text-[10px] text-gray-500">
                    +{actividadesHoy.length - 4} actividades más
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Derecha: Mañana */}
          <div className="rounded-xl border border-gray-200 bg-white/90 px-4 py-3 flex flex-col shadow-[0_8px_25px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Mañana
              </div>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                {actividadesManiana.length} actividad
                {actividadesManiana.length === 1 ? "" : "es"}
              </span>
            </div>
            {actividadesManiana.length === 0 ? (
              <p className="mt-2 text-[11px] text-gray-500">
                Mañana todavía no tiene actividades programadas. Programá
                seguimientos para no perder el ritmo de contactos.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5 max-h-28 overflow-y-auto">
                {actividadesManiana.slice(0, 4).map((a) => {
                  const c = contactosById.get(a.contacto_id);
                  return (
                    <li
                      key={a.id}
                      className="text-[11px] text-gray-800 flex items-start gap-2"
                    >
                      <span className="mt-[3px] inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">
                          {a.tipo || "Actividad"} con{" "}
                          {c?.nombre || "Contacto sin nombre"}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {a.detalle
                            ? a.detalle.slice(0, 80)
                            : a.etapa || "Seguimiento"}{" "}
                          · {formatDateTime(a.proximo_contacto_at)}
                        </div>
                      </div>
                    </li>
                  );
                })}
                {actividadesManiana.length > 4 && (
                  <li className="text-[10px] text-gray-500">
                    +{actividadesManiana.length - 4} actividades más
                  </li>
                )}
              </ul>
            )}
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
          {/* KPIs + rango */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                Mostrando métricas para:{" "}
                <span className="font-medium text-gray-800">
                  {kpiRangeLabel(kpiRange)}
                </span>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-gray-50 border border-gray-200 px-1 py-1 text-[11px]">
                {([
                  { value: "30d", label: "30 días" },
                  { value: "3m", label: "3 meses" },
                  { value: "6m", label: "6 meses" },
                  { value: "1y", label: "1 año" },
                ] as { value: KpiRange; label: string }[]).map((opt) => {
                  const active = kpiRange === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setKpiRange(opt.value)}
                      className={`px-3 py-1 rounded-full transition ${
                        active
                          ? "bg-gray-900 text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-[0.18em]">
                  Nuevos prospectos
                </div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">
                  {kpiNuevos}
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  Cantidad de personas/proiedades que ingresaron a tu tracker en
                  el período seleccionado.
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-[0.18em]">
                  Captaciones
                </div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">
                  {kpiCaptados}
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  Contactos que actualmente están en estado “Captado”. En
                  próximas versiones podemos marcar la fecha exacta de
                  captación.
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-[0.18em]">
                  Cierres (monto)
                </div>
                <div className="mt-2 text-xl font-semibold text-gray-900">
                  {formatCurrency(kpiCierres)}
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  Suma de operaciones marcadas como venta cerrada dentro del
                  período.
                </p>
              </div>
            </div>
          </section>

          {/* Tabs/secciones */}
          <section className="space-y-4">
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full bg-gray-100 border border-gray-200 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveSection("calendario")}
                  className={`px-3 py-1.5 rounded-full transition ${
                    activeSection === "calendario"
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Calendario
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection("nuevo")}
                  className={`px-3 py-1.5 rounded-full transition ${
                    activeSection === "nuevo"
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Nuevo prospecto
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection("captadas")}
                  className={`px-3 py-1.5 rounded-full transition ${
                    activeSection === "captadas"
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Propiedades captadas
                </button>
              </div>
            </div>

            {/* CONTENIDO DE SECCIONES */}
            {activeSection === "calendario" && (
              <div className="grid gap-6 lg:grid-cols-[2.1fr_1.4fr]">
                {/* Calendario mensual */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">
                        Calendario de actividades
                      </h2>
                      <p className="text-[11px] text-gray-500">
                        Visualizá tus llamadas, muestras y seguimientos por día.
                        Hacé clic en un día para ver el detalle.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentMonth(
                            addMonths(currentMonth, -1)
                          )
                        }
                        className="rounded-full border border-gray-300 bg-white px-2 py-1 hover:bg-gray-100"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          setCurrentMonth(
                            new Date(
                              now.getFullYear(),
                              now.getMonth(),
                              1
                            )
                          );
                          setSelectedDate(new Date());
                        }}
                        className="rounded-full border border-gray-300 bg-white px-3 py-1 hover:bg-gray-100"
                      >
                        Hoy
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentMonth(
                            addMonths(currentMonth, 1)
                          )
                        }
                        className="rounded-full border border-gray-300 bg-white px-2 py-1 hover:bg-gray-100"
                      >
                        ▶
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-900 capitalize">
                      {getMonthLabel(currentMonth)}
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-[11px] text-gray-500 mb-1">
                    {daysOfWeek.map((d) => (
                      <div
                        key={d}
                        className="text-center font-medium py-1"
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-[11px]">
                    {calendarDays.map(({ date, isCurrentMonth }) => {
                      const key = date.toISOString().slice(0, 10);
                      const hasEvents = (activitiesByDay.get(key) ?? []).length > 0;
                      const isToday = isSameDay(date, new Date());
                      const isSelected =
                        selectedDate && isSameDay(date, selectedDate);

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedDate(new Date(date))}
                          className={[
                            "min-h-[56px] rounded-lg border text-left px-1.5 py-1.5 transition flex flex-col",
                            isSelected
                              ? "border-gray-900 bg-gray-900 text-white"
                              : isToday
                              ? "border-gray-900/50 bg-gray-900/5 text-gray-900"
                              : isCurrentMonth
                              ? "border-gray-200 bg-white hover:bg-gray-50 text-gray-800"
                              : "border-gray-100 bg-gray-50 text-gray-400 hover:bg-gray-100",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium">
                              {date.getDate()}
                            </span>
                            {hasEvents && (
                              <span
                                className="inline-block h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: accent }}
                              />
                            )}
                          </div>
                          {hasEvents && (
                            <div className="mt-1 space-y-0.5 overflow-hidden">
                              {(activitiesByDay.get(key) ?? [])
                                .slice(0, 2)
                                .map((a) => {
                                  const c = contactosById.get(a.contacto_id);
                                  return (
                                    <div
                                      key={a.id}
                                      className={`truncate text-[10px] ${
                                        isSelected ? "text-gray-100" : "text-gray-500"
                                      }`}
                                    >
                                      {a.tipo || "Actividad"} ·{" "}
                                      {c?.nombre || "Contacto"}
                                    </div>
                                  );
                                })}
                              {(activitiesByDay.get(key) ?? []).length > 2 && (
                                <div
                                  className={`text-[10px] ${
                                    isSelected ? "text-gray-200" : "text-gray-400"
                                  }`}
                                >
                                  +
                                  {(activitiesByDay.get(key) ?? []).length - 2} más
                                </div>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Lista de actividades del día seleccionado */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">
                        Actividades del día
                      </h2>
                      <p className="text-[11px] text-gray-500">
                        {selectedDate
                          ? selectedDate.toLocaleDateString("es-AR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                            })
                          : "Seleccioná un día en el calendario."}
                      </p>
                    </div>
                  </div>

                  {(!selectedDate || selectedDayActivities.length === 0) ? (
                    <p className="mt-2 text-[11px] text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-2">
                      No hay actividades registradas para este día. Podés usar el
                      formulario de actividades (en otra iteración) o tu flujo
                      actual para empezar a nutrir el calendario.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2 overflow-y-auto max-h-[360px] pr-1">
                      {selectedDayActivities.map((a) => {
                        const c = contactosById.get(a.contacto_id);
                        return (
                          <div
                            key={a.id}
                            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] font-semibold text-gray-900">
                                {a.tipo || "Actividad"} ·{" "}
                                {c?.nombre || "Contacto sin nombre"}
                              </div>
                              <div className="text-[10px] text-gray-500">
                                {formatDateTime(a.proximo_contacto_at)}
                              </div>
                            </div>
                            <div className="mt-0.5 text-[11px] text-gray-600">
                              {a.detalle
                                ? a.detalle
                                : a.etapa || "Seguimiento del contacto"}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-gray-500">
                              {a.etapa && (
                                <span className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2 py-0.5">
                                  {a.etapa}
                                </span>
                              )}
                              {a.resultado && (
                                <span className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2 py-0.5">
                                  {a.resultado}
                                </span>
                              )}
                              {c?.tipologia_propiedad && (
                                <span className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2 py-0.5">
                                  {c.tipologia_propiedad}
                                </span>
                              )}
                              {c?.zona && (
                                <span className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2 py-0.5">
                                  {c.zona}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === "nuevo" && (
              <div className="grid gap-6 lg:grid-cols-[1.4fr_2fr]">
                {/* Nuevo prospecto */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
                  <h2 className="text-sm font-semibold text-gray-900 mb-1">
                    Alta de nuevo prospecto
                  </h2>
                  <p className="text-[11px] text-gray-500 mb-3">
                    Pensá cada prospecto como una oportunidad. Cuantos más
                    registros alimentes acá, más claro vas a ver qué acciones te
                    llevan a captar propiedades y cerrar operaciones.
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
                            setNcEstadoPipeline(
                              e.target.value as EstadoPipeline
                            )
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
                          Tipología de la propiedad
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
                          Casa, departamento, dúplex, lote, local, etc.
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
                          Te va a facilitar ver qué canal trae mejores contactos.
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
                        placeholder="Ej: Llamado frío. Le interesa escuchar propuesta, pero quiere hablar con la familia. Volver a contactar la semana próxima."
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-800 resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={ncSaving}
                      className={`w-full rounded-lg py-2.5 text-xs font-semibold text-white transition ${
                        ncSaving
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-gray-900 hover:bg-black"
                      }`}
                    >
                      {ncSaving
                        ? "Guardando prospecto..."
                        : "Guardar prospecto en el tracker"}
                    </button>
                  </form>
                </div>

                {/* Tabla contactos / clientes */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">
                        Contactos / Clientes
                      </h2>
                      <p className="text-[11px] text-gray-500">
                        Acá ves la base de personas y propiedades con las que
                        estás trabajando (o podrías trabajar).
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <select
                        value={estadoFiltro}
                        onChange={(e) =>
                          setEstadoFiltro(
                            e.target.value as EstadoPipeline | "todos"
                          )
                        }
                        className="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-800 bg-white"
                      >
                        <option value="todos">Todos los estados</option>
                        {ESTADOS_PIPELINE.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
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
                    <p className="text-[11px] text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-2">
                      Todavía no tenés contactos con este filtro. Arrancá
                      cargando algunos prospectos desde el formulario de la
                      izquierda.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-[11px]">
                        <thead>
                          <tr className="text-left text-gray-500 border-b border-gray-100">
                            <th className="py-2 pr-3">Contacto</th>
                            <th className="py-2 pr-3">Propiedad</th>
                            <th className="py-2 pr-3">Zona</th>
                            <th className="py-2 pr-3">Estado</th>
                            <th className="py-2 pr-3">Origen</th>
                            <th className="py-2 pr-3">Fecha alta</th>
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
                                  <div className="text-[10px] text-gray-500">
                                    {c.telefono}
                                  </div>
                                )}
                                {c.email && (
                                  <div className="text-[10px] text-gray-500">
                                    {c.email}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 pr-3">
                                <div className="text-gray-800">
                                  {c.tipologia_propiedad || "—"}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                  {c.tipo_operacion || "—"}
                                </div>
                              </td>
                              <td className="py-2 pr-3 text-gray-800">
                                {c.zona || "—"}
                              </td>
                              <td className="py-2 pr-3">
                                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-700">
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
                                {formatDate(c.created_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === "captadas" && (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">
                      Propiedades captadas
                    </h2>
                    <p className="text-[11px] text-gray-500">
                      Vista de prospectos que ya se transformaron en clientes y
                      te dieron la propiedad para trabajar.
                    </p>
                  </div>
                </div>

                {contactosCaptados.length === 0 ? (
                  <p className="text-[11px] text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-2">
                    Todavía no tenés propiedades marcadas como “captadas”. Cuando
                    un contacto pase a ese estado, va a aparecer acá.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-[11px]">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="py-2 pr-3">Cliente</th>
                          <th className="py-2 pr-3">Propiedad</th>
                          <th className="py-2 pr-3">Zona</th>
                          <th className="py-2 pr-3">Operación</th>
                          <th className="py-2 pr-3">Fecha captación (aprox.)</th>
                          <th className="py-2 pr-3">Fuente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contactosCaptados.map((c) => (
                          <tr
                            key={c.id}
                            className="border-b border-gray-50 hover:bg-gray-50/70"
                          >
                            <td className="py-2 pr-3">
                              <div className="font-medium text-gray-900">
                                {c.nombre || "Sin nombre"}
                              </div>
                              {c.telefono && (
                                <div className="text-[10px] text-gray-500">
                                  {c.telefono}
                                </div>
                              )}
                              {c.email && (
                                <div className="text-[10px] text-gray-500">
                                  {c.email}
                                </div>
                              )}
                            </td>
                            <td className="py-2 pr-3">
                              <div className="text-gray-800">
                                {c.tipologia_propiedad || "—"}
                              </div>
                            </td>
                            <td className="py-2 pr-3 text-gray-800">
                              {c.zona || "—"}
                            </td>
                            <td className="py-2 pr-3 text-gray-800">
                              {c.tipo_operacion || "—"}
                            </td>
                            <td className="py-2 pr-3 text-gray-800 whitespace-nowrap">
                              {formatDate(c.created_at)}
                            </td>
                            <td className="py-2 pr-3 text-gray-800">
                              {c.link_fuente ? (
                                <a
                                  href={c.link_fuente}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] text-blue-700 hover:text-blue-800 underline underline-offset-2"
                                >
                                  Ver aviso
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
