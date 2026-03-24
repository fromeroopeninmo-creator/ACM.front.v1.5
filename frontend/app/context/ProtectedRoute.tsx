"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "#lib/supabaseClient";
import { useEmpresa } from "@/hooks/useEmpresa";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { empresa, isLoading: isEmpresaLoading } = useEmpresa();
  const router = useRouter();
  const pathname = usePathname();
  const [checkingPlan, setCheckingPlan] = useState(true);

  // ⛑️ Nuevo: rol efectivo (evita defaultear a "empresa" antes de tiempo)
  const [effectiveRole, setEffectiveRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState<boolean>(true);

  useEffect(() => {
    if (loading) return; // Esperar a que cargue sesión

    // Si no hay usuario → redirigir al login
    if (!user) {
      router.replace("/auth/login");
      return;
    }

    // 1) Resolver rol efectivo:
    //    - Primero intentamos con user.role / user_metadata.role
    //    - Si no está, leemos desde profiles para no asumir "empresa"
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
    if (loading) return;        // aún cargando sesión
    if (!user) return;          // ya manejado arriba
    if (roleLoading) return;    // ⚠️ esperar rol efectivo

    // 🧭 Control de acceso por rol (solo cuando ya sabemos el rol real)
    const role = effectiveRole;
    if (!role) return; // si no pudimos resolver rol todavía, no redirigir

    const roleDashboard: Record<string, string> = {
      super_admin_root: "/dashboard/admin",
      super_admin: "/dashboard/admin",
      soporte: "/dashboard/soporte",
      empresa: "/dashboard/empresa",
      asesor: "/dashboard/asesor",
    };
    const target = roleDashboard[role] || "/dashboard";

    // Redirigir a su dashboard correspondiente (evitar empujar a empresa por default)
    if (pathname.startsWith("/dashboard")) {
      if (!pathname.startsWith(target)) {
        router.replace(target);
        return;
      }
    }

    // 🧩 Validación de plan solo para EMPRESAS, usando empresa.id real
    const checkPlanStatus = async () => {
      if (role !== "empresa") {
        setCheckingPlan(false);
        return;
      }

      // Esperar a que cargue la empresa (para obtener su id)
      if (isEmpresaLoading) return;

      const empresaId = empresa?.id;
      if (!empresaId) {
        // Si no hay empresa todavía, no bloquear
        setCheckingPlan(false);
        return;
      }

      const { data: plan, error } = await supabase
        .from("empresas_planes")
        .select("id, fecha_fin, activo")
        .eq("empresa_id", empresaId)
        .eq("activo", true)
        .maybeSingle();

      if (error) {
        console.error("Error verificando plan:", error);
        setCheckingPlan(false);
        return;
      }

      if (plan) {
        const hoy = new Date();
        const vencimiento = new Date(plan.fecha_fin as any);

        // ⏰ Si el plan expiró → marcar como inactivo y redirigir
        if (hoy > vencimiento) {
          await supabase
            .from("empresas_planes")
            .update({ activo: false })
            .eq("id", plan.id);

          alert(
            "⏰ Tu plan de prueba ha expirado. Actualizá tu plan para continuar usando la app."
          );
          router.replace("/dashboard/empresa/planes");
          return;
        }
      }

      setCheckingPlan(false);
    };

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

  // Mostrar pantalla de carga mientras se verifica sesión, rol o plan
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
