"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "#lib/supabaseClient";
import DashboardHeader from "./components/DashboardHeader";
import DashboardSidebar from "./components/DashboardSidebar";

/* =========================================================
   Helper: ID de dispositivo (localStorage por navegador)
   (v2 para resetear cualquier basura vieja)
========================================================= */
function getOrCreateDeviceId(): string | null {
  if (typeof window === "undefined") return null;

  const STORAGE_KEY = "vai_device_id_v2";

  try {
    let existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && typeof existing === "string") {
      return existing;
    }

    let generated: string;
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      generated = window.crypto.randomUUID();
    } else {
      generated =
        Math.random().toString(36).slice(2) +
        "-" +
        Date.now().toString(36);
    }

    window.localStorage.setItem(STORAGE_KEY, generated);
    return generated;
  } catch {
    // Si localStorage está bloqueado o falla, no rompemos la app
    return null;
  }
}

/* =========================================================
   Hook: controla que solo un dispositivo esté activo por usuario
========================================================= */
function useSingleDeviceSession(user: any, logout: () => void) {
  const [checking, setChecking] = useState(true);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!user) {
      setChecking(false);
      setActive(false);
      return;
    }

    let cancelled = false;
    let intervalId: number | null = null;
    let deviceId: string | null = null;

    async function callDeviceApi(
      claim: boolean
    ): Promise<{ active: boolean; unauthenticated: boolean }> {
      try {
        if (typeof window === "undefined") {
          return { active: true, unauthenticated: false };
        }

        if (!deviceId) {
          deviceId = getOrCreateDeviceId();
        }

        if (!deviceId) {
          // No pudimos generar ID → no aplicamos restricción, pero no rompemos nada
          return { active: true, unauthenticated: false };
        }

        const res = await fetch("/api/auth/device", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ device_id: deviceId, claim }),
        });

        if (!res.ok) {
          console.warn("device api error:", res.status, res.statusText);
          return { active: true, unauthenticated: false };
        }

        const json = (await res.json().catch(() => ({}))) as {
          active?: boolean;
          unauthenticated?: boolean;
        };

        return {
          active: json.active !== false,
          unauthenticated: !!json.unauthenticated,
        };
      } catch (err) {
        console.warn("device api exception:", err);
        return { active: true, unauthenticated: false };
      }
    }

    async function init() {
      // Primer llamada: este dispositivo reclama la sesión
      const result = await callDeviceApi(true);
      if (cancelled) return;

      // Si Supabase dice que no hay sesión, lo dejamos en manos del AuthContext
      if (result.unauthenticated) {
        setChecking(false);
        setActive(true);
        return;
      }

      setActive(result.active);
      setChecking(false);

      if (!result.active) {
        // Otro dispositivo ya tomó la sesión → deslogueamos
        logout();
        return;
      }

      // Heartbeat: cada 30s chequeamos si seguimos siendo el dispositivo activo
      if (typeof window !== "undefined") {
        intervalId = window.setInterval(async () => {
          const checkResult = await callDeviceApi(false);
          if (cancelled) return;

          // Si el backend dice "unauthenticated", significa que ya no hay sesión válida,
          // pero eso ya lo manejará Supabase/AuthContext.
          if (checkResult.unauthenticated) {
            return;
          }

          if (!checkResult.active) {
            setActive(false);
            logout();
          }
        }, 30000) as unknown as number;
      }
    }

    init();

    return () => {
      cancelled = true;
      if (intervalId !== null && typeof window !== "undefined") {
        window.clearInterval(intervalId);
      }
    };
  }, [user, logout]);

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

  /* ---------- Control de dispositivo único ---------- */
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

  // Verificando dispositivo activo
  if (deviceChecking) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Verificando tu sesión en este dispositivo...
      </div>
    );
  }

  // Este dispositivo ya NO es el activo → mensaje mientras se hace logout/redirección
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
