"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "#lib/supabaseClient";
import { Menu, X } from "lucide-react"; // para el ícono del menú responsive

interface HeaderProps {
  user: any;
  logout: () => void;
  color?: string;
  onToggleSidebar?: () => void; // ✅ nuevo: callback para abrir/cerrar sidebar
}

interface EmpresaData {
  nombre_comercial: string | null;
  matriculado: string | null;
  cpi: string | null;
  razon_social: string | null;
}

export default function DashboardHeader({
  user,
  logout,
  color,
  onToggleSidebar,
}: HeaderProps) {
  const { logoUrl, primaryColor } = useTheme(); // ✅ color dinámico
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // 🔹 Rol del usuario
  const role: string = user?.role || user?.user_metadata?.role || "empresa";
  const nombre: string =
    user?.user_metadata?.nombre ||
    user?.nombre ||
    user?.email?.split("@")[0] ||
    "Usuario";

  // 🔹 Cargar datos de empresa
  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!user || (role !== "empresa" && role !== "asesor")) return;

      const userId =
        user?.id || user?.user_metadata?.id_usuario || user?.user_metadata?.empresa_id;
      if (!userId) return;

      let query = supabase
        .from("empresas")
        .select("nombre_comercial, matriculado, cpi, razon_social");

      if (role === "empresa") query = query.eq("user_id", userId);
      if (role === "asesor") query = query.eq("id", user?.user_metadata?.empresa_id);

      const { data, error } = await query.single();
      if (!error && data) setEmpresa(data);
    };

    fetchEmpresa();
  }, [user, role]);

  // 🔹 Etiqueta del rol
  const roleLabel =
    role === "empresa"
      ? "EMPRESA"
      : role === "asesor"
      ? "ASESOR"
      : role === "soporte"
      ? "SOPORTE"
      : role === "super_admin" || role === "super_admin_root"
      ? "ADMIN"
      : "USUARIO";

  // 🎨 Color de fondo
  const bgColor = primaryColor || color || "#004AAD";

  return (
    <header
      className="w-full flex items-center justify-between px-4 sm:px-6 py-4 shadow-sm fixed top-0 left-0 z-50"
      style={{ backgroundColor: bgColor }}
    >
      {/* 🔹 IZQUIERDA: logo + rol */}
      <div className="flex items-center gap-3">
        {/* 🟢 Botón menú hamburguesa (solo móvil) */}
        <button
          className="sm:hidden text-white focus:outline-none"
          onClick={() => {
            setMenuOpen(!menuOpen);
            if (onToggleSidebar) onToggleSidebar();
          }}
        >
          {menuOpen ? <X size={26} /> : <Menu size={26} />}
        </button>

        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            className="h-9 sm:h-10 object-contain drop-shadow-md"
          />
        ) : (
          <h1 className="text-white font-semibold text-lg">VAI Dashboard</h1>
        )}

        <div className="flex flex-col">
          <span className="text-white font-semibold text-xs uppercase tracking-wide">
            {roleLabel}
          </span>
          {empresa?.nombre_comercial && (
            <span className="text-white/80 text-xs truncate max-w-[120px] sm:max-w-[180px]">
              {empresa.nombre_comercial}
            </span>
          )}
        </div>
      </div>

      {/* 🔹 DERECHA: información y logout */}
      <div className="hidden sm:flex items-center gap-6 text-white">
        {role === "empresa" && empresa?.razon_social ? (
          <span className="font-medium text-sm">
            {empresa.razon_social}
          </span>
        ) : role === "asesor" ? (
          <span className="font-medium text-sm">
            Asesor: {nombre}
          </span>
        ) : (
          <span className="font-medium text-sm">{nombre}</span>
        )}

        {/* 🔸 Botón logout */}
        <button
          onClick={logout}
          className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md text-sm font-medium transition"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
