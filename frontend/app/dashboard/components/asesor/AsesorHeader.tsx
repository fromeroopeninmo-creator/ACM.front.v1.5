"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "#lib/supabaseClient";
import Link from "next/link";

interface EmpresaData {
  nombre_comercial: string | null;
  matriculado: string | null;
  cpi: string | null;
}

export default function AsesorHeader() {
  const { user, logout } = useAuth();
  const { logoUrl, primaryColor } = useTheme();
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null);

  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!user || !user.empresa_id) return;

      const { data, error } = await supabase
        .from("empresas")
        .select("nombre_comercial, matriculado, cpi")
        .eq("id", user.empresa_id)
        .single();

      if (!error && data) setEmpresa(data);
    };

    fetchEmpresa();
  }, [user]);

  if (!user) return null;

  return (
    <header
      className="flex justify-between items-center px-6 py-4 shadow-sm"
      style={{ backgroundColor: primaryColor }}
    >
      {/* 🔹 IZQUIERDA */}
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo Empresa"
            className="h-9 object-contain"
          />
        ) : (
          <h1 className="text-white font-semibold">Panel Asesor</h1>
        )}
      </div>

      {/* 🔹 CENTRO */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/asesor"
          className="px-4 py-2 rounded-md bg-white text-gray-800 font-semibold text-sm hover:bg-gray-100 shadow-sm transition"
        >
          Volver al Dashboard
        </Link>

        <button
          onClick={logout}
          className="px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 text-white font-semibold text-sm shadow-sm transition"
        >
          Cerrar Sesión
        </button>
      </div>

      {/* 🔹 DERECHA */}
      <div className="flex flex-col items-end text-right text-white text-sm">
        <span className="font-semibold">
          Matriculado/a: {empresa?.matriculado || "—"}
        </span>
        <span className="text-white/90 text-xs">
          CPI: {empresa?.cpi || "—"}
        </span>
        <span className="text-white/90 text-xs">
          Asesor: {user.nombre || "—"}
        </span>
      </div>
    </header>
  );
}
