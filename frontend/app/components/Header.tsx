"use client";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "#lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Header() {
  const { user } = useAuth(); // ⛔️ sacamos logout de acá (queda solo en DashboardHeader)
  const { primaryColor } = useTheme(); // se mantiene por si lo usás en otros lados
  const router = useRouter();

  const [empresa, setEmpresa] = useState<any>(null);

  // 🧠 Traer datos de empresa o empresa asociada del asesor
  useEffect(() => {
    if (!user) return;

    const fetchEmpresa = async () => {
      try {
        // Solo consultamos empresa si es "empresa" o si es "asesor" con empresa_id.
        const role = (user as any).role;
        const empresaId = (user as any).empresa_id;

        if (role !== "empresa" && !(role === "asesor" && empresaId)) {
          setEmpresa(null);
          return;
        }

        let query = supabase
          .from("empresas")
          .select("id, nombre_comercial, razon_social, matriculado, cpi, user_id");

        if (role === "empresa") {
          query = query.eq("user_id", (user as any).id);
        } else if (role === "asesor" && empresaId) {
          query = query.eq("id", empresaId);
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

  const role = (user as any).role || "empresa";
  const safeUser = user as any;

  // 🔹 Datos seguros
  const matriculado = empresa?.matriculado || "—";
  const cpi = empresa?.cpi || "—";
  const nombreAsesor =
    role === "asesor"
      ? `${safeUser.nombre ?? ""} ${safeUser.apellido ?? ""}`.trim() || "—"
      : "—";

  // Etiquetas para Soporte/Admin (solo visual)
  const nombreCompleto =
    `${safeUser.nombre ?? ""} ${safeUser.apellido ?? ""}`.trim() || "—";
  const isSoporte = role === "soporte";
  const isAdmin = role === "super_admin" || role === "super_admin_root";

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
        bg-black border-b border-gray-800 shadow-sm sticky top-0 z-50
        w-full transition-all duration-300
      "
    >
      {/* 🔹 MOBILE */}
      <div className="flex w-full items-center justify-between md:hidden">
        {/* Izquierda: datos */}
        <div className="flex flex-col text-[11px] sm:text-sm font-semibold text-white leading-tight text-left">
          {isSoporte ? (
            <p>Soporte: {nombreCompleto}</p>
          ) : isAdmin ? (
            <p>Admin: {nombreCompleto}</p>
          ) : (
            <>
              <p>Profesional: {matriculado}</p>
              <p>Matricula N°: {cpi}</p>
              <p>Asesor: {nombreAsesor}</p>
            </>
          )}

          {/* Botón volver */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => router.push(getDashboardRoute())}
              className="
                px-3 py-1 text-[11px] sm:text-xs font-medium
                bg-white text-black
                rounded border border-white/20 shadow
                hover:bg-gray-100 transition
              "
            >
              ⬅️ Volver al Dashboard
            </button>
          </div>
        </div>

        {/* Derecha: logo */}
        <div className="flex items-center justify-center flex-1 h-14 sm:h-16">
          <img
            src="/logo-vai7.png"
            alt="Logo VAI"
            className="
              object-contain
              h-full w-auto
              transition-transform duration-300
            "
            style={{
              maxHeight: "64px",
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
            className="
              px-4 py-2 text-sm font-semibold
              bg-white text-black
              border border-white/20 rounded-lg shadow
              hover:bg-gray-100 transition
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
            src="/logo-vai7.png"
            alt="Logo VAI"
            className="
              object-contain
              h-14 sm:h-16 lg:h-20
              w-auto
              transition-transform duration-300
            "
            style={{
              maxHeight: "80px",
              transformOrigin: "center center",
            }}
          />
        </div>

        {/* Derecha: datos alineados a la izquierda */}
        <div className="flex flex-col items-start gap-0.5 text-xs sm:text-sm font-semibold text-white leading-tight text-left">
          {isSoporte ? (
            <p>Soporte: {nombreCompleto}</p>
          ) : isAdmin ? (
            <p>Admin: {nombreCompleto}</p>
          ) : (
            <>
              <p>Profesional: {matriculado}</p>
              <p>Matricula N°: {cpi}</p>
              <p>Asesor: {nombreAsesor}</p>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
