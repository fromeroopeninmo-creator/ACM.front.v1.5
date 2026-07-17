// frontend/app/dashboard/layout.tsx

"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { BillingProvider } from "@/context/BillingContext";
import { supabase } from "#lib/supabaseClient";
import DashboardHeader from "./components/DashboardHeader";
import DashboardSidebar from "./components/DashboardSidebar";

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
  const [effectiveRole, setEffectiveRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!loading) setAuthChecked(true);

    const isAuthRoute = pathname?.startsWith("/auth/");
    if (!loading && !user && !isAuthRoute) {
      router.replace("/auth/login");
    }
  }, [user, loading, router, pathname]);

  // Rol efectivo: primero AuthContext; para cuentas históricas, profiles.id o profiles.user_id.
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
        const userId = (user as any).id as string;

        const { data: profileById, error: profileByIdError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        let resolvedRole =
          !profileByIdError && profileById?.role ? profileById.role : null;

        if (!resolvedRole) {
          const { data: profileByUserId, error: profileByUserIdError } =
            await supabase
              .from("profiles")
              .select("role")
              .eq("user_id", userId)
              .maybeSingle();

          if (!profileByUserIdError && profileByUserId?.role) {
            resolvedRole = profileByUserId.role;
          }
        }

        if (mounted) {
          setEffectiveRole(resolvedRole);
          setRoleLoading(false);
        }
      } catch {
        if (mounted) {
          setEffectiveRole(null);
          setRoleLoading(false);
        }
      }
    }

    void ensureRole();

    return () => {
      mounted = false;
    };
  }, [user]);

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

  if (roleLoading || !effectiveRole) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Preparando tu panel...
      </div>
    );
  }

  const isCliente = effectiveRole === "asesor" || effectiveRole === "empresa";
  const sidebarColor = isCliente ? primaryColor || "#2563eb" : "#2563eb";
  const userId = ((user as any)?.id as string | undefined) ?? null;

  return (
    <BillingProvider
      enabled={isCliente}
      role={effectiveRole}
      userId={userId}
    >
      <div className="flex min-h-screen bg-gray-50 text-gray-900">
        <DashboardSidebar role={effectiveRole} color={sidebarColor} />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader
            user={{ ...user, role: effectiveRole }}
            logout={logout}
            color={sidebarColor}
          />
          <main className="flex-1 p-6 overflow-y-auto min-w-0">{children}</main>
        </div>
      </div>
    </BillingProvider>
  );
}
