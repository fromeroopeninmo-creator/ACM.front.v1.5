// frontend/app/dashboard/asesor/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

type BillingEstadoFlags = {
  suspendida: boolean;
  suspendida_motivo: string | null;
  suspendida_at: string | null;
  plan_vencido: boolean;
  dias_desde_vencimiento: number | null;
  en_periodo_gracia: boolean;
};

type BillingEstadoResponse = {
  plan?: {
    id: string;
    nombre: string;
    precioNeto: number;
    totalConIVA: number;
    tipo_plan?: string | null;
    incluye_valuador?: boolean | null;
    incluye_tracker?: boolean | null;
    es_trial?: boolean | null;
  } | null;
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
};

// Rutas CORE (por si en el futuro el asesor tiene pantallas de valuador/factibilidad)
function isCoreRouteAsesor(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/dashboard/asesor/vai")) return true;
  if (pathname.startsWith("/dashboard/asesor/factibilidad")) return true;
  return false;
}

// Rutas TRACKER del asesor
function isTrackerRouteAsesor(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/dashboard/asesor/tracker")) return true;
  if (pathname.startsWith("/dashboard/asesor/tracker-analytics")) return true;
  return false;
}

type ModuloBloqueado = "core" | "tracker" | null;

export default function AsesorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);
  const [moduloBloqueado, setModuloBloqueado] = useState<ModuloBloqueado>(null);

  useEffect(() => {
    let cancelled = false;

    const checkEstado = async () => {
      try {
        const res = await fetch("/api/billing/estado", { cache: "no-store" });

        if (!res.ok) {
          console.error("Error al consultar /api/billing/estado:", res.status);
          if (!cancelled) {
            setChecking(false);
            setModuloBloqueado(null);
          }
          return;
        }

        const data: BillingEstadoResponse = await res.json();
        const estado = data?.estado;

        if (!estado) {
          if (!cancelled) {
            setChecking(false);
            setModuloBloqueado(null);
          }
          return;
        }

        const debeSuspender =
          estado.suspendida ||
          (estado.plan_vencido && !estado.en_periodo_gracia);

        // 🔒 Si la cuenta de la empresa está suspendida / vencida, el asesor tampoco puede usar nada
        if (debeSuspender) {
          router.replace("/dashboard/empresa/suspendido");
          return;
        }

        // Flags de módulos incluidos en el plan actual de la empresa
        const incluyeValuador = data.plan?.incluye_valuador === true;
        const incluyeTracker = data.plan?.incluye_tracker === true;

        let bloqueado: ModuloBloqueado = null;

        // 🔒 Bloqueo CORE (por si en el futuro el asesor tiene VAI / Factibilidad)
        if (isCoreRouteAsesor(pathname) && !incluyeValuador) {
          bloqueado = "core";
        }

        // 🔒 Bloqueo TRACKER
        if (isTrackerRouteAsesor(pathname) && !incluyeTracker) {
          bloqueado = "tracker";
        }

        if (!cancelled) {
          setModuloBloqueado(bloqueado);
          setChecking(false);
        }
      } catch (err) {
        console.error("Error verificando estado de suscripción (asesor):", err);
        if (!cancelled) {
          setChecking(false);
          setModuloBloqueado(null);
        }
      }
    };

    checkEstado();

    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (checking) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        Verificando estado de tu suscripción…
      </div>
    );
  }

  // 🔒 Vista cuando el asesor intenta entrar a un módulo que su empresa no tiene habilitado
  if (moduloBloqueado) {
    const labelModulo =
      moduloBloqueado === "core"
        ? "Valuador / Factibilidad"
        : "Tracker de Actividades";

    return (
      <div className="w-full h-full flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-gray-200 bg-white shadow-sm p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold text-slate-900">
            No tenés acceso a esta herramienta
          </h1>
          <p className="text-sm text-slate-600">
            El plan actual de tu empresa no incluye el módulo{" "}
            <span className="font-semibold">{labelModulo}</span>. Para
            habilitarlo, pedile a quien administra la cuenta que lo active desde
            la sección de <span className="font-semibold">Planes</span>.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={() => router.push("/dashboard/asesor")}
              className="inline-flex items-center justify-center rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
            >
              Volver a mi panel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Si todo ok, renderizamos normalmente el dashboard del asesor
  return <div className="w-full h-full">{children}</div>;
}
