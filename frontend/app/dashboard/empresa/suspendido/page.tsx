// frontend/app/dashboard/empresa/suspendido/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "#lib/supabaseClient";

/** Resuelve empresas.id para el usuario actual (dueño directo o perfil ligado) */
async function resolveEmpresaIdForUser(userId: string): Promise<string | null> {
  // 1) Empresa donde el usuario es dueño directo
  const { data: emp } = await supabase
    .from("empresas")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (emp?.id) return emp.id as string;

  // 2) Perfil con empresa asociada
  const { data: prof } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", userId)
    .maybeSingle();

  return (prof?.empresa_id as string) ?? null;
}

export default function CuentaSuspendidaPage() {
  const { user } = useAuth();
  const { primaryColor, logoUrl } = useTheme();
  const router = useRouter();

  const [checking, setChecking] = useState(true);

  const brandColor = useMemo(() => primaryColor || "#1e40af", [primaryColor]);

  // Si el usuario no está logueado → redirigir a login
  useEffect(() => {
    if (!user) router.replace("/auth/login");
  }, [user, router]);

  // 🚦 Verificar si la empresa volvió a tener plan activo
  useEffect(() => {
    const checkPlan = async () => {
      if (!user?.id) return;

      try {
        const empresaId =
          (user as any)?.empresa_id ||
          (await resolveEmpresaIdForUser(user.id));

        if (!empresaId) {
          setChecking(false);
          return;
        }

        const { data: planActivo, error } = await supabase
          .from("empresas_planes")
          .select("id")
          .eq("empresa_id", empresaId)
          .eq("activo", true)
          .maybeSingle();

        if (!error && planActivo) {
          // ✅ Tiene plan activo → redirigir al dashboard empresa
          router.replace("/dashboard/empresa");
          return;
        }
      } catch (err) {
        console.error("Error verificando plan activo:", err);
      } finally {
        setChecking(false);
      }
    };

    checkPlan();

    // chequeo suave cada 45s por si el pago se acreditó y el webhook activó el plan
    const t = setInterval(checkPlan, 45000);
    return () => clearInterval(t);
  }, [user, router]);

  // Cargando estado
  if (checking) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Verificando estado de tu cuenta...
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center items-center h-screen bg-gray-50 text-center px-6">
      {/* Logo / Marca */}
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="h-14 mb-4" />
      ) : (
        <h1 className="text-2xl font-bold mb-4" style={{ color: brandColor }}>
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
