"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

/** ===================== Tipos ===================== */
interface EmpresaPlan {
  plan_nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
  max_asesores: number;
  precio?: number | null;
  duracion_dias?: number | null;
}

interface Plan {
  id: string;
  nombre: string;
  max_asesores: number;
  precio: number | string | null;
  duracion_dias: number | string | null;
}

/** ===================== Skeletons ===================== */
function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="border border-gray-200 rounded-2xl p-5 shadow-sm">
      <SkeletonLine className="h-5 w-2/3 mb-3" />
      <SkeletonLine className="h-8 w-1/3 mb-6" />
      <div className="space-y-2 mb-6">
        <SkeletonLine className="h-3 w-5/6" />
        <SkeletonLine className="h-3 w-4/6" />
        <SkeletonLine className="h-3 w-3/6" />
      </div>
      <SkeletonLine className="h-10 w-full" />
    </div>
  );
}

/** ===================== Helpers ===================== */
const keyOf = (s?: string | null) => (s || "").trim().toLowerCase();
const currency = (n?: number | null) =>
  typeof n === "number" && !Number.isNaN(n)
    ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
    : "$ 0";

const isHiddenPlan = (name: string) => {
  const k = keyOf(name);
  return k === "trial" || k === "desarrollo";
};

const isPersonalizado = (name: string) => keyOf(name) === "personalizado";

/** ===================== Página ===================== */
export default function EmpresaPlanesPage() {
  const { user } = useAuth();
  const [planActual, setPlanActual] = useState<EmpresaPlan | null>(null);
  const [planesDisponibles, setPlanesDisponibles] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // 📡 Cargar plan actual y planes disponibles (en paralelo)
  useEffect(() => {
    const fetchPlanes = async () => {
      if (!user?.id) return;
      setLoading(true);

      try {
        const [empresaPlanRes, planesRes] = await Promise.all([
          supabase
            .from("empresas_planes")
            .select(`
              plan_id,
              fecha_inicio,
              fecha_fin,
              activo,
              planes:plan_id (nombre, max_asesores, precio, duracion_dias)
            `)
            .eq("empresa_id", user.id)
            .eq("activo", true)
            .maybeSingle(),
          supabase
            .from("planes")
            .select("id, nombre, max_asesores, precio, duracion_dias")
            .order("max_asesores", { ascending: true }),
        ]);

        const { data: empresaPlan, error: errorEmpresaPlan } = empresaPlanRes;
        if (errorEmpresaPlan) {
          console.error("Error obteniendo plan actual:", errorEmpresaPlan);
        } else if (empresaPlan) {
          const planDataRaw = empresaPlan.planes;
          const planData = Array.isArray(planDataRaw)
            ? planDataRaw[0]
            : planDataRaw;

          const precio = planData?.precio != null ? Number(planData.precio) : null;
          const duracion_dias = planData?.duracion_dias != null ? Number(planData.duracion_dias) : null;

          setPlanActual({
            plan_nombre: planData?.nombre || "Sin plan",
            fecha_inicio: empresaPlan.fecha_inicio,
            fecha_fin: empresaPlan.fecha_fin,
            activo: empresaPlan.activo,
            max_asesores: planData?.max_asesores || 0,
            precio,
            duracion_dias,
          });
        } else {
          setPlanActual(null);
        }

        const { data: planes, error: errorPlanes } = planesRes;
        if (errorPlanes) {
          console.error("Error listando planes:", errorPlanes);
          setPlanesDisponibles([]);
        } else {
          const visibles = (planes || []).filter((p) => !isHiddenPlan(p.nombre));
          setPlanesDisponibles(visibles);
        }
      } catch (err) {
        console.error("Error cargando planes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlanes();
  }, [user]);

  // 🚀 Cambiar plan (Upgrade / Downgrade instantáneo)
  const handleUpgrade = async (planId: string) => {
    if (!user?.id) return;

    setMensaje("Aplicando nuevo plan...");

    try {
      const res = await fetch("/api/solicitud-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: user.id, planId }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        console.error("Error desde API:", data.error || data);
        setMensaje("❌ No se pudo cambiar el plan. Intenta nuevamente.");
        return;
      }

      setMensaje(`✅ ${data.message}`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      console.error("Error de red:", err);
      setMensaje("❌ No se pudo conectar al servidor.");
    }

    setTimeout(() => setMensaje(null), 4000);
  };

  const esTrial = planActual && keyOf(planActual.plan_nombre) === "trial";

  /** Orden de planes: asc por max_asesores y “Personalizado” al final */
  const sortedPlans = useMemo(() => {
    const common = planesDisponibles.filter((p) => !isPersonalizado(p.nombre));
    const custom = planesDisponibles.filter((p) => isPersonalizado(p.nombre));
    common.sort((a, b) => a.max_asesores - b.max_asesores);
    return [...common, ...custom];
  }, [planesDisponibles]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <div className="text-2xl font-semibold mb-2">Suscripción Mensual</div>
          <SkeletonLine className="h-4 w-48" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Título + plan actual */}
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Suscripción Mensual
        </h1>
        <p className="text-gray-600 mt-2">
          Plan actual:{" "}
          <span className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 text-sm">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            {planActual?.plan_nombre || "Sin plan"}
          </span>
        </p>

        {planActual && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="text-gray-500">Asesores permitidos</div>
              <div className="font-semibold">{planActual.max_asesores}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="text-gray-500">Precio</div>
              <div className="font-semibold">{currency(planActual.precio ?? 0)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="text-gray-500">Inicio</div>
              <div className="font-semibold">
                {new Date(planActual.fecha_inicio).toLocaleDateString("es-AR")}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="text-gray-500">Vencimiento</div>
              <div className="font-semibold">
                {new Date(planActual.fecha_fin).toLocaleDateString("es-AR")}
              </div>
            </div>
          </div>
        )}

        {esTrial && (
          <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            🔸 Estás usando el plan <strong>Trial</strong> (prueba gratuita de 7 días).  
            No podés agregar asesores con este plan. Hacé un <strong>upgrade</strong> para habilitarlos.
          </p>
        )}
      </header>

      {/* Planes disponibles */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Planes disponibles</h2>

        {sortedPlans.length === 0 ? (
          <p className="text-gray-500">No hay planes configurados.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedPlans.map((plan) => {
              const isCurrent = keyOf(plan.nombre) === keyOf(planActual?.plan_nombre);
              const precioNum =
                plan.precio != null ? Number(plan.precio) : 0;
              const dur = plan.duracion_dias != null ? Number(plan.duracion_dias) : 30;

              return (
                <div
                  key={plan.id}
                  className={[
                    "relative rounded-2xl border p-6 bg-white shadow-sm transition",
                    isCurrent
                      ? "border-blue-500 ring-2 ring-blue-100"
                      : "border-gray-200 hover:shadow-md",
                  ].join(" ")}
                >
                  {/* badge plan actual */}
                  {isCurrent && (
                    <div className="absolute -top-3 right-4 bg-blue-600 text-white text-xs px-2 py-1 rounded-full shadow">
                      Plan actual
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-xl font-bold tracking-tight">{plan.nombre}</h3>
                    <p className="text-gray-600">
                      Hasta <strong>{plan.max_asesores}</strong> asesor
                      {plan.max_asesores === 1 ? "" : "es"}
                    </p>
                  </div>

                  {/* Precio */}
                  <div className="mb-5">
                    <div className="flex items-end gap-2">
                      <div className="text-3xl font-extrabold">
                        {currency(precioNum)}
                      </div>
                      <div className="text-gray-500 mb-1">/ {dur} días</div>
                    </div>
                    {isPersonalizado(plan.nombre) && (
                      <div className="text-xs text-gray-500 mt-1">
                        Base Premium + extra por asesor (definir).
                      </div>
                    )}
                  </div>

                  {/* Bullets simples */}
                  <ul className="space-y-2 mb-6">
                    <li className="flex items-start gap-2">
                      <span className="mt-1 inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-sm text-gray-700">Informes ilimitados</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-sm text-gray-700">Acceso al panel</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-sm text-gray-700">Actualizaciones automáticas</span>
                    </li>
                  </ul>

                  {/* CTA */}
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={isCurrent}
                    className={[
                      "w-full py-2.5 rounded-lg text-sm font-medium transition",
                      isCurrent
                        ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white",
                    ].join(" ")}
                  >
                    {isCurrent ? "Plan actual" : "Cambiar a este plan"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Mensaje temporal */}
      {mensaje && (
        <p className="text-center text-blue-600 font-medium">{mensaje}</p>
      )}
    </div>
  );
}
