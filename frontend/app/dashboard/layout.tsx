"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "#lib/supabaseClient";
import DashboardHeader from "./components/DashboardHeader";
import DashboardSidebar from "./components/DashboardSidebar";

/* =========================================================
   🔕 Bloqueo multi-dispositivo DESACTIVADO
   (hook reducido a no-op para volver al comportamiento anterior)
========================================================= */
function useSingleDeviceSession(_user: any, _logout: () => void) {
  // No hacemos ningún chequeo de dispositivo.
  // Siempre consideramos la sesión activa en este navegador.
  const [checking] = useState(false);
  const [active] = useState(true);
  return { checking, active };
}

/* =========================================================
   Layout principal de Dashboard
========================================================= */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const { primaryColor, hydrated } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const [authChecked, setAuthChecked] = useState(false);

  // Rol efectivo (evita default a "empresa" antes de tiempo)
  const [effectiveRole, setEffectiveRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState<boolean>(true);

  /* ---------- Auth básica + redirect a login ---------- */
  useEffect(() => {
    if (!loading) setAuthChecked(true);

    const isAuthRoute = pathname?.startsWith("/auth/");
    if (!loading && !user && !isAuthRoute) {
      router.replace("/auth/login");
    }
  }, [user, loading, router, pathname]);

  /* ---------- Cargar rol efectivo ---------- */
  useEffect(() => {
    let mounted = true;

    async function ensureRole() {
      if (!user) {
        if (mounted) {
          setEffectiveRole(null);
          setRoleLoading(false);
        }
        return;
      }

      const inlineRole =
        (user as any).role || (user as any)?.user_metadata?.role || null;

      if (inlineRole) {
        if (mounted) {
          setEffectiveRole(inlineRole);
          setRoleLoading(false);
        }
        return;
      }

      try {
        setRoleLoading(true);
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", (user as any).id)
          .maybeSingle();

        if (mounted) {
          setEffectiveRole(error ? null : (data?.role ?? null));
          setRoleLoading(false);
        }
      } catch {
        if (mounted) {
          setEffectiveRole(null);
          setRoleLoading(false);
        }
      }
    }

    ensureRole();
    return () => {
      mounted = false;
    };
  }, [user]);

  /* ---------- Control de dispositivo único (desactivado) ---------- */
  const { checking: deviceChecking, active: deviceActive } = useSingleDeviceSession(
    user,
    logout
  );

  /* ---------- Distintos estados de carga / errores ---------- */

  // Esperando Auth / Theme
  if (loading || !authChecked || !hydrated) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Cargando entorno...
      </div>
    );
  }

  const isAuthRoute = pathname?.startsWith("/auth/");
  if (!user && isAuthRoute) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-400">
        Autenticando...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-400">
        Redirigiendo al login...
      </div>
    );
  }

  // Rol todavía no cargado
  if (roleLoading || !effectiveRole) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Preparando tu panel...
      </div>
    );
  }

  // (deviceChecking / deviceActive quedan siempre en: false / true)
  if (deviceChecking) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Verificando tu sesión en este dispositivo...
      </div>
    );
  }

  if (!deviceActive) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500 text-center px-4">
        <div>
          <p className="mb-2">
            Esta sesión se cerró porque iniciaste sesión en otro dispositivo.
          </p>
          <p className="text-sm text-gray-400">
            Si necesitás volver a entrar desde aquí, iniciá sesión nuevamente.
          </p>
        </div>
      </div>
    );
  }

  /* ---------- Layout normal ---------- */

  // Solo asesores y empresas heredan el color de su empresa
  const isCliente = effectiveRole === "asesor" || effectiveRole === "empresa";
  const sidebarColor = isCliente ? primaryColor || "#2563eb" : "#2563eb";

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <DashboardSidebar role={effectiveRole} color={sidebarColor} />
      <div className="flex-1 flex flex-col">
        <DashboardHeader
          user={{ ...user, role: effectiveRole }}
          logout={logout}
          color={sidebarColor}
        />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
