"use client";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "#lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Header() {
  const { user } = useAuth(); // ⛔️ sacamos logout de acá (queda solo en DashboardHeader)
  const { primaryColor } = useTheme();
  const router = useRouter();

  const [empresa, setEmpresa] = useState<any>(null);

  // 🧠 Traer datos de empresa o empresa asociada del asesor
  useEffect(() => {
    if (!user) return;

    const fetchEmpresa = async () => {
      try {
        let query = supabase
          .from("empresas")
          .select("id, nombre_comercial, razon_social, matriculado, cpi, user_id");

        if (user.role === "empresa") {
          query = query.eq("user_id", user.id);
        } else if ((user as any).empresa_id) {
          query = query.eq("id", (user as any).empresa_id);
        }

        const { data, error } = await query.maybeSingle();
        if (!error && data) setEmpresa(data);
      } catch (err) {
        console.error("Error al obtener datos de empresa:", err);
      }
    };

    fetchEmpresa();
  }, [user]);

  if (!user) return null;

  const role = user.role || "empresa";
  const safeUser = user as any;

  // 🔹 Datos seguros
  const matriculado = empresa?.matriculado || "—";
  const cpi = empresa?.cpi || "—";
  const nombreAsesor =
    role === "asesor"
      ? `${safeUser.nombre ?? ""} ${safeUser.apellido ?? ""}`.trim() || "—"
      : "—";

  // 🔹 Ruta dinámica del dashboard
  const getDashboardRoute = () => {
    switch (role) {
      case "empresa":
        return "/dashboard/empresa";
      case "asesor":
        return "/dashboard/asesor";
      case "soporte":
        return "/dashboard/soporte";
      case "super_admin":
      case "super_admin_root":
        return "/dashboard/admin";
      default:
        return "/dashboard";
    }
  };

  return (
    <header
      className="
        flex flex-col md:flex-row justify-between items-center
        px-4 md:px-6 py-2 md:py-3
        bg-gray-100 border-b shadow-sm sticky top-0 z-50
        w-full transition-all duration-300
      "
    >
      {/* 🔹 MOBILE */}
      <div className="flex w-full items-center justify-between md:hidden">
        {/* Izquierda: datos */}
        <div className="flex flex-col text-[11px] sm:text-sm font-semibold text-gray-700 leading-tight text-left">
          <p>Matriculado/a: {matriculado}</p>
          <p>CPI: {cpi}</p>
          <p>Asesor: {nombreAsesor}</p>

          {/* Botón volver */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => router.push(getDashboardRoute())}
              style={{ backgroundColor: primaryColor }}
              className="
                px-3 py-1 text-[11px] sm:text-xs text-white font-medium
                rounded border border-gray-200 shadow hover:opacity-90 transition
              "
            >
              ⬅️ Volver al Dashboard
            </button>
          </div>
        </div>

        {/* Derecha: logo */}
        <div className="flex items-center justify-center flex-1">
          <img
            src="/logo-vai4.png"
            alt="Logo VAI"
            className="
              object-contain h-[88px] sm:h-[96px] w-auto
              transition-transform duration-300
            "
            style={{
              maxHeight: "104px",
              transformOrigin: "center center",
            }}
          />
        </div>
      </div>

      {/* 🔹 DESKTOP */}
      <div className="hidden md:flex w-full justify-between items-center relative">
        {/* Izquierda: botón volver */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push(getDashboardRoute())}
            style={{ backgroundColor: primaryColor }}
            className="
              px-4 py-2 text-sm font-semibold text-white
              border rounded-lg shadow hover:opacity-90 transition
            "
          >
            ⬅️ Volver al Dashboard
          </button>
        </div>

        {/* Centro: logo centrado */}
        <div
          className="
            absolute left-1/2 transform -translate-x-1/2
            flex justify-center items-center h-full
          "
        >
          <img
            src="/logo-vai4.png"
            alt="Logo VAI"
            className="
              object-contain
              h-full max-h-[72px] w-auto
              scale-[1.8] sm:scale-[2] md:scale-[2.2]
              transition-transform duration-300
            "
            style={{ transformOrigin: "center center", maxWidth: "none" }}
          />
        </div>

        {/* Derecha: datos alineados a la izquierda */}
        <div className="flex flex-col items-start gap-0.5 text-xs sm:text-sm font-semibold text-gray-700 leading-tight text-left">
          <p>Matriculado/a: {matriculado}</p>
          <p>CPI: {cpi}</p>
          <p>Asesor: {nombreAsesor}</p>
        </div>
      </div>
    </header>
  );
}
