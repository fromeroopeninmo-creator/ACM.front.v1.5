"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "#lib/supabaseClient";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checkingPlan, setCheckingPlan] = useState(true);

  useEffect(() => {
    if (loading) return; // Esperar a que cargue sesión

    // Si no hay usuario → redirigir al login
    if (!user) {
      router.replace("/login");
      return;
    }

    // 🧭 Control de acceso por rol
    const role = user.role || "empresa";

    const roleDashboard: Record<string, string> = {
      super_admin_root: "/dashboard/admin",
      super_admin: "/dashboard/admin",
      soporte: "/dashboard/soporte",
      empresa: "/dashboard/empresa",
      asesor: "/dashboard/asesor",
    };

    const target = roleDashboard[role];

    // Redirigir a su dashboard correspondiente
    if (pathname.startsWith("/dashboard")) {
      if (!pathname.startsWith(target)) {
        router.replace(target);
      }
    }

    // 🧩 Validación de plan solo para EMPRESAS
    const checkPlanStatus = async () => {
      if (role !== "empresa") {
        setCheckingPlan(false);
        return;
      }

      const { data: plan, error } = await supabase
        .from("empresas_planes")
        .select("id, fecha_fin, activo")
        .eq("empresa_id", user.id)
        .eq("activo", true)
        .maybeSingle();

      if (error) {
        console.error("Error verificando plan:", error);
        setCheckingPlan(false);
        return;
      }

      if (plan) {
        const hoy = new Date();
        const vencimiento = new Date(plan.fecha_fin);

        // ⏰ Si el plan expiró → marcar como inactivo y redirigir
        if (hoy > vencimiento) {
          await supabase
            .from("empresas_planes")
            .update({ activo: false })
            .eq("id", plan.id);

          alert("⏰ Tu plan de prueba ha expirado. Actualizá tu plan para continuar usando la app.");
          router.replace("/dashboard/empresa/planes");
          return;
        }
      }

      setCheckingPlan(false);
    };

    checkPlanStatus();
  }, [loading, user, pathname, router]);

  // Mostrar pantalla de carga mientras se verifica sesión o plan
  if (loading || checkingPlan) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Cargando...
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
