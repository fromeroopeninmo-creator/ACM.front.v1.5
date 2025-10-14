"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import DashboardHeader from "./components/DashboardHeader";
import DashboardSidebar from "./components/DashboardSidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { primaryColor } = useTheme();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  // 🔐 Esperar confirmación de sesión antes de montar
  useEffect(() => {
    if (!loading) setAuthChecked(true);
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  // Mostrar pantalla de carga inicial hasta confirmar sesión
  if (!authChecked) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Cargando sesión...
      </div>
    );
  }

  // Si no hay usuario (y ya se verificó sesión)
  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-400">
        Redirigiendo al login...
      </div>
    );
  }

  // ✅ Render principal
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <DashboardSidebar role={user.role || "empresa"} color={primaryColor} />
      <div className="flex-1 flex flex-col">
        <DashboardHeader user={user} logout={logout} color={primaryColor} />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
