"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type BillingEstadoResponse = {
  acceso?: {
    permitido?: boolean;
    origen?: string | null;
    motivo?: string | null;
  } | null;
  estado?: {
    suspendida?: boolean;
    plan_vencido?: boolean;
    en_periodo_gracia?: boolean;
  } | null;
  error?: string;
};

function isPathExempt(pathname: string | null): boolean {
  return !!pathname?.startsWith("/dashboard/asesor/suspendido");
}

export default function AsesorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [checkingBilling, setCheckingBilling] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const role =
    (user as any)?.role ||
    (user as any)?.user_metadata?.role ||
    null;

  useEffect(() => {
    let cancelled = false;

    async function validateAccess() {
      if (loading) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      if (isPathExempt(pathname)) {
        if (!cancelled) {
          setValidationError(null);
          setCheckingBilling(false);
        }
        return;
      }

      setCheckingBilling(true);
      setValidationError(null);

      try {
        const response = await fetch("/api/billing/estado", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`No se pudo validar el acceso (${response.status}).`);
        }

        const billing = (await response.json()) as BillingEstadoResponse;

        if (billing.error) {
          throw new Error(billing.error);
        }

        const blockedByAccess = billing.acceso?.permitido === false;
        const blockedByLegacyState =
          billing.estado?.suspendida === true ||
          (billing.estado?.plan_vencido === true &&
            billing.estado?.en_periodo_gracia !== true);

        if (blockedByAccess || blockedByLegacyState) {
          router.replace("/dashboard/asesor/suspendido");
          return;
        }

        /*
         * Todos los planes operativos habilitan las herramientas.
         * El Trial no agrega asesores, pero un asesor ya vinculado nunca debe
         * poder saltear la validación comercial de la empresa.
         */
        if (!cancelled) {
          setCheckingBilling(false);
        }
      } catch (error) {
        console.error("Error verificando acceso del asesor:", error);
        if (!cancelled) {
          setValidationError(
            error instanceof Error
              ? error.message
              : "No se pudo validar el estado de la cuenta."
          );
          setCheckingBilling(false);
        }
      }
    }

    void validateAccess();

    return () => {
      cancelled = true;
    };
  }, [loading, pathname, retryKey, router, user]);

  if (loading || checkingBilling) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center px-4 text-sm text-slate-500">
        Verificando acceso a tus herramientas…
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (role !== "asesor") {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
          <h1 className="font-semibold text-red-950">Acceso restringido</h1>
          <p className="mt-2 text-sm text-red-800">
            Esta sección está disponible únicamente para asesores.
          </p>
        </div>
      </div>
    );
  }

  if (validationError && !isPathExempt(pathname)) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <h1 className="font-semibold text-amber-950">
            No pudimos validar tu acceso
          </h1>
          <p className="mt-2 text-sm text-amber-800">{validationError}</p>
          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
            className="mt-4 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
          >
            Volver a intentar
          </button>
        </div>
      </div>
    );
  }

  return <div className="h-full w-full min-w-0">{children}</div>;
}
