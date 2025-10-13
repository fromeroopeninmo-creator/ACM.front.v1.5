"use client";

import { useEffect, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

interface EmpresaPlan {
  plan_nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
  max_asesores: number;
}

interface Plan {
  id: string;
  nombre: string;
  max_asesores: number;
}

export default function EmpresaPlanesPage() {
  const { user } = useAuth();
  const [planActual, setPlanActual] = useState<EmpresaPlan | null>(null);
  const [planesDisponibles, setPlanesDisponibles] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // 📡 Cargar plan actual y planes disponibles
  useEffect(() => {
    const fetchPlanes = async () => {
      if (!user?.id) return;

      setLoading(true);

      // 🔍 Obtener el plan activo de la empresa
      const { data: empresaPlan, error: errorEmpresaPlan } = await supabase
        .from("empresas_planes")
        .select(`
          plan_id,
          fecha_inicio,
          fecha_fin,
          activo,
          planes (nombre, max_asesores)
        `)
        .eq("empresa_id", user.id)
        .eq("activo", true)
        .single();

      if (errorEmpresaPlan) {
        console.error("Error obteniendo plan actual:", errorEmpresaPlan);
      } else if (empresaPlan) {
        setPlanActual({
          plan_nombre: empresaPlan.planes.nombre,
          fecha_inicio: empresaPlan.fecha_inicio,
          fecha_fin: empresaPlan.fecha_fin,
          activo: empresaPlan.activo,
          max_asesores: empresaPlan.planes.max_asesores,
        });
      }

      // 🔍 Obtener todos los planes disponibles
      const { data: planes, error: errorPlanes } = await supabase
        .from("planes")
        .select("id, nombre, max_asesores")
        .order("max_asesores", { ascending: true });

      if (!errorPlanes && planes) setPlanesDisponibles(planes);

      setLoading(false);
    };

    fetchPlanes();
  }, [user]);

  // 🚀 Enviar solicitud real al endpoint /api/solicitud-upgrade
  const handleUpgrade = async (planId: string) => {
    if (!user?.id) return;

    setMensaje("Enviando solicitud de cambio de plan...");

    try {
      const res = await fetch("/api/solicitud-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId: user.id,
          planId,
        }),
      });

      const data = await res.json();

      if (data.error) {
        console.error("Error desde API:", data.error);
        setMensaje("❌ Error al enviar la solicitud. Intenta nuevamente.");
      } else {
        setMensaje("✅ Solicitud enviada. Un administrador la revisará.");
      }
    } catch (err) {
      console.error("Error de red:", err);
      setMensaje("❌ No se pudo conectar al servidor.");
    }

    setTimeout(() => setMensaje(null), 4000);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Cargando información de planes...
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Planes y Suscripción</h1>

      {/* 🧱 Bloque: Plan actual */}
      {planActual ? (
        <div className="bg-white shadow rounded-lg p-4 mb-8 border border-gray-200">
          <h2 className="text-lg font-medium mb-2">
            Plan actual: {planActual.plan_nombre}
          </h2>
          <p className="text-sm text-gray-600">
            Asesores permitidos: {planActual.max_asesores}
          </p>
          <p className="text-sm text-gray-600">
            Inicio:{" "}
            {new Date(planActual.fecha_inicio).toLocaleDateString("es-AR")}
          </p>
          <p className="text-sm text-gray-600 mb-2">
            Vencimiento:{" "}
            {new Date(planActual.fecha_fin).toLocaleDateString("es-AR")}
          </p>
          <span
            className={`text-xs px-2 py-1 rounded ${
              planActual.activo
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {planActual.activo ? "Activo" : "Inactivo"}
          </span>
        </div>
      ) : (
        <p className="text-gray-500 mb-6">No se encontró un plan activo.</p>
      )}

      {/* 🧱 Bloque: Planes disponibles */}
      <h2 className="text-lg font-medium mb-3">Planes disponibles</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {planesDisponibles.map((plan) => (
          <div
            key={plan.id}
            className="bg-white shadow-sm border border-gray-200 p-4 rounded-lg flex flex-col justify-between"
          >
            <div>
              <h3 className="font-semibold text-blue-700 text-lg">
                {plan.nombre}
              </h3>
              <p className="text-sm text-gray-600">
                Hasta {plan.max_asesores} asesores
              </p>
            </div>
            <button
              onClick={() => handleUpgrade(plan.id)}
              disabled={plan.nombre === planActual?.plan_nombre}
              className={`mt-4 w-full py-2 rounded-lg text-sm font-medium transition ${
                plan.nombre === planActual?.plan_nombre
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {plan.nombre === planActual?.plan_nombre
                ? "Plan actual"
                : "Solicitar Upgrade"}
            </button>
          </div>
        ))}
      </div>

      {/* 🧱 Mensaje temporal */}
      {mensaje && (
        <p className="mt-6 text-center text-blue-600 font-medium">{mensaje}</p>
      )}
    </div>
  );
}
