// frontend/app/dashboard/asesor/suspendido/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

type BillingEstadoResponse = {
  estado?: {
    suspendida?: boolean;
    plan_vencido?: boolean;
    en_periodo_gracia?: boolean;
  } | null;
};

export default function AsesorCuentaSuspendidaPage() {
  const { user, loading } = useAuth();
  const { logoUrl, primaryColor } = useTheme();
  const router = useRouter();

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/auth/login");
      return;
    }

    let cancelled = false;

    const checkEstado = async () => {
      try {
        const res = await fetch("/api/billing/estado", { cache: "no-store" });

        if (!res.ok) {
          if (!cancelled) setChecking(false);
          return;
        }

        const data: BillingEstadoResponse = await res.json();
        const estado = data?.estado ?? null;

        const debeSuspender =
          !!estado?.suspendida ||
          (!!estado?.plan_vencido && !estado?.en_periodo_gracia);

        if (!debeSuspender) {
          router.replace("/dashboard/asesor");
          return;
        }

        if (!cancelled) setChecking(false);
      } catch (err) {
        console.error("Error verificando estado de cuenta suspendida:", err);
        if (!cancelled) setChecking(false);
      }
    };

    checkEstado();

    const t = setInterval(checkEstado, 45000);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [loading, router, user]);

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 text-center text-gray-500">
        Verificando estado de la cuenta…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 py-10 text-center">
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="mb-5 h-14 object-contain" />
      ) : (
        <h1
          className="mb-5 text-2xl font-bold"
          style={{ color: primaryColor || "#111827" }}
        >
          VAI Prop
        </h1>
      )}

      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
        <div className="mb-4 inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
          Cuenta suspendida temporalmente
        </div>

        <h2 className="text-xl font-semibold text-gray-900">
          Cuenta suspendida temporalmente
        </h2>

        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-600">
          Comunicate con el administrador de tu cuenta para regularizar la
          situación y restablecer el acceso a las herramientas de VAI Prop.
        </p>
      </div>

      <p className="mt-5 text-xs text-gray-400">
        © {new Date().getFullYear()} VAI - Todos los derechos reservados
      </p>
    </div>
  );
}
