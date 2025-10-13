"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return; // Esperar a que cargue sesión
    if (!user) {
      router.replace("/login");
      return;
    }

    // 🧭 Redirecciones automáticas según rol y ruta
    const role = user.role || "empresa";

    const roleDashboard: Record<string, string> = {
      super_admin_root: "/dashboard/admin",
      super_admin: "/dashboard/admin",
      soporte: "/dashboard/soporte",
      empresa: "/dashboard/empresa",
      asesor: "/dashboard/asesor",
    };

    const target = roleDashboard[role];

    // Si el usuario intenta entrar a otra ruta que no le pertenece, redirigirlo
    if (pathname.startsWith("/dashboard")) {
      if (!pathname.startsWith(target)) {
        router.replace(target);
      }
    }
  }, [loading, user, pathname, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Cargando...
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
