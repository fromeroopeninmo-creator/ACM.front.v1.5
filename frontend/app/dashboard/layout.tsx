"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import DashboardHeader from "./components/DashboardHeader";
import DashboardSidebar from "./components/DashboardSidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { color } = useTheme(); // color heredado del ThemeContext (solo si asesor)
  const router = useRouter();
  const pathname = usePathname();

  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!loading) setAuthChecked(true);

    const isAuthRoute = pathname?.startsWith("/auth/");
    if (!loading && !user && !isAuthRoute) {
      router.replace("/auth/login");
    }
  }, [user, loading, router, pathname]);

  if (!authChecked) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Cargando sesión...
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

  // 🧠 Condición: solo asesores heredan color corporativo
  const sidebarColor =
    user.role === "asesor" ? color : "#004AAD"; // default color corporativo general

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <DashboardSidebar role={user.role || "empresa"} color={sidebarColor} />
      <div className="flex-1 flex flex-col">
        <DashboardHeader user={user} logout={logout} color={sidebarColor} />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
