// frontend/app/dashboard/superadmin/solicitudes/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

interface Solicitud {
  id: string;
  empresa_id: string;
  empresa_nombre: string;
  plan_actual_id: string | null;
  plan_solicitado_id: string;
  plan_actual: string;
  plan_solicitado: string;
  estado: string;
  fecha_solicitud: string;
}

export default function SolicitudesPlanesPage() {
  const { user } = useAuth();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // 📡 Cargar todas las solicitudes
  useEffect(() => {
    const fetchSolicitudes = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("solicitudes_planes")
        .select(`
          id,
          empresa_id,
          estado,
          fecha_solicitud,
          plan_actual_id,
          plan_solicitado_id,
          empresas (razon_social),
          plan_actual:plan_actual_id (nombre),
          plan_solicitado:plan_solicitado_id (nombre)
        `)
        .order("fecha_solicitud", { ascending: false });

      if (error) {
        console.error("Error obteniendo solicitudes:", error);
        setLoading(false);
        return;
      }

      const mapped = (data || []).map((item: any) => ({
        id: item.id as string,
        empresa_id: item.empresa_id as string,
        estado: item.estado as string,
        plan_actual_id: (item.plan_actual_id as string) ?? null,
        plan_solicitado_id: item.plan_solicitado_id as string,
        empresa_nombre: item.empresas?.razon_social || "—",
        plan_actual: item.plan_actual?.nombre || "—",
        plan_solicitado: item.plan_solicitado?.nombre || "—",
        fecha_solicitud: new Date(item.fecha_solicitud).toLocaleDateString("es-AR"),
      }));

      setSolicitudes(mapped);
      setLoading(false);
    };

    fetchSolicitudes();
  }, []);

  // Utilidad para sumar días a YYYY-MM-DD
  const addDaysISO = (dateISO: string, days: number) => {
    const d = new Date(dateISO);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  };

  // ✅ Aprobar solicitud (versión segura, sin romper la lógica existente)
  const aprobarSolicitud = async (solicitudId: string) => {
    setMensaje("Procesando aprobación...");

    const solicitud = solicitudes.find((s) => s.id === solicitudId);
    if (!solicitud) {
      setMensaje("Solicitud no encontrada.");
      return;
    }

    // Traer duración del plan solicitado (si existe) para calcular fecha_fin
    const { data: planRow, error: planErr } = await supabase
      .from("planes")
      .select("duracion_dias")
      .eq("id", solicitud.plan_solicitado_id)
      .maybeSingle();

    if (planErr) {
      console.error("Error leyendo plan destino:", planErr);
      setMensaje("No se pudo leer el plan solicitado.");
      return;
    }

    const hoy = new Date().toISOString().slice(0, 10);
    const dur = Number(planRow?.duracion_dias) || 30;
    const fecha_fin = addDaysISO(hoy, dur);

    // 1) Marcar solicitud como aprobada
    const { error: updateError } = await supabase
      .from("solicitudes_planes")
      .update({
        estado: "aprobado",
        fecha_respuesta: new Date().toISOString(),
        revisado_por: user?.id ?? null,
      })
      .eq("id", solicitudId);

    if (updateError) {
      console.error("Error al aprobar solicitud:", updateError);
      setMensaje("Error al aprobar la solicitud.");
      return;
    }

    // 2) Desactivar plan anterior activo
    const { error: deactivateErr } = await supabase
      .from("empresas_planes")
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq("empresa_id", solicitud.empresa_id)
      .eq("activo", true);

    if (deactivateErr) {
      console.error("Error al desactivar plan previo:", deactivateErr);
      setMensaje("Solicitud aprobada, pero no se pudo desactivar el plan anterior.");
      return;
    }

    // 3) Activar nuevo plan
    const { error: insertErr } = await supabase
      .from("empresas_planes")
      .insert([
        {
          empresa_id: solicitud.empresa_id,
          plan_id: solicitud.plan_solicitado_id,
          fecha_inicio: hoy,
          fecha_fin,
          activo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

    if (insertErr) {
      console.error("Error al activar nuevo plan:", insertErr);
      setMensaje("Solicitud aprobada, pero no se pudo activar el nuevo plan.");
      return;
    }

    setMensaje("Solicitud aprobada correctamente ✅");
    setSolicitudes((prev) =>
      prev.map((s) =>
        s.id === solicitudId ? { ...s, estado: "aprobado" } : s
      )
    );
    setTimeout(() => setMensaje(null), 3000);
  };

  // ❌ Rechazar solicitud
  const rechazarSolicitud = async (solicitudId: string) => {
    const { error } = await supabase
      .from("solicitudes_planes")
      .update({
        estado: "rechazado",
        fecha_respuesta: new Date().toISOString(),
        revisado_por: user?.id ?? null,
      })
      .eq("id", solicitudId);

    if (error) {
      console.error("Error al rechazar solicitud:", error);
      setMensaje("Error al rechazar la solicitud.");
      return;
    }

    setSolicitudes((prev) =>
      prev.map((s) =>
        s.id === solicitudId ? { ...s, estado: "rechazado" } : s
      )
    );
    setMensaje("Solicitud rechazada.");
    setTimeout(() => setMensaje(null), 2000);
  };

  // 🕓 Cargando
  if (loading)
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Cargando solicitudes...
      </div>
    );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Solicitudes de Upgrade</h1>

      {mensaje && (
        <p className="text-center text-blue-600 font-medium mb-4">{mensaje}</p>
      )}

      {solicitudes.length === 0 ? (
        <p className="text-gray-500">No hay solicitudes pendientes.</p>
      ) : (
        <div className="grid gap-4">
          {solicitudes.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-gray-200 shadow-sm rounded-lg p-4 flex justify-between items-center"
            >
              <div>
                <p className="font-medium text-gray-800">{s.empresa_nombre}</p>
                <p className="text-sm text-gray-600">
                  {s.plan_actual} → <strong>{s.plan_solicitado}</strong>
                </p>
                <p className="text-xs text-gray-500">
                  {s.fecha_solicitud} — Estado:{" "}
                  <span
                    className={`font-semibold ${
                      s.estado === "aprobado"
                        ? "text-green-600"
                        : s.estado === "rechazado"
                        ? "text-red-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {s.estado}
                  </span>
                </p>
              </div>

              {s.estado === "pendiente" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => aprobarSolicitud(s.id)}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 rounded-lg"
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => rechazarSolicitud(s.id)}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 rounded-lg"
                  >
                    Rechazar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
