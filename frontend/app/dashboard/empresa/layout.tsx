// frontend/app/dashboard/empresa/layout.tsx
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

function isPathExempt(pathname: string | null): boolean {
  if (!pathname) return false;

  // Rutas que se permiten aún con cuenta suspendida / vencida:
  // - Pantalla de cuenta suspendida
  // - Pantalla de planes (y subrutas) para poder pagar / cambiar plan
  if (pathname.startsWith("/dashboard/empresa/suspendido")) return true;
  if (pathname.startsWith("/dashboard/empresa/planes")) return true;

  return false;
}

// Rutas que consideramos parte del módulo CORE (Valuador / Factibilidad)
function isCoreRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/dashboard/empresa") return true;
  if (pathname.startsWith("/dashboard/empresa/vai")) return true;
  if (pathname.startsWith("/dashboard/empresa/factibilidad")) return true;
  return false;
}

// Rutas que consideramos parte del módulo TRACKER
function isTrackerRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/dashboard/empresa/tracker")) return true;
  if (pathname.startsWith("/dashboard/empresa/tracker-analytics")) return true;
  return false;
}

type ModuloBloqueado = "core" | "tracker" | null;

export default function EmpresaLayout({
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
        // Si estamos en una ruta "exenta", no chequeamos nada para evitar loops
        if (isPathExempt(pathname)) {
          if (!cancelled) {
            setChecking(false);
            setModuloBloqueado(null);
          }
          return;
        }

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

        // 🔒 Si la cuenta está suspendida / vencida (sin gracia) -> siempre a pantalla de suspendido
        if (debeSuspender) {
          router.replace("/dashboard/empresa/suspendido");
          return;
        }

        // Flags de módulos incluidos en el plan actual
        const incluyeValuador = data.plan?.incluye_valuador === true;
        const incluyeTracker = data.plan?.incluye_tracker === true;

        let bloqueado: ModuloBloqueado = null;

        // 🔒 Bloqueo de módulo CORE (Valuador / Factibilidad)
        if (isCoreRoute(pathname) && !incluyeValuador) {
          bloqueado = "core";
        }

        // 🔒 Bloqueo de módulo TRACKER
        if (isTrackerRoute(pathname) && !incluyeTracker) {
          bloqueado = "tracker";
        }

        if (!cancelled) {
          setModuloBloqueado(bloqueado);
          setChecking(false);
        }
      } catch (err) {
        console.error("Error verificando estado de suscripción:", err);
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

  // Mientras chequea el estado de la cuenta, mostramos un loader simple
  if (checking) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        Verificando estado de tu suscripción…
      </div>
    );
  }

  // 🔒 Vista cuando el módulo al que intenta entrar NO está incluido en el plan
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
            habilitarlo, podés actualizar tu plan desde la sección de{" "}
            <span className="font-semibold">Planes</span>.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={() => router.push("/dashboard/empresa/planes")}
              className="inline-flex items-center justify-center rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
            >
              Ver planes y habilitar módulo
            </button>
            <button
              onClick={() => router.push("/dashboard/empresa")}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Volver al panel principal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Si todo ok (o ruta exenta), renderizamos normalmente el dashboard de empresa
  return <div className="w-full h-full">{children}</div>;
}
