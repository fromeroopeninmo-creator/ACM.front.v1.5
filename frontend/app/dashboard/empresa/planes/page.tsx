"use client";

import { useEffect, useMemo, useState } from "react";
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
  precio?: number | string | null;
  duracion_dias?: number | null;
}

export default function EmpresaPlanesPage() {
  const { user } = useAuth();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [planActual, setPlanActual] = useState<EmpresaPlan | null>(null);
  const [planesDisponibles, setPlanesDisponibles] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // 🔎 Primero resolvemos el ID de la empresa a partir del usuario autenticado
  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!user?.id) return;
      const { data: emp, error } = await supabase
        .from("empresas")
        .select("id, plan_activo_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error buscando empresa:", error);
        setEmpresaId(null);
        return;
      }
      setEmpresaId(emp?.id ?? null);
    };
    fetchEmpresa();
  }, [user]);

  // 📡 Con el empresaId, traemos plan actual y planes disponibles
  useEffect(() => {
    const fetchPlanes = async () => {
      if (!empresaId) {
        setLoading(false);
        return;
      }
      setLoading(true);

      try {
        // Plan actual (desde empresas_planes)
        const { data: empresaPlan, error: errorEmpresaPlan } = await supabase
          .from("empresas_planes")
          .select(`
            plan_id,
            fecha_inicio,
            fecha_fin,
            activo,
            planes:plan_id (nombre, max_asesores)
          `)
          .eq("empresa_id", empresaId)
          .eq("activo", true)
          .maybeSingle();

        if (errorEmpresaPlan) {
          console.error("Error obteniendo plan actual:", errorEmpresaPlan);
        } else if (empresaPlan) {
          const planDataRaw = empresaPlan.planes;
          const planData = Array.isArray(planDataRaw) ? planDataRaw[0] : planDataRaw;

          setPlanActual({
            plan_nombre: planData?.nombre || "Sin plan",
            fecha_inicio: empresaPlan.fecha_inicio,
            fecha_fin: empresaPlan.fecha_fin,
            activo: empresaPlan.activo,
            max_asesores: planData?.max_asesores ?? 0,
          });
        } else {
          setPlanActual(null);
        }

        // Planes disponibles (ocultamos Trial / Desarrollo si querés)
        const { data: planes, error: errorPlanes } = await supabase
          .from("planes")
          .select("id, nombre, max_asesores, precio, duracion_dias")
          .neq("nombre", "Trial")
          .order("max_asesores", { ascending: true });

        if (errorPlanes) {
          console.error("Error cargando planes:", errorPlanes);
        } else {
          setPlanesDisponibles(planes || []);
        }
      } catch (err) {
        console.error("Error cargando planes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlanes();
  }, [empresaId]);

  // 🚀 Cambiar plan (Upgrade / Downgrade instantáneo)
  const handleUpgrade = async (planId: string) => {
    if (!user?.id || !empresaId) return;
    setMensaje("Aplicando nuevo plan...");

    try {
      const res = await fetch("/api/solicitud-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // tu API actual espera empresaId = user.id o empresas.id según la implementaste.
        // Si la hiciste con user.id, podés seguir igual, pero es más correcto pasar empresas.id:
        body: JSON.stringify({ empresaId: empresaId, planId }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        console.error("Error desde API:", data.error || data);
        setMensaje("❌ No se pudo cambiar el plan. Intenta nuevamente.");
        return;
      }

      setMensaje(`✅ ${data.message}`);
      // recargamos para que refresque el plan actual
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      console.error("Error de red:", err);
      setMensaje("❌ No se pudo conectar al servidor.");
    }

    setTimeout(() => setMensaje(null), 4000);
  };

  // 💵 formateador de precio si existe en DB
  const fmtPrice = (p?: number | string | null) => {
    if (p == null) return "—";
    const val = typeof p === "string" ? parseFloat(p) : p;
    if (!isFinite(val)) return "—";
    if (val === 0) return "Gratis";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const planActualNombre = useMemo(() => {
    if (!planActual?.plan_nombre) return "Sin plan";
    return planActual.plan_nombre;
  }, [planActual]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh] text-gray-500">
        Cargando información de planes…
      </div>
    );
  }

  const esTrial = planActual?.plan_nombre === "Trial";

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <section className="bg-white shadow-sm rounded-xl p-6">
        <h1 className="text-2xl font-semibold">Suscripción Mensual</h1>
        <p className="text-gray-600 mt-1">
          Plan actual: <span className="font-semibold">{planActualNombre}</span>
        </p>
      </section>

      {/* Plan actual */}
      {planActual ? (
        <section className="bg-white shadow-sm rounded-xl p-6 border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                {planActual.plan_nombre}
              </h2>
              <p className="text-sm text-gray-600">
                Asesores permitidos: {planActual.max_asesores}
              </p>
              <p className="text-sm text-gray-600">
                Inicio: {new Date(planActual.fecha_inicio).toLocaleDateString("es-AR")}
              </p>
              <p className="text-sm text-gray-600">
                Vencimiento: {new Date(planActual.fecha_fin).toLocaleDateString("es-AR")}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded self-start ${
                planActual.activo
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {planActual.activo ? "Activo" : "Inactivo"}
            </span>
          </div>

          {esTrial && (
            <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              🔸 Estás usando el plan <strong>Trial</strong> (prueba gratuita de 7 días).
              No podés agregar asesores con este plan. Realizá un <strong>upgrade</strong> para habilitar tus asesores.
            </p>
          )}
        </section>
      ) : (
        <section className="bg-white shadow-sm rounded-xl p-6 border border-dashed border-gray-300">
          <p className="text-gray-600">No se encontró un plan activo.</p>
        </section>
      )}

      {/* Planes disponibles */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Planes disponibles</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {planesDisponibles.map((plan) => {
            const isActive = plan.plan_nombre === planActual?.plan_nombre || plan.nombre === planActual?.plan_nombre;
            return (
              <div
                key={plan.id}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow transition flex flex-col"
              >
                <div className="mb-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-lg font-semibold text-blue-700">
                      {plan.nombre}
                    </h3>
                    <span className="text-sm text-gray-500">
                      {plan.duracion_dias ? `${plan.duracion_dias} días` : ""}
                    </span>
                  </div>

                  <div className="mt-2">
                    <div className="text-2xl font-bold">{fmtPrice(plan.precio)}</div>
                    <div className="text-sm text-gray-600">
                      Hasta {plan.max_asesores} asesores
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={plan.nombre === planActual?.plan_nombre}
                  className={`mt-auto w-full py-2.5 rounded-lg text-sm font-medium transition ${
                    plan.nombre === planActual?.plan_nombre
                      ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {plan.nombre === planActual?.plan_nombre ? "Plan actual" : "Seleccionar plan"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Mensaje temporal */}
      {mensaje && (
        <p className="text-center text-blue-600 font-medium">{mensaje}</p>
      )}
    </div>
  );
}
