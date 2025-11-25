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

export default function EmpresaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkEstado = async () => {
      try {
        // Si estamos en una ruta "exenta", no chequeamos nada para evitar loops
        if (isPathExempt(pathname)) {
          if (!cancelled) setChecking(false);
          return;
        }

        const res = await fetch("/api/billing/estado", { cache: "no-store" });

        if (!res.ok) {
          console.error("Error al consultar /api/billing/estado:", res.status);
          if (!cancelled) setChecking(false);
          return;
        }

        const data: BillingEstadoResponse = await res.json();
        const estado = data?.estado;

        if (!estado) {
          if (!cancelled) setChecking(false);
          return;
        }

        const debeSuspender =
          estado.suspendida ||
          (estado.plan_vencido && !estado.en_periodo_gracia);

        if (debeSuspender) {
          router.replace("/dashboard/empresa/suspendido");
          return;
        }

        if (!cancelled) setChecking(false);
      } catch (err) {
        console.error("Error verificando estado de suscripción:", err);
        if (!cancelled) setChecking(false);
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

  // Si todo ok (o ruta exenta), renderizamos normalmente el dashboard de empresa
  return <div className="w-full h-full">{children}</div>;
}
