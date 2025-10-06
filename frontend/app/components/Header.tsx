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
        w-full
      "
      style={{
        height: "70px", // 🔒 altura fija en desktop
        overflow: "hidden", // evita que el logo sobresalga
      }}
    >
      {/* Izquierda */}
      <div className="text-xs sm:text-sm font-semibold text-gray-700 text-center md:text-left leading-tight mb-1 md:mb-0">
        <p>{user.matriculado_nombre || "—"}</p>
        <p>CPI: {user.cpi || "—"}</p>
      </div>

      {/* Centro (Logo responsive) */}
      <div className="flex justify-center items-center h-full order-first md:order-none">
        <img
          src="/logo-vai4.png"
          alt="Logo VAI"
          className="object-contain"
          style={{
            height: "100%", // ocupa toda la altura del header
            maxHeight: "70px", // no supera el alto del header
            width: "auto",
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
    </header>
  );
}
