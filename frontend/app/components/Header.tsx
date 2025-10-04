"use client";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header
      className="flex flex-col md:flex-row justify-between items-center px-6 py-3 bg-gray-100 border-b shadow-sm sticky top-0 z-50"
      style={{
        height: "70px", // 🔒 altura fija del header
        overflow: "hidden", // ✅ evita que el logo sobresalga
      }}
    >
      {/* Izquierda */}
      <div className="text-sm font-semibold text-gray-700 text-center md:text-left leading-tight">
        <p>{user.matriculado_nombre || "—"}</p>
        <p>CPI: {user.cpi || "—"}</p>
      </div>

      {/* Centro (Logo exactamente del alto del header) */}
      <div className="flex justify-center items-center h-full">
        <img
          src="/logo-vai.png"
          alt=""
          className="object-contain"
          style={{
            height: "80px", // ✅ mismo alto que el header
            width: "auto",
          }}
        />
      </div>

      {/* Derecha */}
      <div className="flex flex-col items-center md:items-end gap-1">
        <span className="font-medium text-sm md:text-base">
          Asesor: {user.nombre} {user.apellido}
        </span>
        <button
          onClick={logout}
          className="px-3 py-1 text-xs md:text-sm border rounded bg-white hover:bg-gray-200 transition"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
