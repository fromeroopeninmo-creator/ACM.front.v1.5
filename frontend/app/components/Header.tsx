"use client";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header
      className="
        flex flex-col md:flex-row justify-between items-center
        px-4 md:px-6 py-2 md:py-3
        bg-gray-100 border-b shadow-sm sticky top-0 z-50
        w-full transition-all duration-300
      "
      style={{
        height: "auto", // flexible solo en mobile
        overflow: "hidden",
      }}
    >
      {/* 🔹 MOBILE: info izquierda / logo derecha */}
      <div className="flex w-full items-center justify-between md:hidden">
        {/* Izquierda */}
        <div className="flex flex-col text-[11px] sm:text-sm font-semibold text-gray-700 leading-tight">
          <p>{user.matriculado_nombre || "—"}</p>
          <p>CPI: {user.cpi || "—"}</p>
          <p>
            Asesor: {user.nombre} {user.apellido}
          </p>

          {/* Botón debajo del asesor */}
          <button
            onClick={logout}
            className="
              mt-2 px-3 py-1 text-[11px] sm:text-xs border rounded bg-white
              font-medium text-gray-700 hover:bg-gray-200 transition
              self-start
            "
          >
            Cerrar sesión
          </button>
        </div>

        {/* Derecha (logo más grande y equilibrado) */}
        <div className="flex items-center justify-center">
          <img
            src="/logo-vai4.png"
            alt="Logo VAI"
            className="
              object-contain
              h-[72px] sm:h-[80px]
              w-auto
              transition-transform duration-300
            "
            style={{
              maxHeight: "88px",
              transformOrigin: "center center",
            }}
          />
        </div>
      </div>

      {/* 🔹 DESKTOP: estructura original */}
      <div className="hidden md:flex w-full justify-between items-center">
        {/* Izquierda */}
        <div className="text-xs sm:text-sm font-semibold text-gray-700 text-left leading-tight">
          <p>{user.matriculado_nombre || "—"}</p>
          <p>CPI: {user.cpi || "—"}</p>
        </div>

        {/* Centro (logo más grande dentro del mismo alto) */}
        <div className="flex justify-center items-center h-full order-first md:order-none">
          <img
            src="/logo-vai4.png"
            alt="Logo VAI"
            className="
              object-contain
              h-full max-h-[72px] w-auto
              scale-[1.8] sm:scale-[2] md:scale-[2.2]
              transition-transform duration-300
            "
            style={{
              transformOrigin: "center center",
              maxWidth: "none",
            }}
          />
        </div>

        {/* Derecha */}
        <div className="flex flex-col items-center md:items-end gap-1 text-xs sm:text-sm">
          <span className="font-medium text-center md:text-right">
            Asesor: {user.nombre} {user.apellido}
          </span>
          <button
            onClick={logout}
            className="
              px-3 py-1 text-xs md:text-sm border rounded bg-white
              hover:bg-gray-200 transition
            "
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}
