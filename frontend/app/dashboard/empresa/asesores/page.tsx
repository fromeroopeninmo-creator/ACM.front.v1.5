"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import NewAsesorForm from "./NewAsesorForm";

type PeriodPreset = "30" | "90" | "180" | "365";

type SortOption =
  | "ultima_actividad_asc"
  | "ultima_actividad_desc"
  | "cierres_desc"
  | "captaciones_desc"
  | "prospectos_desc"
  | "actividades_desc"
  | "informes_desc"
  | "conversion_desc"
  | "nombre_asc";

type ActivityFilter =
  | "todos"
  | "reciente"
  | "sin_reciente"
  | "sin_actividad";

interface Embudo {
  prospectos: number;
  contactados: number;
  reuniones: number;
  prelisting: number;
  evaluaciones: number;
  captaciones: number;
  cierres: number;
  conversion_pct: number;
}

interface AsesorRendimiento {
  id: string;
  empresa_id: string;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  email: string;
  telefono: string;
  activo: boolean;
  fecha_creacion: string;
  ultima_actividad_at: string | null;
  dias_activos: number;
  acciones_productivas: number;
  prospectos: number;
  contactados: number;
  actividades: number;
  informes_vai: number;
  informes_factibilidad: number;
  informes_totales: number;
  propiedades_captadas: number;
  captaciones: number;
  cierres_propios: number;
  cierres_terceros: number;
  cierres_totales: number;
  conversion_embudo_pct: number;
  embudo: Embudo;
}

interface ResumenGeneral {
  asesores_totales: number;
  asesores_activos: number;
  asesores_inactivos: number;
  asesores_con_actividad: number;
  asesores_sin_actividad: number;
  prospectos: number;
  contactados: number;
  actividades: number;
  informes_vai: number;
  informes_factibilidad: number;
  informes_totales: number;
  propiedades_captadas: number;
  cierres_propios: number;
  cierres_terceros: number;
  cierres_totales: number;
  dias_activos_acumulados: number;
  ultima_actividad_equipo: string | null;
}

interface RendimientoData {
  periodo: {
    fecha_desde: string;
    fecha_hasta: string;
  };
  resumen_general: ResumenGeneral;
  embudo_general: Omit<
    Embudo,
    "conversion_pct"
  > & {
    conversion_general_pct: number;
  };
  asesores: AsesorRendimiento[];
  detalle_asesor: null;
}

const EMPTY_RESUMEN: ResumenGeneral = {
  asesores_totales: 0,
  asesores_activos: 0,
  asesores_inactivos: 0,
  asesores_con_actividad: 0,
  asesores_sin_actividad: 0,
  prospectos: 0,
  contactados: 0,
  actividades: 0,
  informes_vai: 0,
  informes_factibilidad: 0,
  informes_totales: 0,
  propiedades_captadas: 0,
  cierres_propios: 0,
  cierres_terceros: 0,
  cierres_totales: 0,
  dias_activos_acumulados: 0,
  ultima_actividad_equipo: null,
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getPeriod(days: number) {
  const hasta = new Date();
  const desde = new Date();

  desde.setDate(hasta.getDate() - days);

  return {
    fechaDesde: toDateKey(desde),
    fechaHasta: toDateKey(hasta),
  };
}

function formatDateTime(value: string | null): string {
  if (!value) return "Sin actividad";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin actividad";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getDaysSinceActivity(
  value: string | null
): number | null {
  if (!value) return null;

  const time = new Date(value).getTime();

  if (Number.isNaN(time)) return null;

  return Math.floor(
    (Date.now() - time) / 86_400_000
  );
}

function getActivityLabel(
  value: string | null
): {
  text: string;
  className: string;
} {
  const days = getDaysSinceActivity(value);

  if (days === null) {
    return {
      text: "Sin actividad",
      className:
        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    };
  }

  if (days <= 7) {
    return {
      text: "Actividad reciente",
      className:
        "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
    };
  }

  if (days <= 30) {
    return {
      text: "Actividad moderada",
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    };
  }

  return {
    text: `Hace ${days} días`,
    className:
      "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  };
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 dark:border-gray-800 dark:bg-gray-950">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-2 break-words text-2xl font-semibold text-gray-950 sm:text-3xl dark:text-white">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
        {helper}
      </p>
    </div>
  );
}

function Funnel({
  data,
}: {
  data: RendimientoData["embudo_general"] | null;
}) {
  const stages = [
    ["Prospectos", data?.prospectos || 0],
    ["Contactados", data?.contactados || 0],
    ["Reuniones", data?.reuniones || 0],
    ["Prelisting", data?.prelisting || 0],
    ["Evaluaciones", data?.evaluaciones || 0],
    ["Captaciones", data?.captaciones || 0],
    ["Cierres", data?.cierres || 0],
  ] as const;

  const max = Math.max(
    ...stages.map(([, value]) => value),
    1
  );

  return (
    <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-950 dark:text-white">
            Embudo comercial del equipo
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Etapas acumulativas basadas en contactos.
          </p>
        </div>

        <div className="shrink-0 rounded-xl bg-[#E6A930]/10 px-4 py-2 text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Conversión a cierre
          </p>
          <p className="font-semibold text-gray-950 dark:text-white">
            {(data?.conversion_general_pct || 0).toLocaleString(
              "es-AR",
              {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              }
            )}
            %
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {stages.map(([label, value]) => {
          const width = Math.max(
            (value / max) * 100,
            value > 0 ? 4 : 0
          );

          return (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {label}
                </span>
                <span className="font-semibold text-gray-950 dark:text-white">
                  {value}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-full rounded-full bg-[#E6A930] transition-all"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AsesoresPage() {
  const { user } = useAuth();

  const initialPeriod = useMemo(
    () => getPeriod(90),
    []
  );

  const [preset, setPreset] =
    useState<PeriodPreset>("90");

  const [fechaDesde, setFechaDesde] = useState(
    initialPeriod.fechaDesde
  );

  const [fechaHasta, setFechaHasta] = useState(
    initialPeriod.fechaHasta
  );

  const [data, setData] =
    useState<RendimientoData | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);

  const [sortOption, setSortOption] =
    useState<SortOption>("ultima_actividad_asc");

  const [activityFilter, setActivityFilter] =
    useState<ActivityFilter>("todos");

  const role = user?.role || "";

  const noAutorizado = useMemo(
    () =>
      !user
      || (
        role !== "empresa"
        && role !== "super_admin"
        && role !== "super_admin_root"
        && role !== "soporte"
      ),
    [role, user]
  );

  const fetchRendimiento = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError
        || !session?.access_token
      ) {
        throw new Error(
          "La sesión expiró. Volvé a iniciar sesión."
        );
      }

      const params = new URLSearchParams({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      });

      if (
        role !== "empresa"
        && user?.empresa_id
      ) {
        params.set(
          "empresa_id",
          user.empresa_id
        );
      }

      const response = await fetch(
        `/api/empresa/asesores/rendimiento?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        }
      );

      const payload = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload?.error
          || "No se pudo cargar el rendimiento."
        );
      }

      setData(payload.data as RendimientoData);
    } catch (fetchError) {
      console.error(
        "Error cargando rendimiento:",
        fetchError
      );

      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudo cargar el rendimiento."
      );
    } finally {
      setLoading(false);
    }
  }, [
    fechaDesde,
    fechaHasta,
    role,
    user?.empresa_id,
  ]);

  useEffect(() => {
    if (!user || noAutorizado) return;
    fetchRendimiento();
  }, [
    fetchRendimiento,
    noAutorizado,
    user,
  ]);

  const applyPreset = (value: PeriodPreset) => {
    const period = getPeriod(Number(value));

    setPreset(value);
    setFechaDesde(period.fechaDesde);
    setFechaHasta(period.fechaHasta);
  };

  const toggleActivo = async (
    id: string,
    current: boolean
  ) => {
    const { error: updateError } = await supabase
      .from("asesores")
      .update({ activo: !current })
      .eq("id", id);

    if (updateError) {
      setError(
        "No se pudo actualizar el estado del asesor."
      );
      return;
    }

    await fetchRendimiento();
  };

  const eliminarAsesor = async (id: string) => {
    const confirmed = window.confirm(
      "¿Seguro que deseas eliminar este asesor? Esta acción puede fallar si tiene información relacionada."
    );

    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("asesores")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(
        "No se pudo eliminar el asesor. Puede tener registros asociados."
      );
      return;
    }

    await fetchRendimiento();
  };

  const asesoresOrdenados = useMemo(() => {
    const source = [...(data?.asesores || [])];

    const filtered = source.filter((asesor) => {
      const days = getDaysSinceActivity(
        asesor.ultima_actividad_at
      );

      if (activityFilter === "reciente") {
        return days !== null && days <= 7;
      }

      if (activityFilter === "sin_reciente") {
        return days !== null && days > 30;
      }

      if (activityFilter === "sin_actividad") {
        return days === null;
      }

      return true;
    });

    filtered.sort((a, b) => {
      if (sortOption === "ultima_actividad_asc") {
        if (!a.ultima_actividad_at && !b.ultima_actividad_at) {
          return a.nombre_completo.localeCompare(
            b.nombre_completo,
            "es"
          );
        }

        if (!a.ultima_actividad_at) return -1;
        if (!b.ultima_actividad_at) return 1;

        return (
          new Date(a.ultima_actividad_at).getTime()
          - new Date(b.ultima_actividad_at).getTime()
        );
      }

      if (sortOption === "ultima_actividad_desc") {
        if (!a.ultima_actividad_at && !b.ultima_actividad_at) {
          return a.nombre_completo.localeCompare(
            b.nombre_completo,
            "es"
          );
        }

        if (!a.ultima_actividad_at) return 1;
        if (!b.ultima_actividad_at) return -1;

        return (
          new Date(b.ultima_actividad_at).getTime()
          - new Date(a.ultima_actividad_at).getTime()
        );
      }

      if (sortOption === "cierres_desc") {
        return b.cierres_totales - a.cierres_totales;
      }

      if (sortOption === "captaciones_desc") {
        return (
          b.propiedades_captadas
          - a.propiedades_captadas
        );
      }

      if (sortOption === "prospectos_desc") {
        return b.prospectos - a.prospectos;
      }

      if (sortOption === "actividades_desc") {
        return b.actividades - a.actividades;
      }

      if (sortOption === "informes_desc") {
        return b.informes_totales - a.informes_totales;
      }

      if (sortOption === "conversion_desc") {
        return (
          b.conversion_embudo_pct
          - a.conversion_embudo_pct
        );
      }

      return a.nombre_completo.localeCompare(
        b.nombre_completo,
        "es"
      );
    });

    return filtered;
  }, [
    activityFilter,
    data?.asesores,
    sortOption,
  ]);

  if (noAutorizado) {
    return (
      <div className="p-6 text-center text-gray-500">
        No autorizado.
      </div>
    );
  }

  const resumen =
    data?.resumen_general || EMPTY_RESUMEN;

  const empresaId =
    data?.asesores?.[0]?.empresa_id
    || user?.empresa_id
    || null;

  return (
    <div className="w-full min-w-0 space-y-6 overflow-x-hidden pb-10">
      <div className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-950 dark:text-white">
            Equipo y rendimiento
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">
            Seguimiento práctico de actividad, uso de herramientas y avance comercial del equipo.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          disabled={!empresaId}
          className="w-full rounded-xl bg-[#E6A930] px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {showForm ? "Cancelar" : "Nuevo asesor"}
        </button>
      </div>

      {showForm && empresaId && (
        <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 dark:border-gray-800 dark:bg-gray-950">
          <NewAsesorForm
            empresaId={empresaId}
            onCreated={async () => {
              setShowForm(false);
              await fetchRendimiento();
            }}
          />
        </div>
      )}

      <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Período de análisis
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {([
                ["30", "30 días"],
                ["90", "3 meses"],
                ["180", "6 meses"],
                ["365", "12 meses"],
              ] as const).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => applyPreset(value)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    preset === value
                      ? "bg-[#E6A930] text-black"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className="min-w-0 text-sm text-gray-600 dark:text-gray-300">
              Desde
              <input
                type="date"
                value={fechaDesde}
                max={fechaHasta}
                onChange={(event) => {
                  setFechaDesde(event.target.value);
                }}
                className="mt-1 block w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </label>

            <label className="min-w-0 text-sm text-gray-600 dark:text-gray-300">
              Hasta
              <input
                type="date"
                value={fechaHasta}
                min={fechaDesde}
                onChange={(event) => {
                  setFechaHasta(event.target.value);
                }}
                className="mt-1 block w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </label>

            <button
              type="button"
              onClick={fetchRendimiento}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 sm:w-auto dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-900"
            >
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          Cargando rendimiento del equipo...
        </div>
      ) : (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Asesores activos"
              value={resumen.asesores_activos}
              helper={`${resumen.asesores_con_actividad} con actividad en el período.`}
            />
            <MetricCard
              label="Prospectos"
              value={resumen.prospectos}
              helper={`${resumen.contactados} alcanzaron contacto.`}
            />
            <MetricCard
              label="Propiedades captadas"
              value={resumen.propiedades_captadas}
              helper="Producción propia registrada durante el período."
            />
            <MetricCard
              label="Cierres operativos"
              value={resumen.cierres_totales}
              helper={`${resumen.cierres_propios} propios · ${resumen.cierres_terceros} de terceros.`}
            />
            <MetricCard
              label="Actividades"
              value={resumen.actividades}
              helper="Seguimientos, reuniones, muestras y otras acciones."
            />
            <MetricCard
              label="Informes"
              value={resumen.informes_totales}
              helper={`${resumen.informes_vai} VAI · ${resumen.informes_factibilidad} de factibilidad.`}
            />
            <MetricCard
              label="Días activos"
              value={resumen.dias_activos_acumulados}
              helper="Suma de días con acciones productivas del equipo."
            />
            <MetricCard
              label="Última actividad"
              value={
                resumen.ultima_actividad_equipo
                  ? formatDateTime(
                      resumen.ultima_actividad_equipo
                    )
                  : "Sin actividad"
              }
              helper={`${resumen.asesores_sin_actividad} asesores sin actividad en el período.`}
            />
          </div>

          <div className="hidden lg:block">
            <Funnel data={data?.embudo_general || null} />
          </div>

          <div className="min-w-0 rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="border-b border-gray-200 px-4 py-4 sm:px-5 dark:border-gray-800">
              <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-950 dark:text-white">
                    Rendimiento por asesor
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    En pantallas chicas se muestran los indicadores principales. El detalle completo está dentro de cada asesor.
                  </p>
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="min-w-0 text-sm text-gray-600 dark:text-gray-300">
                    Ordenar por
                    <select
                      value={sortOption}
                      onChange={(event) =>
                        setSortOption(
                          event.target.value as SortOption
                        )
                      }
                      className="mt-1 block w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    >
                      <option value="ultima_actividad_asc">
                        Menor actividad reciente
                      </option>
                      <option value="ultima_actividad_desc">
                        Mayor actividad reciente
                      </option>
                      <option value="cierres_desc">
                        Más cierres
                      </option>
                      <option value="captaciones_desc">
                        Más propiedades captadas
                      </option>
                      <option value="prospectos_desc">
                        Más prospectos
                      </option>
                      <option value="actividades_desc">
                        Más actividades
                      </option>
                      <option value="informes_desc">
                        Más informes
                      </option>
                      <option value="conversion_desc">
                        Mayor conversión
                      </option>
                      <option value="nombre_asc">
                        Nombre A–Z
                      </option>
                    </select>
                  </label>

                  <label className="min-w-0 text-sm text-gray-600 dark:text-gray-300">
                    Filtrar actividad
                    <select
                      value={activityFilter}
                      onChange={(event) =>
                        setActivityFilter(
                          event.target.value as ActivityFilter
                        )
                      }
                      className="mt-1 block w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    >
                      <option value="todos">
                        Todos
                      </option>
                      <option value="reciente">
                        Actividad reciente
                      </option>
                      <option value="sin_reciente">
                        Sin actividad reciente
                      </option>
                      <option value="sin_actividad">
                        Nunca registró actividad
                      </option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 p-4 lg:hidden">
              {asesoresOrdenados.map((asesor) => {
                const activity = getActivityLabel(
                  asesor.ultima_actividad_at
                );

                return (
                  <article
                    key={asesor.id}
                    className="min-w-0 rounded-2xl border border-gray-200 p-4 dark:border-gray-800"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-950 dark:text-white">
                          {asesor.nombre_completo}
                        </p>
                        <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                          {asesor.email}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          asesor.activo
                            ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                            : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                        }`}
                      >
                        {asesor.activo
                          ? "Activo"
                          : "Inactivo"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
                        <p className="text-xs text-gray-500">
                          Prospectos
                        </p>
                        <p className="mt-1 text-lg font-semibold">
                          {asesor.prospectos}
                        </p>
                      </div>

                      <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
                        <p className="text-xs text-gray-500">
                          Propiedades
                        </p>
                        <p className="mt-1 text-lg font-semibold">
                          {asesor.propiedades_captadas}
                        </p>
                      </div>

                      <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
                        <p className="text-xs text-gray-500">
                          Cierres
                        </p>
                        <p className="mt-1 text-lg font-semibold">
                          {asesor.cierres_totales}
                        </p>
                      </div>

                      <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
                        <p className="text-xs text-gray-500">
                          Conversión
                        </p>
                        <p className="mt-1 text-lg font-semibold">
                          {asesor.conversion_embudo_pct.toLocaleString(
                            "es-AR",
                            {
                              maximumFractionDigits: 2,
                            }
                          )}
                          %
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs text-gray-500">
                        Última actividad
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                        {formatDateTime(
                          asesor.ultima_actividad_at
                        )}
                      </p>
                      <span
                        className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-medium ${activity.className}`}
                      >
                        {activity.text}
                      </span>
                    </div>

                    <Link
                      href={`/dashboard/empresa/asesores/${asesor.id}?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`}
                      className="mt-4 flex w-full items-center justify-center rounded-xl border border-[#E6A930] px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-[#E6A930]/10 dark:text-white"
                    >
                      Ver detalle
                    </Link>
                  </article>
                );
              })}

              {asesoresOrdenados.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700">
                  No hay asesores que coincidan con el filtro.
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1120px]">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      Asesor
                    </th>
                    <th className="px-4 py-3 text-center">
                      Prospectos
                    </th>
                    <th className="px-4 py-3 text-center">
                      Actividades
                    </th>
                    <th className="px-4 py-3 text-center">
                      Informes
                    </th>
                    <th className="px-4 py-3 text-center">
                      Propiedades
                    </th>
                    <th className="px-4 py-3 text-center">
                      Cierres
                    </th>
                    <th className="px-4 py-3 text-center">
                      Conversión
                    </th>
                    <th className="px-4 py-3 text-left">
                      Última actividad
                    </th>
                    <th className="px-4 py-3 text-center">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {asesoresOrdenados.map((asesor) => {
                    const activity =
                      getActivityLabel(
                        asesor.ultima_actividad_at
                      );

                    return (
                      <tr
                        key={asesor.id}
                        className="border-t border-gray-100 text-sm dark:border-gray-800"
                      >
                        <td className="px-4 py-4">
                          <p className="font-semibold text-gray-950 dark:text-white">
                            {asesor.nombre_completo}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {asesor.email}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-center font-medium">
                          {asesor.prospectos}
                        </td>
                        <td className="px-4 py-4 text-center font-medium">
                          {asesor.actividades}
                        </td>
                        <td className="px-4 py-4 text-center font-medium">
                          {asesor.informes_totales}
                        </td>
                        <td className="px-4 py-4 text-center font-medium">
                          {asesor.propiedades_captadas}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <p className="font-semibold">
                            {asesor.cierres_totales}
                          </p>
                          <p className="text-xs text-gray-500">
                            {asesor.cierres_propios} propios ·{" "}
                            {asesor.cierres_terceros} terceros
                          </p>
                        </td>
                        <td className="px-4 py-4 text-center font-semibold">
                          {asesor.conversion_embudo_pct.toLocaleString(
                            "es-AR",
                            {
                              maximumFractionDigits: 2,
                            }
                          )}
                          %
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-gray-800 dark:text-gray-200">
                            {formatDateTime(
                              asesor.ultima_actividad_at
                            )}
                          </p>
                          <span
                            className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-medium ${activity.className}`}
                          >
                            {activity.text}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              toggleActivo(
                                asesor.id,
                                asesor.activo
                              )
                            }
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              asesor.activo
                                ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                                : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                            }`}
                          >
                            {asesor.activo
                              ? "Activo"
                              : "Inactivo"}
                          </button>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/dashboard/empresa/asesores/${asesor.id}?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`}
                              className="rounded-lg border border-[#E6A930] px-3 py-2 text-xs font-semibold text-gray-900 transition hover:bg-[#E6A930]/10 dark:text-white"
                            >
                              Ver detalle
                            </Link>
                            <button
                              type="button"
                              onClick={() =>
                                eliminarAsesor(asesor.id)
                              }
                              className="rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {asesoresOrdenados.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-5 py-10 text-center text-gray-500"
                      >
                        No hay asesores que coincidan con el filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
