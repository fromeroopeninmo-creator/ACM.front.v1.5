"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

type Embudo = {
  prospectos: number;
  contactados: number;
  reuniones: number;
  prelisting: number;
  evaluaciones: number;
  captaciones: number;
  cierres: number;
  conversion_pct: number;
};

type Metricas = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  activo: boolean;
  ultima_actividad_at: string | null;
  dias_activos: number;
  acciones_productivas: number;
  prospectos: number;
  contactados: number;
  actividades: number;
  reuniones_registradas: number;
  muestras: number;
  reservas: number;
  informes_vai: number;
  informes_factibilidad: number;
  informes_totales: number;
  propiedades_captadas: number;
  cierres_propios: number;
  cierres_terceros: number;
  cierres_totales: number;
  conversion_embudo_pct: number;
};

type Detalle = {
  metricas: Metricas;
  embudo: Embudo;
  evolucion_semanal: Array<{
    semana_desde: string;
    prospectos: number;
    actividades: number;
    propiedades_captadas: number;
    cierres_operativos: number;
  }>;
  ultimos_movimientos: Array<{
    fecha: string;
    tipo: string;
    descripcion: string;
  }>;
};

type ResponseData = {
  periodo: { fecha_desde: string; fecha_hasta: string };
  detalle_asesor: Detalle | null;
};

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function defaultPeriod() {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(hasta.getDate() - 90);
  return { desde: dateKey(desde), hasta: dateKey(hasta) };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string | null) {
  if (!value) return "Sin actividad registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin actividad registrada";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function Card({ title, value, detail }: { title: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-xs leading-5 text-gray-500">{detail}</p>
    </div>
  );
}

function Funnel({ data }: { data: Embudo }) {
  const stages = [
    ["Prospectos", data.prospectos],
    ["Contactados", data.contactados],
    ["Reuniones", data.reuniones],
    ["Prelisting", data.prelisting],
    ["Evaluaciones", data.evaluaciones],
    ["Captaciones", data.captaciones],
    ["Cierres", data.cierres],
  ] as const;
  const max = Math.max(...stages.map(([, n]) => n), 1);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="mb-5 flex justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Embudo comercial</h2><p className="mt-1 text-sm text-gray-500">Etapa máxima alcanzada por los contactos del período.</p></div>
        <div className="rounded-xl bg-[#E6A930]/10 px-4 py-2 text-right"><p className="text-xs text-gray-500">Conversión</p><p className="font-semibold">{data.conversion_pct.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%</p></div>
      </div>
      <div className="space-y-4">
        {stages.map(([label, value]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{label}</span><span className="font-semibold">{value}</span></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full rounded-full bg-[#E6A930]" style={{ width: `${Math.max((value / max) * 100, value ? 4 : 0)}%` }} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AsesorDetallePage() {
  const { user } = useAuth();
  const params = useParams();
  const search = useSearchParams();
  const asesorId = String(params?.asesorId || "");
  const initial = useMemo(defaultPeriod, []);
  const [fechaDesde, setFechaDesde] = useState(search.get("fecha_desde") || initial.desde);
  const [fechaHasta, setFechaHasta] = useState(search.get("fecha_hasta") || initial.hasta);
  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !asesorId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("La sesión expiró. Volvé a iniciar sesión.");

      const query = new URLSearchParams({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta, asesor_id: asesorId });
      if (user.role !== "empresa" && user.empresa_id) query.set("empresa_id", user.empresa_id);

      const response = await fetch(`/api/empresa/asesores/rendimiento?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "No se pudo cargar el detalle.");
      setData(payload.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el detalle.");
    } finally {
      setLoading(false);
    }
  }, [asesorId, fechaDesde, fechaHasta, user]);

  useEffect(() => { load(); }, [load]);

  const detalle = data?.detalle_asesor;
  const m = detalle?.metricas;

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <Link href={`/dashboard/empresa/asesores?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`} className="text-sm font-medium text-gray-500">← Volver al equipo</Link>
          <h1 className="mt-3 text-2xl font-semibold">{m ? `${m.nombre} ${m.apellido}` : "Detalle del asesor"}</h1>
          {m && <p className="mt-1 text-sm text-gray-500">{m.email}{m.telefono ? ` · ${m.telefono}` : ""}</p>}
        </div>
        {m && <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${m.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{m.activo ? "Asesor activo" : "Asesor inactivo"}</span>}
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="text-sm">Desde<input type="date" value={fechaDesde} max={fechaHasta} onChange={(e) => setFechaDesde(e.target.value)} className="mt-1 block rounded-lg border bg-transparent px-3 py-2" /></label>
          <label className="text-sm">Hasta<input type="date" value={fechaHasta} min={fechaDesde} onChange={(e) => setFechaHasta(e.target.value)} className="mt-1 block rounded-lg border bg-transparent px-3 py-2" /></label>
          <button onClick={load} className="rounded-lg bg-[#E6A930] px-4 py-2 text-sm font-semibold text-black">Actualizar</button>
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? <div className="rounded-2xl border p-10 text-center text-gray-500">Cargando detalle...</div> : !detalle || !m ? <div className="rounded-2xl border p-10 text-center text-gray-500">No se encontró información para este asesor.</div> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card title="Prospectos" value={m.prospectos} detail={`${m.contactados} alcanzaron contacto.`} />
            <Card title="Actividades" value={m.actividades} detail={`${m.reuniones_registradas} reuniones · ${m.muestras} muestras.`} />
            <Card title="Informes" value={m.informes_totales} detail={`${m.informes_vai} VAI · ${m.informes_factibilidad} factibilidad.`} />
            <Card title="Propiedades captadas" value={m.propiedades_captadas} detail="Propiedades propias registradas en el período." />
            <Card title="Cierres propios" value={m.cierres_propios} detail="Cierres propios durante el período." />
            <Card title="Cierres de terceros" value={m.cierres_terceros} detail="Operaciones cerradas con propiedades de terceros." />
            <Card title="Días activos" value={m.dias_activos} detail={`${m.acciones_productivas} acciones productivas.`} />
            <Card title="Última actividad" value={formatDateTime(m.ultima_actividad_at)} detail={`Conversión: ${m.conversion_embudo_pct.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%.`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Funnel data={detalle.embudo} />
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <h2 className="text-lg font-semibold">Evolución semanal</h2>
              <p className="mt-1 text-sm text-gray-500">Actividad registrada dentro del período.</p>
              <div className="mt-5 max-h-[470px] space-y-3 overflow-y-auto">
                {detalle.evolucion_semanal.map((week) => (
                  <div key={week.semana_desde} className="rounded-xl border p-4 dark:border-gray-800">
                    <p className="text-sm font-semibold">Semana del {formatDate(week.semana_desde)}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-gray-500">Prospectos</p><b>{week.prospectos}</b></div>
                      <div><p className="text-gray-500">Actividades</p><b>{week.actividades}</b></div>
                      <div><p className="text-gray-500">Propiedades</p><b>{week.propiedades_captadas}</b></div>
                      <div><p className="text-gray-500">Cierres</p><b>{week.cierres_operativos}</b></div>
                    </div>
                  </div>
                ))}
                {!detalle.evolucion_semanal.length && <p className="py-8 text-center text-sm text-gray-500">No hay evolución para mostrar.</p>}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <h2 className="text-lg font-semibold">Últimos movimientos</h2>
            <p className="mt-1 text-sm text-gray-500">Acciones recientes registradas por el asesor.</p>
            <div className="mt-5 divide-y dark:divide-gray-800">
              {detalle.ultimos_movimientos.map((mov, i) => (
                <div key={`${mov.fecha}-${i}`} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-medium">{mov.descripcion}</p><p className="mt-1 text-xs uppercase tracking-wide text-gray-500">{mov.tipo.replaceAll("_", " ")}</p></div>
                  <p className="text-sm text-gray-500">{formatDateTime(mov.fecha)}</p>
                </div>
              ))}
              {!detalle.ultimos_movimientos.length && <p className="py-8 text-center text-sm text-gray-500">No hay movimientos para mostrar.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
