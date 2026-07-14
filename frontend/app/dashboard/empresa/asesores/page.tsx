"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import NewAsesorForm from "./NewAsesorForm";

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

type Asesor = {
  id: string;
  empresa_id: string;
  nombre_completo: string;
  email: string;
  telefono: string;
  activo: boolean;
  ultima_actividad_at: string | null;
  dias_activos: number;
  acciones_productivas: number;
  prospectos: number;
  actividades: number;
  informes_totales: number;
  propiedades_captadas: number;
  cierres_propios: number;
  cierres_terceros: number;
  cierres_totales: number;
  conversion_embudo_pct: number;
  embudo: Embudo;
};

type Rendimiento = {
  periodo: { fecha_desde: string; fecha_hasta: string };
  resumen_general: {
    asesores_totales: number;
    asesores_activos: number;
    asesores_con_actividad: number;
    asesores_sin_actividad: number;
    prospectos: number;
    actividades: number;
    informes_totales: number;
    propiedades_captadas: number;
    cierres_propios: number;
    cierres_terceros: number;
    cierres_totales: number;
    dias_activos_acumulados: number;
    ultima_actividad_equipo: string | null;
  };
  embudo_general: Embudo & { conversion_general_pct: number };
  asesores: Asesor[];
};

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function period(days: number) {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(hasta.getDate() - days);
  return { desde: dateKey(desde), hasta: dateKey(hasta) };
}

function formatDateTime(value: string | null) {
  if (!value) return "Sin actividad";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin actividad";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function Card({ title, value, detail }: { title: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-950 dark:text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">{detail}</p>
    </div>
  );
}

function Funnel({ data }: { data: Rendimiento["embudo_general"] | null }) {
  const stages = [
    ["Prospectos", data?.prospectos || 0],
    ["Contactados", data?.contactados || 0],
    ["Reuniones", data?.reuniones || 0],
    ["Prelisting", data?.prelisting || 0],
    ["Evaluaciones", data?.evaluaciones || 0],
    ["Captaciones", data?.captaciones || 0],
    ["Cierres", data?.cierres || 0],
  ] as const;
  const max = Math.max(...stages.map(([, n]) => n), 1);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-950 dark:text-white">Embudo comercial del equipo</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Etapas acumulativas basadas en contactos.</p>
        </div>
        <div className="rounded-xl bg-[#E6A930]/10 px-4 py-2 text-right">
          <p className="text-xs text-gray-500">Conversión a cierre</p>
          <p className="font-semibold">{(data?.conversion_general_pct || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%</p>
        </div>
      </div>
      <div className="space-y-4">
        {stages.map(([label, value]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium">{label}</span>
              <span className="font-semibold">{value}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div className="h-full rounded-full bg-[#E6A930]" style={{ width: `${Math.max((value / max) * 100, value ? 4 : 0)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AsesoresPage() {
  const { user } = useAuth();
  const initial = useMemo(() => period(90), []);
  const [fechaDesde, setFechaDesde] = useState(initial.desde);
  const [fechaHasta, setFechaHasta] = useState(initial.hasta);
  const [data, setData] = useState<Rendimiento | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const role = user?.role || "";
  const authorized = ["empresa", "soporte", "super_admin", "super_admin_root"].includes(role);

  const load = useCallback(async () => {
    if (!user || !authorized) return;
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("La sesión expiró. Volvé a iniciar sesión.");

      const params = new URLSearchParams({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta });
      if (role !== "empresa" && user.empresa_id) params.set("empresa_id", user.empresa_id);

      const response = await fetch(`/api/empresa/asesores/rendimiento?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "No se pudo cargar el rendimiento.");
      setData(payload.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el rendimiento.");
    } finally {
      setLoading(false);
    }
  }, [authorized, fechaDesde, fechaHasta, role, user]);

  useEffect(() => { load(); }, [load]);

  const choosePeriod = (days: number) => {
    const next = period(days);
    setFechaDesde(next.desde);
    setFechaHasta(next.hasta);
  };

  const toggleActivo = async (asesor: Asesor) => {
    const { error: updateError } = await supabase.from("asesores").update({ activo: !asesor.activo }).eq("id", asesor.id);
    if (updateError) setError("No se pudo actualizar el estado del asesor.");
    else await load();
  };

  const deleteAsesor = async (asesor: Asesor) => {
    if (!window.confirm(`¿Eliminar a ${asesor.nombre_completo}?`)) return;
    const { error: deleteError } = await supabase.from("asesores").delete().eq("id", asesor.id);
    if (deleteError) setError("No se pudo eliminar el asesor. Puede tener información relacionada.");
    else await load();
  };

  if (!user || !authorized) return <div className="p-6 text-center text-gray-500">No autorizado.</div>;

  const r = data?.resumen_general;
  const empresaId = data?.asesores?.[0]?.empresa_id || user.empresa_id || null;

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950 dark:text-white">Equipo y rendimiento</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Actividad, uso de herramientas y avance comercial del equipo.</p>
        </div>
        <button disabled={!empresaId} onClick={() => setShowForm((v) => !v)} className="rounded-xl bg-[#E6A930] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50">
          {showForm ? "Cancelar" : "Nuevo asesor"}
        </button>
      </header>

      {showForm && empresaId && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <NewAsesorForm empresaId={empresaId} onCreated={async () => { setShowForm(false); await load(); }} />
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {[30, 90, 180, 365].map((days) => (
              <button key={days} onClick={() => choosePeriod(days)} className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium hover:bg-[#E6A930] dark:bg-gray-800">
                {days === 30 ? "30 días" : days === 90 ? "3 meses" : days === 180 ? "6 meses" : "12 meses"}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="text-sm">Desde<input type="date" value={fechaDesde} max={fechaHasta} onChange={(e) => setFechaDesde(e.target.value)} className="mt-1 block rounded-lg border bg-transparent px-3 py-2" /></label>
            <label className="text-sm">Hasta<input type="date" value={fechaHasta} min={fechaDesde} onChange={(e) => setFechaHasta(e.target.value)} className="mt-1 block rounded-lg border bg-transparent px-3 py-2" /></label>
            <button onClick={load} className="rounded-lg border px-4 py-2 text-sm font-semibold">Actualizar</button>
          </div>
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? <div className="rounded-2xl border p-10 text-center text-gray-500">Cargando rendimiento...</div> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card title="Asesores activos" value={r?.asesores_activos || 0} detail={`${r?.asesores_con_actividad || 0} con actividad en el período.`} />
            <Card title="Prospectos" value={r?.prospectos || 0} detail="Contactos nuevos del período." />
            <Card title="Propiedades captadas" value={r?.propiedades_captadas || 0} detail="Producción propia registrada." />
            <Card title="Cierres operativos" value={r?.cierres_totales || 0} detail={`${r?.cierres_propios || 0} propios · ${r?.cierres_terceros || 0} de terceros.`} />
            <Card title="Actividades" value={r?.actividades || 0} detail="Seguimientos, reuniones, muestras y otras acciones." />
            <Card title="Informes" value={r?.informes_totales || 0} detail="VAI y factibilidad." />
            <Card title="Días activos" value={r?.dias_activos_acumulados || 0} detail="Suma de días con acciones productivas." />
            <Card title="Última actividad" value={formatDateTime(r?.ultima_actividad_equipo || null)} detail={`${r?.asesores_sin_actividad || 0} sin actividad en el período.`} />
          </div>

          <Funnel data={data?.embudo_general || null} />

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="border-b px-5 py-4 dark:border-gray-800">
              <h2 className="text-lg font-semibold">Rendimiento por asesor</h2>
              <p className="mt-1 text-sm text-gray-500">Propiedades y cierres son KPI operativos; la conversión surge del embudo de contactos.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900">
                  <tr>{["Asesor", "Prospectos", "Actividades", "Informes", "Propiedades", "Cierres", "Conversión", "Última actividad", "Estado", "Acciones"].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {(data?.asesores || []).map((a) => (
                    <tr key={a.id} className="border-t dark:border-gray-800">
                      <td className="px-4 py-4"><p className="font-semibold">{a.nombre_completo}</p><p className="text-xs text-gray-500">{a.email}</p></td>
                      <td className="px-4 py-4">{a.prospectos}</td>
                      <td className="px-4 py-4">{a.actividades}</td>
                      <td className="px-4 py-4">{a.informes_totales}</td>
                      <td className="px-4 py-4">{a.propiedades_captadas}</td>
                      <td className="px-4 py-4"><b>{a.cierres_totales}</b><p className="text-xs text-gray-500">{a.cierres_propios} propios · {a.cierres_terceros} terceros</p></td>
                      <td className="px-4 py-4 font-semibold">{a.conversion_embudo_pct.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%</td>
                      <td className="px-4 py-4">{formatDateTime(a.ultima_actividad_at)}</td>
                      <td className="px-4 py-4"><button onClick={() => toggleActivo(a)} className={`rounded-full px-3 py-1 text-xs font-semibold ${a.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{a.activo ? "Activo" : "Inactivo"}</button></td>
                      <td className="px-4 py-4"><div className="flex gap-2"><Link href={`/dashboard/empresa/asesores/${a.id}?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`} className="rounded-lg border border-[#E6A930] px-3 py-2 text-xs font-semibold">Ver detalle</Link><button onClick={() => deleteAsesor(a)} className="px-3 py-2 text-xs font-semibold text-red-600">Eliminar</button></div></td>
                    </tr>
                  ))}
                  {!data?.asesores?.length && <tr><td colSpan={10} className="p-8 text-center text-gray-500">No hay asesores para mostrar.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
