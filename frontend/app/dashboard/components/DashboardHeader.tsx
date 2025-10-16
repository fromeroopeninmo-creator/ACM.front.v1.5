"use client";

import { useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useEmpresa } from "@/hooks/useEmpresa";

interface HeaderProps {
  user: any;
  logout: () => void;
  color?: string;
}

export default function DashboardHeader({ user, logout, color }: HeaderProps) {
  const { logoUrl, primaryColor, reloadTheme } = useTheme();
  const { empresa } = useEmpresa();

  const role: string = user?.role || user?.user_metadata?.role || "empresa";

  // 🔄 Cuando se dispare el evento global de tema, recargamos color/logo
  useEffect(() => {
    const handleThemeUpdate = async () => {
      await reloadTheme();
    };
    window.addEventListener("themeUpdated", handleThemeUpdate);
    return () => window.removeEventListener("themeUpdated", handleThemeUpdate);
  }, [reloadTheme]);

  // Etiqueta por rol (podemos incluir el nombre comercial si existe)
  const roleLabelBase =
    role === "empresa"
      ? "Dashboard Empresa"
      : role === "asesor"
      ? "Dashboard Asesor"
      : role === "soporte"
      ? "Dashboard Soporte"
      : role === "super_admin" || role === "super_admin_root"
      ? "Dashboard Admin"
      : "Dashboard";

  const roleLabel =
    role === "empresa" && empresa?.nombre_comercial
      ? `${roleLabelBase} · ${empresa.nombre_comercial}`
      : roleLabelBase;

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
            alt="Logo Empresa"
            className="h-10 w-auto object-contain rounded-md bg-white/10 p-1 transition-all duration-300"
          />
        ) : (
          <div className="h-10 w-10 rounded-md bg-white/20" />
        )}

        <h1 className="text-white font-semibold text-lg tracking-wide select-none">
          {roleLabel}
        </h1>
      </div>

      {/* DERECHA - BOTÓN SALIR */}
      <div className="flex items-center">
        <button
          onClick={logout}
          className="bg-red-400 hover:bg-red-500 text-white font-medium text-sm px-4 py-2 rounded-md transition"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
