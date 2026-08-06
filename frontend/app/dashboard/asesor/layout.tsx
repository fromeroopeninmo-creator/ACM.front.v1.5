// frontend/app/dashboard/asesor/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useBilling } from "@/context/BillingContext";
import { supabase } from "#lib/supabaseClient";

function isPathExempt(pathname: string | null): boolean {
  return !!pathname?.startsWith("/dashboard/asesor/suspendido");
}

export default function AsesorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const {
    role,
    billing,
    loading: billingLoading,
    error,
    refreshBilling,
  } = useBilling();

  const [checkingAdvisorAccess, setCheckingAdvisorAccess] = useState(true);
  const [advisorActive, setAdvisorActive] = useState<boolean | null>(null);
  const [advisorAccessError, setAdvisorAccessError] = useState<string | null>(null);

  const exempt = isPathExempt(pathname);
  const blockedByAccess = billing?.acceso?.permitido === false;
  const blockedByLegacyState =
    billing?.estado?.suspendida === true ||
    (billing?.estado?.plan_vencido === true &&
      billing?.estado?.en_periodo_gracia !== true);
  const blocked = blockedByAccess || blockedByLegacyState;

  useEffect(() => {
    let cancelled = false;

    const checkAdvisorAccess = async () => {
      if (authLoading) return;

      if (!user || role !== "asesor") {
        if (!cancelled) {
          setAdvisorActive(null);
          setAdvisorAccessError(null);
          setCheckingAdvisorAccess(false);
        }
        return;
      }

      setCheckingAdvisorAccess(true);
      setAdvisorAccessError(null);

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          throw new Error("No se pudo validar la sesión del asesor.");
        }

        const response = await fetch(
          "/api/empresa/asesores/estado",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          }
        );

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            payload?.error || "No se pudo validar el estado del asesor."
          );
        }

        if (!cancelled) {
          setAdvisorActive(payload?.activo === true);
        }
      } catch (accessError) {
        console.error("Error verificando acceso del asesor:", accessError);

        if (!cancelled) {
          setAdvisorActive(false);
          setAdvisorAccessError(
            accessError instanceof Error
              ? accessError.message
              : "No se pudo validar el estado del asesor."
          );
        }
      } finally {
        if (!cancelled) {
          setCheckingAdvisorAccess(false);
        }
      }
    };

    void checkAdvisorAccess();

    return () => {
      cancelled = true;
    };
  }, [authLoading, pathname, role, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login");
      return;
    }

    if (!billingLoading && !error && blocked && !exempt) {
      router.replace("/dashboard/asesor/suspendido");
    }
  }, [
    authLoading,
    billingLoading,
    blocked,
    error,
    exempt,
    router,
    user,
  ]);

  if (authLoading || billingLoading || checkingAdvisorAccess) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center px-4 text-sm text-slate-500">
        Verificando acceso a tus herramientas…
      </div>
    );
  }

  if (!user) return null;

  if (role !== "asesor") {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <h1 className="font-semibold text-slate-900">Acceso restringido</h1>
          <p className="mt-2 text-sm text-slate-600">
            Esta sección está disponible únicamente para asesores.
          </p>
        </div>
      </div>
    );
  }

  if (role === "asesor" && advisorActive === false) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm dark:border-amber-900 dark:bg-gray-950">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-xl dark:bg-amber-950/50">
            🔒
          </div>
          <h1 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
            Acceso desactivado
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Tu acceso fue desactivado por la empresa. El historial de actividades,
            contactos, propiedades, cierres e informes permanece conservado.
          </p>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Comunicate con quien administra la cuenta para solicitar la reactivación.
          </p>
          {advisorAccessError && (
            <p className="mt-3 text-xs text-red-600 dark:text-red-300">
              {advisorAccessError}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (exempt) {
    return <div className="h-full w-full min-w-0">{children}</div>;
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

  if (blocked) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center px-4 text-sm text-slate-500">
        Redirigiendo…
      </div>
    );
  }

  return <div className="h-full w-full min-w-0">{children}</div>;
}
