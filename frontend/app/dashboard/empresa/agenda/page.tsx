// app/dashboard/empresa/agenda/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

type AgendaScope = "empresa" | "asesores" | "global";
type AgendaView = "calendario" | "lista";
type ActividadTipo =
  | "seguimiento"
  | "reunion"
  | "muestra"
  | "prelisting"
  | "vai"
  | "factibilidad"
  | "reserva"
  | "cierre";

interface TrackerContacto {
  id: string;
  empresa_id: string;
  asesor_id: string | null;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  telefono_whatsapp: string | null;
  email: string | null;
  tipologia: string | null;
  tipo_operacion: string | null;
  zona: string | null;
  direccion: string | null;
  estado: string | null;
  created_at: string;
}

interface TrackerActividad {
  id: string;
  empresa_id: string;
  asesor_id: string | null;
  contacto_id: string | null;
  titulo: string | null;
  tipo: ActividadTipo;
  fecha_programada: string;
  hora: string | null;
  notas: string | null;
  duracion_minutos: number | null;
  google_calendar_event_id: string | null;
  google_calendar_html_link: string | null;
  google_calendar_synced_at: string | null;
  google_calendar_sync_status: string | null;
  google_calendar_sync_error: string | null;
  created_at: string;
  updated_at: string;
}

interface Asesor {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email?: string | null;
}

interface FormActividadState {
  titulo: string;
  tipo: ActividadTipo;
  fecha_programada: string;
  hora: string;
  duracion_minutos: string;
  asesor_id: string;
  contacto_id: string;
  notas: string;
}

const ACTIVIDAD_TIPOS: { value: ActividadTipo; label: string }[] = [
  { value: "seguimiento", label: "Seguimiento" },
  { value: "reunion", label: "Reunión" },
  { value: "muestra", label: "Muestra" },
  { value: "prelisting", label: "Prelisting" },
  { value: "vai", label: "VAI" },
  { value: "factibilidad", label: "Factibilidad" },
  { value: "reserva", label: "Reserva" },
  { value: "cierre", label: "Cierre" },
];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateKeyFromString(value: string | null | undefined): string {
  return value ? value.substring(0, 10) : "";
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getMonthMatrix(currentMonth: Date) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startWeekDay = firstDayOfMonth.getDay();
  const start = new Date(firstDayOfMonth);
  start.setDate(firstDayOfMonth.getDate() - (startWeekDay === 0 ? 6 : startWeekDay - 1));

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

function formatDateShort(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(`${value.substring(0, 10)}T00:00:00`) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function formatDateLong(value: Date) {
  return value.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(hora: string | null | undefined) {
  if (!hora) return "Sin hora";
  return hora.substring(0, 5);
}

function normalizePhoneForWhatsApp(raw: string | null | undefined) {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  // Argentina: normalizamos lo más común a 549 + área + número.
  if (digits.startsWith("00")) digits = digits.substring(2);
  if (digits.startsWith("0")) digits = digits.substring(1);

  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) {
    const rest = digits.substring(2);
    if (rest.startsWith("9")) return digits;
    return `549${rest.replace(/^0+/, "")}`;
  }

  // Si viene como celular local/área local: 351xxxxxxx -> 549351xxxxxxx.
  if (digits.length >= 8 && digits.length <= 11) return `549${digits}`;

  return digits;
}

function whatsappUrl(raw: string | null | undefined) {
  const n = normalizePhoneForWhatsApp(raw);
  return n ? `https://wa.me/${n}` : "";
}

function contactoNombre(c: { nombre?: string | null; apellido?: string | null } | null | undefined) {
  if (!c) return "Sin contacto";
  const full = [c.nombre, c.apellido].filter(Boolean).join(" ").trim();
  return full || "Sin nombre";
}

function labelTipoActividad(tipo: string | null | undefined) {
  const found = ACTIVIDAD_TIPOS.find((t) => t.value === tipo);
  return found?.label ?? tipo ?? "Actividad";
}

function parseIntOrDefault(value: string, fallback: number) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export default function EmpresaAgendaPage() {
  const { user } = useAuth();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [contactos, setContactos] = useState<TrackerContacto[]>([]);
  const [actividades, setActividades] = useState<TrackerActividad[]>([]);
  const [asesores, setAsesores] = useState<Asesor[]>([]);

  const [scope, setScope] = useState<AgendaScope>("global");
  const [selectedAsesorId, setSelectedAsesorId] = useState<string>("");
  const [view, setView] = useState<AgendaView>("calendario");
  const [tipoFiltro, setTipoFiltro] = useState<string>("");
  const [busqueda, setBusqueda] = useState<string>("");

  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));

  const [showModal, setShowModal] = useState(false);
  const [editingActividad, setEditingActividad] = useState<TrackerActividad | null>(null);
  const [formActividad, setFormActividad] = useState<FormActividadState>({
    titulo: "",
    tipo: "seguimiento",
    fecha_programada: toDateKey(new Date()),
    hora: "",
    duracion_minutos: "30",
    asesor_id: "",
    contacto_id: "",
    notas: "",
  });

  const showMessage = (text: string) => {
    setMensaje(text);
    setTimeout(() => setMensaje(null), 3500);
  };

  const asesorNombre = (asesorId: string | null | undefined) => {
    if (!asesorId) return "Empresa";
    const asesor = asesores.find((a) => a.id === asesorId);
    return asesor ? contactoNombre(asesor) : "Asesor";
  };

  const contactoPorId = (id: string | null | undefined) => {
    if (!id) return null;
    return contactos.find((c) => c.id === id) ?? null;
  };

  const recordMatchesScope = (asesorId: string | null | undefined) => {
    if (scope === "global") return true;
    if (scope === "empresa") return !asesorId;
    if (!selectedAsesorId) return !!asesorId;
    return asesorId === selectedAsesorId;
  };

  const fetchAgendaData = useCallback(async () => {
    if (!empresaId) return;

    try {
      setLoading(true);
      const [actividadesRes, contactosRes, asesoresRes] = await Promise.all([
        supabase
          .from("tracker_actividades")
          .select(
            `
              id,
              empresa_id,
              asesor_id,
              contacto_id,
              titulo,
              tipo,
              fecha_programada,
              hora,
              notas,
              duracion_minutos,
              google_calendar_event_id,
              google_calendar_html_link,
              google_calendar_synced_at,
              google_calendar_sync_status,
              google_calendar_sync_error,
              created_at,
              updated_at
            `
          )
          .eq("empresa_id", empresaId)
          .order("fecha_programada", { ascending: true })
          .order("hora", { ascending: true }),
        supabase
          .from("tracker_contactos")
          .select(
            "id, empresa_id, asesor_id, nombre, apellido, telefono, telefono_whatsapp, email, tipologia, tipo_operacion, zona, direccion, estado, created_at"
          )
          .eq("empresa_id", empresaId)
          .order("created_at", { ascending: false }),
        supabase
          .from("asesores")
          .select("id, nombre, apellido, email")
          .eq("empresa_id", empresaId)
          .order("nombre", { ascending: true }),
      ]);

      if (actividadesRes.error) {
        console.error("Error cargando actividades agenda:", actividadesRes.error);
        showMessage("❌ No se pudieron cargar las actividades.");
      }
      if (contactosRes.error) {
        console.error("Error cargando contactos agenda:", contactosRes.error);
        showMessage("❌ No se pudieron cargar los contactos.");
      }
      if (asesoresRes.error) {
        console.error("Error cargando asesores agenda:", asesoresRes.error);
      }

      setActividades((actividadesRes.data as TrackerActividad[]) ?? []);
      setContactos((contactosRes.data as TrackerContacto[]) ?? []);
      setAsesores((asesoresRes.data as Asesor[]) ?? []);
    } catch (err) {
      console.error("Error inesperado cargando agenda:", err);
      showMessage("❌ Error inesperado al cargar la agenda.");
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
        console.error("Error buscando empresa para agenda:", error);
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
    fetchAgendaData();
  }, [empresaId, fetchAgendaData]);

  const actividadesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    return actividades.filter((a) => {
      if (!recordMatchesScope(a.asesor_id)) return false;
      if (tipoFiltro && a.tipo !== tipoFiltro) return false;

      if (q) {
        const contacto = contactoPorId(a.contacto_id);
        const haystack = [
          a.titulo,
          a.notas,
          labelTipoActividad(a.tipo),
          contactoNombre(contacto),
          contacto?.telefono,
          contacto?.telefono_whatsapp,
          contacto?.email,
          contacto?.zona,
          contacto?.direccion,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [actividades, scope, selectedAsesorId, tipoFiltro, busqueda, contactos]);

  const selectedDateKey = toDateKey(selectedDate);
  const hoy = startOfDay(new Date());
  const hoyKey = toDateKey(hoy);
  const mananaKey = toDateKey(addDays(hoy, 1));

  const actividadesByDateMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of actividadesFiltradas) {
      const key = dateKeyFromString(a.fecha_programada);
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [actividadesFiltradas]);

  const actividadesSelectedDate = useMemo(() => {
    return actividadesFiltradas.filter(
      (a) => dateKeyFromString(a.fecha_programada) === selectedDateKey
    );
  }, [actividadesFiltradas, selectedDateKey]);

  const actividadesHoy = useMemo(() => {
    return actividadesFiltradas.filter((a) => dateKeyFromString(a.fecha_programada) === hoyKey);
  }, [actividadesFiltradas, hoyKey]);

  const actividadesManana = useMemo(() => {
    return actividadesFiltradas.filter((a) => dateKeyFromString(a.fecha_programada) === mananaKey);
  }, [actividadesFiltradas, mananaKey]);

  const proximasActividades = useMemo(() => {
    const today = toDateKey(new Date());
    return actividadesFiltradas
      .filter((a) => dateKeyFromString(a.fecha_programada) >= today)
      .sort((a, b) => {
        const ak = `${dateKeyFromString(a.fecha_programada)} ${a.hora ?? "99:99"}`;
        const bk = `${dateKeyFromString(b.fecha_programada)} ${b.hora ?? "99:99"}`;
        return ak.localeCompare(bk);
      })
      .slice(0, 12);
  }, [actividadesFiltradas]);

  const openNuevaActividad = (date?: Date) => {
    const baseDate = date ?? selectedDate ?? new Date();
    setEditingActividad(null);
    setFormActividad({
      titulo: "",
      tipo: "seguimiento",
      fecha_programada: toDateKey(baseDate),
      hora: "",
      duracion_minutos: "30",
      asesor_id: scope === "asesores" && selectedAsesorId ? selectedAsesorId : "",
      contacto_id: "",
      notas: "",
    });
    setShowModal(true);
  };

  const openEditarActividad = (a: TrackerActividad) => {
    setEditingActividad(a);
    setFormActividad({
      titulo: a.titulo ?? "",
      tipo: a.tipo ?? "seguimiento",
      fecha_programada: dateKeyFromString(a.fecha_programada) || toDateKey(new Date()),
      hora: a.hora ? a.hora.substring(0, 5) : "",
      duracion_minutos: String(a.duracion_minutos ?? 30),
      asesor_id: a.asesor_id ?? "",
      contacto_id: a.contacto_id ?? "",
      notas: a.notas ?? "",
    });
    setShowModal(true);
  };

  const guardarActividad = async () => {
    if (!empresaId || saving) return;

    if (!formActividad.titulo.trim()) {
      showMessage("⚠️ Cargá un título para la actividad.");
      return;
    }

    if (!formActividad.fecha_programada) {
      showMessage("⚠️ Cargá la fecha de la actividad.");
      return;
    }

    setSaving(true);

    const payload = {
      empresa_id: empresaId,
      asesor_id: formActividad.asesor_id || null,
      contacto_id: formActividad.contacto_id || null,
      titulo: formActividad.titulo.trim(),
      tipo: formActividad.tipo,
      fecha_programada: formActividad.fecha_programada,
      hora: formActividad.hora || null,
      duracion_minutos: parseIntOrDefault(formActividad.duracion_minutos, 30),
      notas: formActividad.notas.trim() || null,
    };

    try {
      if (editingActividad) {
        const { error } = await supabase
          .from("tracker_actividades")
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
            // Si se edita una actividad ya sincronizada, la marcamos como pendiente de re-sync.
            google_calendar_sync_status: editingActividad.google_calendar_event_id
              ? "pendiente_actualizacion"
              : editingActividad.google_calendar_sync_status,
          })
          .eq("id", editingActividad.id)
          .eq("empresa_id", empresaId);

        if (error) {
          console.error("Error actualizando actividad:", error);
          showMessage("❌ No se pudo actualizar la actividad.");
          return;
        }
      } else {
        const { error } = await supabase.from("tracker_actividades").insert(payload);

        if (error) {
          console.error("Error creando actividad:", error);
          showMessage("❌ No se pudo crear la actividad.");
          return;
        }
      }

      showMessage("✅ Actividad guardada.");
      setShowModal(false);
      await fetchAgendaData();
    } catch (err) {
      console.error("Error guardando actividad:", err);
      showMessage("❌ Error inesperado al guardar actividad.");
    } finally {
      setSaving(false);
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
      await fetchAgendaData();
    } catch (err) {
      console.error("Error eliminando actividad:", err);
      showMessage("❌ Error inesperado al eliminar actividad.");
    }
  };

  const sincronizarGoogleCalendar = async (actividadId: string) => {
    setSyncingId(actividadId);
    try {
      const res = await fetch("/api/integrations/google/calendar/sync-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actividad_id: actividadId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401 || data?.needsConnection) {
          showMessage("⚠️ Primero conectá Google Calendar.");
        } else {
          showMessage(data?.error || "❌ No se pudo sincronizar con Google Calendar.");
        }
        return;
      }

      showMessage("✅ Evento creado/actualizado en Google Calendar.");
      await fetchAgendaData();
    } catch (err) {
      console.error("Error sincronizando Google Calendar:", err);
      showMessage("❌ Error inesperado al sincronizar Google Calendar.");
    } finally {
      setSyncingId(null);
    }
  };

  const monthMatrix = getMonthMatrix(currentMonth);

  if (loading && !empresaId) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-500">
        Cargando agenda…
      </div>
    );
  }

  if (!loading && (!user || user.role !== "empresa" || !empresaId)) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-500">
        No tenés acceso a la agenda de empresa.
      </div>
    );
  }

  const renderActividadCard = (a: TrackerActividad) => {
    const contacto = contactoPorId(a.contacto_id);
    const waNumber = contacto?.telefono_whatsapp || contacto?.telefono || "";
    const wa = whatsappUrl(waNumber);
    const googleSynced = !!a.google_calendar_event_id;

    return (
      <div key={a.id} className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-xs shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-slate-900 truncate">{a.titulo || "Actividad"}</p>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {labelTipoActividad(a.tipo)}
              </span>
              {googleSynced && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  Google Calendar
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {formatDateShort(a.fecha_programada)} · {formatTime(a.hora)} · {a.duracion_minutos ?? 30} min · {asesorNombre(a.asesor_id)}
            </p>
            <p className="mt-1 text-[11px] text-slate-600">
              Contacto: <span className="font-medium text-slate-800">{contactoNombre(contacto)}</span>
              {contacto?.telefono ? ` · ${contacto.telefono}` : ""}
            </p>
            {a.notas && <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">{a.notas}</p>}
            {a.google_calendar_sync_error && (
              <p className="mt-1 text-[10px] text-red-600">Google: {a.google_calendar_sync_error}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
              >
                WhatsApp
              </a>
            )}

            {a.google_calendar_html_link && (
              <a
                href={a.google_calendar_html_link}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
              >
                Ver Google
              </a>
            )}

            <button
              type="button"
              onClick={() => sincronizarGoogleCalendar(a.id)}
              disabled={syncingId === a.id}
              className="rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {syncingId === a.id ? "Sincronizando…" : googleSynced ? "Actualizar Google" : "Enviar a Google"}
            </button>

            <button
              type="button"
              onClick={() => openEditarActividad(a)}
              className="rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-gray-100"
            >
              Editar
            </button>

            <button
              type="button"
              onClick={() => eliminarActividad(a.id)}
              className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl xl:max-w-7xl mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Agenda</h1>
            <p className="mt-1 text-sm md:text-base text-slate-600 max-w-2xl">
              Organizá tareas, reuniones, prelistings y seguimientos. Abrí WhatsApp del cliente y sincronizá eventos con Google Calendar.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Vista:</span>
                <div className="inline-flex rounded-full border border-gray-300 bg-white p-0.5">
                  {[
                    { id: "empresa" as AgendaScope, label: "Empresa" },
                    { id: "asesores" as AgendaScope, label: "Asesores" },
                    { id: "global" as AgendaScope, label: "Global" },
                  ].map((opt) => {
                    const active = scope === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setScope(opt.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                          active ? "bg-black text-white" : "text-slate-700 hover:bg-gray-100"
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
                    value={selectedAsesorId}
                    onChange={(e) => setSelectedAsesorId(e.target.value)}
                    className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700"
                  >
                    <option value="">Todos</option>
                    {asesores.map((a) => (
                      <option key={a.id} value={a.id}>
                        {contactoNombre(a)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard/empresa/tracker"
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-gray-100"
              >
                Business Tracker
              </Link>
              <Link
                href="/dashboard/empresa/tracker-analytics"
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-gray-100"
              >
                Business Analytics
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/api/integrations/google/calendar/connect"
                className="rounded-full bg-black px-4 py-2 text-xs font-medium text-white hover:bg-slate-900"
              >
                Conectar Google Calendar
              </a>
              <button
                type="button"
                onClick={() => openNuevaActividad(selectedDate)}
                className="rounded-full bg-black px-4 py-2 text-xs font-medium text-white hover:bg-slate-900"
              >
                ＋ Nueva actividad
              </button>
            </div>
          </div>
        </header>

        {mensaje && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            {mensaje}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Hoy</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{actividadesHoy.length}</p>
            <p className="mt-1 text-[11px] text-slate-500">Actividades programadas para hoy.</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Mañana</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{actividadesManana.length}</p>
            <p className="mt-1 text-[11px] text-slate-500">Próximas tareas de mañana.</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Total filtrado</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{actividadesFiltradas.length}</p>
            <p className="mt-1 text-[11px] text-slate-500">Según vista, tipo y búsqueda.</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Próximas</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{proximasActividades.length}</p>
            <p className="mt-1 text-[11px] text-slate-500">Primeras próximas actividades visibles.</p>
          </div>
        </section>

        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                { id: "calendario" as AgendaView, label: "Calendario" },
                { id: "lista" as AgendaView, label: "Lista" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setView(opt.id)}
                  className={`rounded-full px-4 py-1.5 border text-sm transition ${
                    view === opt.id
                      ? "bg-black text-white border-black"
                      : "bg-white text-slate-700 border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">Tipo:</span>
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700"
              >
                <option value="">Todos</option>
                {ACTIVIDAD_TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar contacto, teléfono, nota…"
                className="w-64 max-w-full rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700"
              />
              <button
                type="button"
                onClick={fetchAgendaData}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-gray-100"
              >
                Actualizar
              </button>
            </div>
          </div>

          {view === "calendario" && (
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] items-start">
              <div className="rounded-2xl bg-white border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Calendario</p>
                    <p className="text-sm font-semibold text-slate-900 capitalize">
                      {currentMonth.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                      className="rounded-full border border-gray-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-gray-100"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                        setSelectedDate(startOfDay(now));
                      }}
                      className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-gray-100"
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                      className="rounded-full border border-gray-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-gray-100"
                    >
                      →
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 text-[11px] text-slate-500 mb-1">
                  {["L", "M", "M", "J", "V", "S", "D"].map((d) => (
                    <div key={d} className="py-1 text-center uppercase tracking-wide">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-rows-6 gap-y-1">
                  {monthMatrix.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-x-1">
                      {week.map((day, di) => {
                        const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                        const isSelected = isSameDay(day, selectedDate);
                        const key = toDateKey(day);
                        const count = actividadesByDateMap.get(key) ?? 0;

                        return (
                          <button
                            key={di}
                            type="button"
                            onClick={() => setSelectedDate(startOfDay(day))}
                            onDoubleClick={() => openNuevaActividad(day)}
                            className={`min-h-[54px] flex flex-col items-center justify-center rounded-lg border px-1.5 py-1.5 text-[11px] transition ${
                              isSelected
                                ? "border-black bg-black text-white"
                                : isCurrentMonth
                                ? "bg-white border-gray-200 text-slate-900 hover:bg-gray-50"
                                : "bg-gray-50 border-gray-200 text-slate-400 hover:bg-gray-100"
                            }`}
                          >
                            <span className="leading-none">{day.getDate()}</span>
                            {count > 0 && (
                              <span className="mt-1 inline-flex items-center rounded-full bg-[rgba(230,169,48,0.12)] px-1.5 py-0.5 text-[9px] font-medium text-[rgba(230,169,48,0.95)]">
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

              <div className="rounded-2xl bg-white border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Actividades del día</p>
                    <p className="text-sm font-semibold text-slate-900 capitalize">{formatDateLong(selectedDate)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openNuevaActividad(selectedDate)}
                    className="rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900"
                  >
                    ＋ Agregar
                  </button>
                </div>

                {actividadesSelectedDate.length === 0 ? (
                  <p className="text-xs text-slate-500">No hay actividades para esta fecha.</p>
                ) : (
                  <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                    {actividadesSelectedDate.map(renderActividadCard)}
                  </div>
                )}
              </div>
            </div>
          )}

          {view === "lista" && (
            <div className="space-y-3">
              {actividadesFiltradas.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">No hay actividades con los filtros seleccionados.</p>
              ) : (
                actividadesFiltradas
                  .slice()
                  .sort((a, b) => {
                    const ak = `${dateKeyFromString(a.fecha_programada)} ${a.hora ?? "99:99"}`;
                    const bk = `${dateKeyFromString(b.fecha_programada)} ${b.hora ?? "99:99"}`;
                    return ak.localeCompare(bk);
                  })
                  .map(renderActividadCard)
              )}
            </div>
          )}
        </section>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-gray-200">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {editingActividad ? "Editar actividad" : "Nueva actividad"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="max-h-[75vh] overflow-y-auto px-4 py-3 space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Título</label>
                  <input
                    value={formActividad.titulo}
                    onChange={(e) => setFormActividad((f) => ({ ...f, titulo: e.target.value }))}
                    placeholder="Ej: Seguimiento propietario Nueva Córdoba"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Tipo</label>
                    <select
                      value={formActividad.tipo}
                      onChange={(e) => setFormActividad((f) => ({ ...f, tipo: e.target.value as ActividadTipo }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                    >
                      {ACTIVIDAD_TIPOS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={formActividad.fecha_programada}
                      onChange={(e) => setFormActividad((f) => ({ ...f, fecha_programada: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Hora</label>
                    <input
                      type="time"
                      value={formActividad.hora}
                      onChange={(e) => setFormActividad((f) => ({ ...f, hora: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Duración</label>
                    <select
                      value={formActividad.duracion_minutos}
                      onChange={(e) => setFormActividad((f) => ({ ...f, duracion_minutos: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                    >
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">1 hora</option>
                      <option value="90">1 h 30 min</option>
                      <option value="120">2 horas</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Responsable</label>
                    <select
                      value={formActividad.asesor_id}
                      onChange={(e) => setFormActividad((f) => ({ ...f, asesor_id: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                    >
                      <option value="">Empresa</option>
                      {asesores.map((a) => (
                        <option key={a.id} value={a.id}>
                          {contactoNombre(a)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Contacto</label>
                    <select
                      value={formActividad.contacto_id}
                      onChange={(e) => setFormActividad((f) => ({ ...f, contacto_id: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                    >
                      <option value="">Sin contacto</option>
                      {contactos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {contactoNombre(c)}{c.telefono ? ` · ${c.telefono}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Notas</label>
                  <textarea
                    value={formActividad.notas}
                    onChange={(e) => setFormActividad((f) => ({ ...f, notas: e.target.value }))}
                    rows={4}
                    placeholder="Detalle de la tarea, dirección, objetivo de la reunión, próximos pasos…"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                  />
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
                  Guardá la actividad en VAI Prop. Luego podés enviarla a Google Calendar desde la tarjeta de la actividad.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardarActividad}
                  disabled={saving}
                  className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Guardar actividad"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
