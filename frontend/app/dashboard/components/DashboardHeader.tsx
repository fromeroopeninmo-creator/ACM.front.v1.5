"use client";

import { useEffect, useMemo } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useEmpresa } from "@/hooks/useEmpresa";

interface HeaderProps {
  user: any;
  logout: () => void;
  color?: string; // opcional: compat con layouts anteriores
}

export default function DashboardHeader({ user, logout, color }: HeaderProps) {
  const { logoUrl, primaryColor, reloadTheme } = useTheme();
  const { empresa } = useEmpresa();

  const role: string = user?.role || user?.user_metadata?.role || "empresa";

  // 🔄 Recarga de tema cuando haya cambios globales (logo/color)
  useEffect(() => {
    const handleThemeUpdate = async () => {
      await reloadTheme();
    };
    window.addEventListener("themeUpdated", handleThemeUpdate);
    return () => window.removeEventListener("themeUpdated", handleThemeUpdate);
  }, [reloadTheme]);

  // 🏷️ Título por rol
  const title = useMemo(() => {
    if (role === "asesor") return "Dashboard Asesor";
    if (role === "empresa") return "Dashboard Empresa";
    if (role === "soporte") return "Dashboard Soporte";
    if (role === "super_admin" || role === "super_admin_root") return "Dashboard Admin";
    return "Dashboard";
  }, [role]);

  return (
    <header
      className="flex justify-between items-center px-8 py-4 shadow-sm"
      style={{ backgroundColor: primaryColor || color }}
    >
      {/* IZQUIERDA - LOGO + TÍTULO */}
      <div className="flex items-center gap-4">
        {logoUrl ? (
          <img
            key={logoUrl}
            src={logoUrl}
            alt="Logo"
            className="h-10 w-auto object-contain rounded-md bg-white/10 p-1 transition-all duration-300"
          />
        ) : (
          <div className="h-10 w-10 rounded-md bg-white/20" />
        )}

        <h1 className="text-white font-semibold text-lg tracking-wide select-none">
          {title}
        </h1>
      </div>

      {/* DERECHA - BOTÓN SALIR */}
      <div className="flex items-center">
        <button
          onClick={logout}
          className="bg-red-400 hover:bg-red-500 text-white font-medium text-sm px-4 py-2 rounded-md transition"
          aria-label="Cerrar sesión"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
