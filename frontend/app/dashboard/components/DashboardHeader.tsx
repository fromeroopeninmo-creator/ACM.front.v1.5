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

  const isSoporte = role === "soporte";
  const isAdmin = role === "super_admin" || role === "super_admin_root";
  const isCliente = role === "empresa" || role === "asesor";

  // 🏷️ Título por rol
  const title = useMemo(() => {
    if (role === "asesor") return "Dashboard Asesor";
    if (role === "empresa") return "Dashboard Empresa";
    if (role === "soporte") return "Dashboard de Soporte";
    if (role === "super_admin" || role === "super_admin_root") return "Dashboard de Admin";
    return "Dashboard";
  }, [role]);

  // 🎨 Color de fondo:
  // - Soporte/Admin: azul por defecto (no dependemos del theme de clientes)
  // - Empresa/Asesor: como estaba (primaryColor o prop color)
  const headerBg = (isSoporte || isAdmin) ? "#004AAD" : (primaryColor || color);

  // 📱 Emitir toggle del Sidebar (drawer) en mobile
  const toggleSidebar = () => {
    const ev = new Event("vai:toggleSidebar");
    window.dispatchEvent(ev);
  };

  return (
    <header
      className="flex justify-between items-center px-4 md:px-8 py-3 md:py-4 shadow-sm"
      style={{ backgroundColor: headerBg }}
    >
      {/* IZQUIERDA - Hamburguesa (mobile) + Título + Logo clientes */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* 📱 Botón hamburguesa solo en mobile */}
        <button
          onClick={toggleSidebar}
          className="md:hidden p-2 rounded-md bg-white/10 hover:bg-white/20 text-white"
          aria-label="Abrir menú"
        >
          {/* Icono hamburguesa */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Logo solo para clientes (como estaba) */}
        {isCliente ? (
          logoUrl ? (
            <img
              key={logoUrl}
              src={logoUrl}
              alt="Logo"
              className="hidden sm:block h-8 md:h-10 w-auto object-contain rounded-md bg-white/10 p-1 transition-all duration-300"
            />
          ) : (
            <div className="hidden sm:block h-8 w-8 md:h-10 md:w-10 rounded-md bg-white/20" />
          )
        ) : null}

        <h1 className="text-white font-semibold text-base md:text-lg tracking-wide select-none">
          {title}
        </h1>
      </div>

      {/* DERECHA - Botón Salir (compacto en mobile) */}
      <div className="flex items-center">
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-medium text-xs md:text-sm px-3 md:px-4 py-2 rounded-md transition"
          aria-label="Cerrar sesión"
        >
          {/* Icono logout */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 3h4a2 2 0 0 1 2 2v4M10 14l5-5m0 0l-5-5m5 5H3" />
          </svg>
          <span className="hidden xs:inline md:inline">Cerrar sesión</span>
        </button>
      </div>
    </header>
  );
}
