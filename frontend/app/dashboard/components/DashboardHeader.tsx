"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "#lib/supabaseClient";

interface HeaderProps {
  user: any;
  logout: () => void;
  color?: string;
}

interface EmpresaData {
  nombre_comercial: string | null;
}

export default function DashboardHeader({ user, logout, color }: HeaderProps) {
  const { logoUrl, primaryColor } = useTheme();
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null);

  const role: string = user?.role || user?.user_metadata?.role || "empresa";

  // ==============================
  // 🔹 Fetch con SWR
  // ==============================
  const fetchEmpresa = async (id: string) => {
    let query = supabase.from("empresas").select("nombre_comercial");

    if (role === "empresa") query = query.eq("id_usuario", id);
    if (role === "asesor") query = query.eq("id", user?.user_metadata?.empresa_id);

    const { data, error } = await query.single();
    if (error) throw error;
    return data;
  };

  const { data } = useSWR(
    user ? ["empresa_header", user.id] : null,
    () => fetchEmpresa(user!.id)
  );

  useEffect(() => {
    if (data) setEmpresa(data);
  }, [data]);

  // ==============================
  // 🔹 Etiqueta por rol
  // ==============================
  const roleLabel =
    role === "empresa"
      ? "Dashboard Empresa"
      : role === "asesor"
      ? "Dashboard Asesor"
      : role === "soporte"
      ? "Dashboard Soporte"
      : role === "super_admin" || role === "super_admin_root"
      ? "Dashboard Admin"
      : "Dashboard";

  // ==============================
  // 🔹 Render principal
  // ==============================
  return (
    <header
      className="flex justify-between items-center px-8 py-4 shadow-sm"
      style={{ backgroundColor: primaryColor || color }}
    >
      {/* IZQUIERDA - LOGO + TÍTULO */}
      <div className="flex items-center gap-4">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo Empresa"
            className="h-10 w-auto object-contain rounded-md bg-white/10 p-1"
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
