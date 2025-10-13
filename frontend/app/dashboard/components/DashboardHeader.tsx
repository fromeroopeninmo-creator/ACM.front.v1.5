"use client";

import { useTheme } from "../../../context/ThemeContext"; // ← ruta corregida (relativa)

interface HeaderProps {
  user: any;
  logout: () => void;
  color?: string;
}

export default function DashboardHeader({ user, logout, color }: HeaderProps) {
  const { logoUrl } = useTheme();

  return (
    <header
      className="flex justify-between items-center px-6 py-3 shadow-sm"
      style={{ backgroundColor: color }}
    >
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-8" />
        ) : (
          <h1 className="text-white font-semibold">ACM Dashboard</h1>
        )}
        <span className="text-white/80 text-sm">
          {user.role === "super_admin_root"
            ? "Super Admin Root"
            : user.role === "super_admin"
            ? "Super Admin"
            : user.role === "soporte"
            ? "Soporte Técnico"
            : user.role === "empresa"
            ? "Panel Empresa"
            : "Asesor"}
        </span>
      </div>

      <button
        onClick={logout}
        className="bg-white text-sm text-gray-800 font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition"
      >
        Cerrar sesión
      </button>
    </header>
  );
}
