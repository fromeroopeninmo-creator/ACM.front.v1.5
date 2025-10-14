"use client";

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
  matriculado: string | null;
  cpi: string | null;
  razon_social: string | null;
}

export default function DashboardHeader({ user, logout, color }: HeaderProps) {
  const { logoUrl, primaryColor } = useTheme(); // ✅ traemos color del contexto en tiempo real
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null);

  // 🔹 Detectar rol y nombre
  const role: string =
    user?.role ||
    user?.user_metadata?.role ||
    "empresa";

  const nombre: string =
    user?.user_metadata?.nombre ||
    user?.nombre ||
    user?.email?.split("@")[0] ||
    "Usuario";

  // 🔹 Si es empresa o asesor, buscar los datos del matriculado
  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!user || (role !== "empresa" && role !== "asesor")) return;

      const userId =
        user?.id || user?.user_metadata?.id_usuario || user?.user_metadata?.empresa_id;
      if (!userId) return;

      let query = supabase
        .from("empresas")
        .select("nombre_comercial, matriculado, cpi, razon_social");

      if (role === "empresa") query = query.eq("id_usuario", userId);
      if (role === "asesor") query = query.eq("id", user?.user_metadata?.empresa_id);

      const { data, error } = await query.single();

      if (!error && data) setEmpresa(data);
    };

    fetchEmpresa();
  }, [user, role]);

  // 🔹 Determinar texto del tipo de usuario
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

  // 🔹 Renderizado principal
  return (
    <header
      className="flex justify-between items-center px-6 py-4 shadow-sm" // 📏 aumentamos padding vertical (antes py-3)
      style={{ backgroundColor: primaryColor || color }} // ✅ color realtime desde ThemeContext
    >
      {/* 🔹 IZQUIERDA */}
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-9" /> // 📏 levemente más alto
        ) : (
          <h1 className="text-white font-semibold">VAI Dashboard</h1>
        )}

        {/* 🔸 Texto de tipo de usuario */}
        <span className="text-white font-semibold text-sm uppercase tracking-wide">
          {roleLabel}
        </span>

        {/* 🔸 Datos complementarios */}
        <div className="flex flex-col leading-tight">
          {role === "empresa" && empresa ? (
            <>
              <span className="text-white font-medium text-sm">
                Matriculado: {empresa.matriculado || "—"}
              </span>
              <span className="text-white/80 text-xs">
                CPI: {empresa.cpi || "—"}
              </span>
            </>
          ) : role === "asesor" && empresa ? (
            <>
              <span className="text-white font-medium text-sm">
                Matriculado: {empresa.matriculado || "—"}
              </span>
              <span className="text-white/80 text-xs">
                CPI: {empresa.cpi || "—"}
              </span>
            </>
          ) : role === "soporte" ? (
            <span className="text-white font-semibold text-sm">
              Área de Soporte técnico y comercial
            </span>
          ) : role === "super_admin" || role === "super_admin_root" ? (
            <span className="text-white font-semibold text-sm">
              Gerencia General
            </span>
          ) : null}
        </div>
      </div>

      {/* 🔹 DERECHA */}
      <div className="flex items-center gap-4">
        {role === "empresa" && empresa?.razon_social ? (
          <span className="text-white font-semibold text-sm">
            Razón Social: {empresa.razon_social}
          </span>
        ) : role === "asesor" ? (
          <span className="text-white font-semibold text-sm">
            Asesor: {nombre}
          </span>
        ) : role === "soporte" ? (
          <span className="text-white font-semibold text-sm">
            Soporte: {nombre}
          </span>
        ) : role === "super_admin" || role === "super_admin_root" ? (
          <span className="text-white font-semibold text-sm">
            Admin: {nombre}
          </span>
        ) : null}

        {/* 🧹 Sin botón de cerrar sesión */}
      </div>
    </header>
  );
}
