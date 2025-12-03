// frontend/app/dashboard/asesor/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type BillingEstadoFlags = {
  suspendida: boolean;
  suspendida_motivo: string | null;
  suspendida_at: string | null;
  plan_vencido: boolean;
  dias_desde_vencimiento: number | null;
  en_periodo_gracia: boolean;
};

type BillingPlan = {
  id: string;
  nombre: string;
  tipo_plan?: string | null; // FULL / CORE / TRACKER_ONLY / etc
  incluye_valuador?: boolean | null;
  incluye_tracker?: boolean | null;
};

type BillingEstadoResponse = {
  plan?: BillingPlan | null;
  ciclo?: {
    inicio: string | null;
    fin: string | null;
    proximoCobro: string | null;
  } | null;
  suscripcion?: {
    estado: string;
    externoCustomerId: string | null;
    externoSubscriptionId: string | null;
  } | null;
  proximoPlan?: { id: string; nombre: string } | null;
  cambioProgramadoPara?: string | null;
  estado?: BillingEstadoFlags | null;
  error?: string;
};

function esRutaTrackerAsesor(pathname: string | null): boolean {
  if (!pathname) return false;
  // /dashboard/asesor/tracker y /dashboard/asesor/tracker-analytics (+ subrutas)
  if (pathname.startsWith("/dashboard/asesor/tracker")) return true;
  if (pathname.startsWith("/dashboard/asesor/tracker-analytics")) return true;
  return false;
}

export default function AsesorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [checkingBilling, setCheckingBilling] = useState(true);
  const [planIncluyeTracker, setPlanIncluyeTracker] = useState<boolean | null>(
    null
  );

  // ⚠️ Guard adicional: si el usuario NO es asesor, no debería estar en este segmento
  const rawRole =
    (user as any)?.role || (user as any)?.user_metadata?.role || null;
  const isAsesor = rawRole === "asesor";

  useEffect(() => {
    let cancelled = false;

    const checkEstado = async () => {
      if (loading) return;

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      try {
        const res = await fetch("/api/billing/estado", { cache: "no-store" });

        // 🧱 Cambio clave: si la API falla (400, 500, etc.), por seguridad
        // asumimos que NO tiene tracker habilitado.
        if (!res.ok) {
          console.error(
            "Error al consultar /api/billing/estado (asesor):",
            res.status
          );
          if (!cancelled) {
            setPlanIncluyeTracker(false);
            setCheckingBilling(false);
          }
          return;
        }

        const data: BillingEstadoResponse = await res.json();
        const estado = data?.estado;
        const plan = data?.plan;

        // Si la API devolvió un error lógico (ej: "No se pudo resolver la empresa...")
        // lo tratamos igual que un fallo: sin tracker.
        if (data?.error && !cancelled) {
          console.error(
            "Error lógico en /api/billing/estado (asesor):",
            data.error
          );
          setPlanIncluyeTracker(false);
          setCheckingBilling(false);
          return;
        }

        // 🔒 Si la cuenta está suspendida o plan vencido sin gracia,
        // redirigimos igual que en empresa: asesores no pueden seguir usando nada.
        if (estado) {
          const debeSuspender =
            estado.suspendida ||
            (estado.plan_vencido && !estado.en_periodo_gracia);

          if (debeSuspender) {
            router.replace("/dashboard/empresa/suspendido");
            return;
          }
        }

        const incluyeTracker = plan?.incluye_tracker === true;

        if (!cancelled) {
          setPlanIncluyeTracker(incluyeTracker);
          setCheckingBilling(false);
        }
      } catch (err) {
        console.error("Error verificando estado de suscripción (asesor):", err);
        // En caso de error de red u otra cosa, también cerramos el grifo
        if (!cancelled) {
          setPlanIncluyeTracker(false);
          setCheckingBilling(false);
        }
      }
    };

    checkEstado();

    return () => {
      cancelled = true;
    };
  }, [router, user, loading, pathname]);

  if (loading || checkingBilling) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        Verificando acceso a tus herramientas…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        Redirigiendo al login…
      </div>
    );
  }

  // 🧱 Blindaje por rol: solo asesores deberían ver este segmento
  if (!isAsesor) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            Acceso restringido
          </h1>
          <p className="text-sm text-slate-600">
            No tenés acceso al panel de asesor. Volvé a tu tablero principal.
          </p>
        </div>
      </div>
    );
  }

  const esTracker = esRutaTrackerAsesor(pathname);

  // 🧱 Blindaje por plan: si la empresa NO tiene tracker habilitado
  // o no pudimos resolver la empresa / estado de billing,
  // el asesor no puede entrar al tracker ni al analytics.
  if (esTracker && planIncluyeTracker === false) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            No tenés acceso a esta herramienta
          </h1>
          <p className="text-sm text-slate-600 mb-4">
            El módulo de <span className="font-semibold">Business Tracker</span>{" "}
            no está habilitado para la cuenta de tu empresa o no se pudo
            validar correctamente la suscripción.
          </p>
          <p className="text-xs text-slate-500">
            Pedile a quien administra la cuenta que revise la{" "}
            <span className="font-semibold">suscripción y los planes</span> del
            panel de empresa.
          </p>
        </div>
      </div>
    );
  }

  // ✅ Si pasa todos los chequeos, renderizamos normalmente el dashboard de asesor
  return <div className="w-full h-full">{children}</div>;
}
