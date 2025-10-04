"use client";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header className="flex flex-col md:flex-row justify-between items-center p-4 bg-gray-100 border-b">
      {/* Izquierda */}
      <div className="text-sm font-semibold text-gray-700 text-center md:text-left">
        <p>{user.matriculado_nombre || "—"}</p>
        <p>CPI: {user.cpi || "—"}</p>
      </div>

      {/* Centro */}
      <div className="my-2 md:my-0">
        <span className="text-xl font-bold">VMI</span>
      </div>

      {/* Derecha */}
      <div className="flex flex-col items-center md:items-end gap-2">
        <span className="font-medium">
          Asesor: {user.nombre} {user.apellido}
        </span>
        <button
          onClick={logout}
          className="px-3 py-1 text-sm border rounded bg-white hover:bg-gray-200"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
