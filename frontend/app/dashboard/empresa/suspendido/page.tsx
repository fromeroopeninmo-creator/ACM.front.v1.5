"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

export default function CuentaSuspendidaPage() {
  const { user, loading } = useAuth();
  const { primaryColor, logoUrl } = useTheme();
  const router = useRouter();

  const [checking, setChecking] = useState(true);

  const brandColor = useMemo(() => primaryColor || "#1e40af", [primaryColor]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user?.id) return;

    let cancelled = false;

    const checkPlan = async () => {
      try {
        const res = await fetch("/api/billing/estado", { cache: "no-store" });

        if (!res.ok) {
          console.error(
            "Error al consultar /api/billing/estado (suspendido):",
            res.status
          );
          if (!cancelled) setChecking(false);
          return;
        }

        const data: any = await res.json();
        const estado = data?.estado;

        if (!estado) {
          if (!cancelled) setChecking(false);
          return;
        }

        const debeSuspender =
          !!estado.suspendida ||
          !!estado.requiere_seleccion_plan ||
          (!!estado.plan_vencido && !estado.en_periodo_gracia) ||
          (!!estado.planVencido && !estado.enPeriodoGracia);

        if (!debeSuspender) {
          if (!cancelled) {
            router.replace("/dashboard/empresa");
          }
          return;
        }

        if (!cancelled) setChecking(false);
      } catch (err) {
        console.error("Error verificando estado de suscripción (suspendido):", err);
        if (!cancelled) setChecking(false);
      }
    };

    checkPlan();

    const t = setInterval(checkPlan, 45000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user, loading, router]);

  if (checking) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Verificando estado de tu cuenta...
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center items-center h-screen bg-gray-50 text-center px-6">
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="h-14 mb-4" />
      ) : (
        <h1 className="text-2xl font-bold mb-4" style={{ color: brandColor }}>
          VAI | Valuador de Activos Inmobiliarios
        </h1>
      )}

      <h2 className="text-xl font-semibold text-gray-800 mb-3">
        Cuenta Suspendida Temporalmente
      </h2>

      <p className="text-gray-600 max-w-md mb-6">
        Tu cuenta se encuentra <strong>temporalmente suspendida</strong> por falta
        de un plan activo o por falta de pago.
        <br />
        Para restablecer el acceso, debés ingresar al portal de planes y
        seleccionar una opción vigente. Una vez realizado el pago, tu acceso será
        restablecido automáticamente.
      </p>

      <button
        onClick={() => router.push("/dashboard/empresa/planes")}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition"
      >
        Ir al portal de planes
      </button>

      <p className="text-sm text-gray-500 mt-4">
        Si ya realizaste el pago o seleccionaste un nuevo plan, actualizá la
        página o esperá unos segundos.
      </p>

      <p className="text-xs text-gray-400 mt-2">
        © {new Date().getFullYear()} VAI - Todos los derechos reservados
      </p>
    </div>
  );
}
