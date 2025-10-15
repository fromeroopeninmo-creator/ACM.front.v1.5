"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "#lib/supabaseClient";

export default function CuentaSuspendidaPage() {
  const { user } = useAuth();
  const { primaryColor, logoUrl } = useTheme();
  const router = useRouter();

  const [checking, setChecking] = useState(true);

  // 🚦 Verificar si la empresa volvió a tener plan activo
  useEffect(() => {
    const checkPlan = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from("empresas_planes")
          .select("id")
          .eq("empresa_id", user.id)
          .eq("activo", true)
          .maybeSingle();

        if (!error && data) {
          // ✅ Tiene plan activo → redirigir al dashboard empresa
          router.replace("/dashboard/empresa");
        }
      } catch (err) {
        console.error("Error verificando plan activo:", err);
      } finally {
        setChecking(false);
      }
    };

    checkPlan();
  }, [user, router]);

  // Si todavía está revisando el estado
  if (checking) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Verificando estado de tu cuenta...
      </div>
    );
  }

  // Si el usuario no está logueado → redirigir a login
  useEffect(() => {
    if (!user) router.replace("/auth/login");
  }, [user, router]);

  return (
    <div className="flex flex-col justify-center items-center h-screen bg-gray-50 text-center px-6">
      {/* Logo */}
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="h-14 mb-4" />
      ) : (
        <h1
          className="text-2xl font-bold mb-4"
          style={{ color: primaryColor || "#1e40af" }}
        >
          VAI | Valuador de Activos Inmobiliarios
        </h1>
      )}

      {/* Título */}
      <h2 className="text-xl font-semibold text-gray-800 mb-3">
        Cuenta Suspendida Temporalmente
      </h2>

      {/* Mensaje explicativo */}
      <p className="text-gray-600 max-w-md mb-6">
        Tu cuenta se encuentra <strong>temporalmente suspendida</strong> debido a la
        falta de pago.
        <br />
        Tenés <strong>48 horas</strong> desde el vencimiento para regularizar tu
        suscripción. Una vez realizado el pago o cambio de plan, tu acceso será
        restablecido automáticamente.
      </p>

      {/* Botón de acción */}
      <button
        onClick={() => router.push("/dashboard/empresa/planes")}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition"
      >
        Ir al portal de planes
      </button>

      {/* Información adicional */}
      <p className="text-sm text-gray-500 mt-4">
        Si ya realizaste el pago o cambio de plan, actualizá la página o esperá unos
        segundos.
      </p>

      <p className="text-xs text-gray-400 mt-2">
        © {new Date().getFullYear()} VAI - Todos los derechos reservados
      </p>
    </div>
  );
}
