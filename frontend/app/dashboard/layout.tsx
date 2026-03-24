"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "#lib/supabaseClient";
import DashboardHeader from "./components/DashboardHeader";
import DashboardSidebar from "./components/DashboardSidebar";

type BillingEstadoFlags = {
  suspendida?: boolean;
  suspendida_motivo?: string | null;
  suspendida_at?: string | null;
  plan_vencido?: boolean;
  dias_desde_vencimiento?: number | null;
  en_periodo_gracia?: boolean;
  requiere_seleccion_plan?: boolean;
};

type BillingEstadoResponse = {
  estado?: BillingEstadoFlags | null;
};

function isEmpresaBillingExemptPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/dashboard/empresa/suspendido")) return true;
  if (pathname.startsWith("/dashboard/empresa/planes")) return true;
  return false;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { primaryColor, hydrated } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const [authChecked, setAuthChecked] = useState(false);

  // Rol efectivo (evita default a "empresa" antes de tiempo)
  const [effectiveRole, setEffectiveRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState<boolean>(true);

  const [billingChecked, setBillingChecked] = useState(false);

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

  // Guard central de billing para empresa
  useEffect(() => {
    let cancelled = false;

    async function checkBilling() {
      if (loading || !user || roleLoading || !effectiveRole) return;

      // Solo aplica a empresa
      if (effectiveRole !== "empresa") {
        if (!cancelled) setBillingChecked(true);
        return;
      }

      // Rutas permitidas aun suspendido
      if (isEmpresaBillingExemptPath(pathname)) {
        if (!cancelled) setBillingChecked(true);
        return;
      }

      try {
        const res = await fetch("/api/billing/estado", { cache: "no-store" });

        if (!res.ok) {
          console.error("Error al consultar /api/billing/estado en DashboardLayout:", res.status);
          if (!cancelled) setBillingChecked(true);
          return;
        }

        const data: BillingEstadoResponse = await res.json();
        const estado = data?.estado;

        const debeSuspender =
          !!estado?.suspendida ||
          !!estado?.requiere_seleccion_plan ||
          (!!estado?.plan_vencido && !estado?.en_periodo_gracia);

        if (debeSuspender) {
          router.replace("/dashboard/empresa/suspendido");
          return;
        }

        if (!cancelled) setBillingChecked(true);
      } catch (err) {
        console.error("Error verificando billing en DashboardLayout:", err);
        if (!cancelled) setBillingChecked(true);
      }
    }

    setBillingChecked(false);
    checkBilling();

    return () => {
      cancelled = true;
    };
  }, [user, loading, roleLoading, effectiveRole, pathname, router]);

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

  // Esperar chequeo de billing antes de renderizar dashboard empresa
  if (effectiveRole === "empresa" && !billingChecked && !isEmpresaBillingExemptPath(pathname)) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Verificando estado de tu cuenta...
      </div>
    );
  }

  // 🧠 Solo los asesores y empresas heredan el color corporativo de su empresa
  // Soporte/Admin: azul unificado #2563eb
  const isCliente = effectiveRole === "asesor" || effectiveRole === "empresa";
  const sidebarColor = isCliente ? (primaryColor || "#2563eb") : "#2563eb";

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <DashboardSidebar role={effectiveRole} color={sidebarColor} />
      <div className="flex-1 flex flex-col">
        <DashboardHeader user={{ ...user, role: effectiveRole }} logout={logout} color={sidebarColor} />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
