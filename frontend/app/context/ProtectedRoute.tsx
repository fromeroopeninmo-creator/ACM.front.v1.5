"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "#lib/supabaseClient";
import { useEmpresa } from "@/hooks/useEmpresa";

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

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { empresa, isLoading: isEmpresaLoading } = useEmpresa();
  const router = useRouter();
  const pathname = usePathname();

  const [checkingPlan, setCheckingPlan] = useState(true);

  // ⛑️ Rol efectivo (evita defaultear a "empresa" antes de tiempo)
  const [effectiveRole, setEffectiveRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState<boolean>(true);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/auth/login");
      return;
    }

    let cancelled = false;

    async function resolveRole() {
      setRoleLoading(true);
      try {
        const inlineRole =
          (user as any)?.role || (user as any)?.user_metadata?.role || null;

        if (inlineRole) {
          if (!cancelled) {
            setEffectiveRole(inlineRole);
            setRoleLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", (user as any)?.id)
          .maybeSingle();

        if (!cancelled) {
          setEffectiveRole(error ? null : (data?.role ?? null));
          setRoleLoading(false);
        }
      } catch {
        if (!cancelled) {
          setEffectiveRole(null);
          setRoleLoading(false);
        }
      }
    }

    resolveRole();

    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (roleLoading) return;

    const role = effectiveRole;
    if (!role) return;

    const roleDashboard: Record<string, string> = {
      super_admin_root: "/dashboard/admin",
      super_admin: "/dashboard/admin",
      soporte: "/dashboard/soporte",
      empresa: "/dashboard/empresa",
      asesor: "/dashboard/asesor",
    };

    const target = roleDashboard[role] || "/dashboard";

    if (pathname.startsWith("/dashboard")) {
      if (!pathname.startsWith(target)) {
        router.replace(target);
        return;
      }
    }

    const checkPlanStatus = async () => {
      // No empresa => no aplica billing guard
      if (role !== "empresa") {
        setCheckingPlan(false);
        return;
      }

      // Rutas permitidas aunque la cuenta esté suspendida/sin plan
      if (isEmpresaBillingExemptPath(pathname)) {
        setCheckingPlan(false);
        return;
      }

      if (isEmpresaLoading) return;

      const empresaId = empresa?.id;

      // Si no pudimos resolver empresa, por seguridad redirigimos a suspendido
      if (!empresaId) {
        router.replace("/dashboard/empresa/suspendido");
        return;
      }

      try {
        const res = await fetch(
          `/api/billing/estado?empresaId=${encodeURIComponent(empresaId)}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          console.error("Error consultando /api/billing/estado en ProtectedRoute:", res.status);
          router.replace("/dashboard/empresa/suspendido");
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

        setCheckingPlan(false);
      } catch (error) {
        console.error("Error verificando billing en ProtectedRoute:", error);
        router.replace("/dashboard/empresa/suspendido");
      }
    };

    setCheckingPlan(true);
    checkPlanStatus();
  }, [
    loading,
    user,
    pathname,
    router,
    effectiveRole,
    roleLoading,
    empresa?.id,
    isEmpresaLoading,
  ]);

  if (loading || roleLoading || checkingPlan) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Cargando...
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
