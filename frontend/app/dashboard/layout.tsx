"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "#lib/supabaseClient";
import DashboardHeader from "./components/DashboardHeader";
import DashboardSidebar from "./components/DashboardSidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { primaryColor, hydrated } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const [authChecked, setAuthChecked] = useState(false);

  // Rol efectivo (evita default a "empresa" antes de tiempo)
  const [effectiveRole, setEffectiveRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!loading) setAuthChecked(true);

    const isAuthRoute = pathname?.startsWith("/auth/");
    if (!loading && !user && !isAuthRoute) {
      router.replace("/auth/login");
    }
  }, [user, loading, router, pathname]);

  // Cargar rol efectivo: primero user.role, si no está, leer de profiles
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

  // ✅ Esperar a que AuthContext y ThemeContext estén listos
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

  // 🧠 Si aún no sabemos el rol, no renderizamos Sidebar/Header para evitar caer en defaults (empresa)
  if (roleLoading || !effectiveRole) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Preparando tu panel...
      </div>
    );
  }

  // 🧠 Solo los asesores y empresas heredan el color corporativo de su empresa
  // Soporte/Admin: azul unificado #2563eb
  const isCliente = effectiveRole === "asesor" || effectiveRole === "empresa";
  const sidebarColor = isCliente ? (primaryColor || "#2563eb") : "#2563eb";

  /* 🔒 CONTROL DE UN SOLO DISPOSITIVO POR USUARIO (cualquier rol) */
  useEffect(() => {
    if (!user || !effectiveRole) return;
    if (pathname?.startsWith("/auth/")) return;

    let cancelled = false;

    async function syncDevice() {
      try {
        if (typeof window === "undefined") return;

        const STORAGE_KEY = "vaiprop_device_id";
        let deviceId = window.localStorage.getItem(STORAGE_KEY);
        let isNewDevice = false;

        if (!deviceId) {
          // Primera vez que este navegador usa la app → genera un id
          if (window.crypto && "randomUUID" in window.crypto) {
            deviceId = window.crypto.randomUUID();
          } else {
            deviceId = Math.random().toString(36).slice(2);
          }
          window.localStorage.setItem(STORAGE_KEY, deviceId);
          isNewDevice = true;
        }

        const res = await fetch("/api/auth/device", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            device_id: deviceId,
            // Si es un navegador nuevo → reclama la sesión
            claim: isNewDevice,
          }),
        });

        if (!res.ok) {
          console.error("Error /api/auth/device:", await res.text());
          return;
        }

        const data = await res.json();
        if (!data.active && !cancelled) {
          // Otro dispositivo tiene la sesión → deslogueamos acá
          alert(
            "Tu cuenta inició sesión en otro dispositivo. Te desconectamos en este equipo por seguridad."
          );
          logout();
        }
      } catch (err) {
        console.error("Error verificando dispositivo activo:", err);
      }
    }

    syncDevice();

    return () => {
      cancelled = true;
    };
  }, [user, effectiveRole, pathname, logout]);
  /* 🔒 FIN CONTROL UN DISPOSITIVO */

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
