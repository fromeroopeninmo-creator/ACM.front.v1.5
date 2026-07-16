"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

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
  if (!pathname) return false;
  return (
    pathname.startsWith("/dashboard/empresa/suspendido") ||
    pathname.startsWith("/dashboard/empresa/planes")
  );
}

export default function EmpresaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function validateAccess() {
      if (isPathExempt(pathname)) {
        if (!cancelled) {
          setValidationError(null);
          setChecking(false);
        }
        return;
      }

      setChecking(true);
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
          router.replace("/dashboard/empresa/suspendido");
          return;
        }

        /*
         * Modelo comercial simplificado:
         * todos los planes operativos habilitan todas las herramientas.
         * El acceso se decide por cobertura vigente, no por módulos separados.
         */
        if (!cancelled) {
          setChecking(false);
        }
      } catch (error) {
        console.error("Error verificando acceso de empresa:", error);
        if (!cancelled) {
          setValidationError(
            error instanceof Error
              ? error.message
              : "No se pudo validar el estado de la cuenta."
          );
          setChecking(false);
        }
      }
    }

    void validateAccess();

    return () => {
      cancelled = true;
    };
  }, [pathname, retryKey, router]);

  if (checking) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center px-4 text-sm text-slate-500">
        Verificando estado de tu cuenta…
      </div>
    );
  }

  /*
   * Fail closed: si billing no puede validarse, no mostramos las herramientas.
   * Así una caída o respuesta inválida no abre accidentalmente el Valuador.
   */
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
