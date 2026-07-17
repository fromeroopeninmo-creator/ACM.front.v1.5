// frontend/app/dashboard/empresa/layout.tsx
"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useBilling } from "@/context/BillingContext";

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
  const { billing, loading, error, refreshBilling } = useBilling();

  const exempt = isPathExempt(pathname);
  const blockedByAccess = billing?.acceso?.permitido === false;
  const blockedByLegacyState =
    billing?.estado?.suspendida === true ||
    (billing?.estado?.plan_vencido === true &&
      billing?.estado?.en_periodo_gracia !== true);
  const blocked = blockedByAccess || blockedByLegacyState;

  useEffect(() => {
    if (!loading && !error && blocked && !exempt) {
      router.replace("/dashboard/empresa/suspendido");
    }
  }, [blocked, error, exempt, loading, router]);

  // Planes y Suspendido deben permanecer disponibles aun cuando Billing bloquee.
  if (exempt) {
    return <div className="h-full w-full min-w-0">{children}</div>;
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center px-4 text-sm text-slate-500">
        Verificando estado de tu cuenta…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <h1 className="font-semibold text-slate-900">
            No pudimos comprobar el estado de la cuenta
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Puede tratarse de un problema momentáneo de conexión. Volvé a
            intentarlo para continuar.
          </p>
          <button
            type="button"
            onClick={() => void refreshBilling()}
            className="mt-4 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Volver a intentar
          </button>
        </div>
      </div>
    );
  }

  // Evita mostrar brevemente la herramienta mientras se completa la redirección.
  if (blocked) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center px-4 text-sm text-slate-500">
        Redirigiendo…
      </div>
    );
  }

  return <div className="h-full w-full min-w-0">{children}</div>;
}
