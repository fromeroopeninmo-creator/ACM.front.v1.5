"use client";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header
      className="
        sticky top-0 z-50
        flex flex-col md:flex-row
        justify-between items-center
        p-4 bg-gray-100 border-b
        shadow-sm
      "
    >
      {/* Izquierda */}
      <div className="text-sm font-semibold text-gray-700 text-center md:text-left">
        <p>{user.matriculado_nombre || "—"}</p>
        <p>CPI: {user.cpi || "—"}</p>
      </div>

      {/* Centro (logo) */}
      <div className="flex justify-center items-center my-2 md:my-0">
        <Image
          src="/logo-vmi.png"
          alt="Logo VMI"
          width={90}   // 🔹 un poco más grande
          height={90}
          priority
        />
      </div>

      {/* Derecha */}
      <div className="flex flex-col items-center md:items-end gap-2">
        <span className="font-medium">
          Asesor: {user.nombre} {user.apellido}
        </span>
        <button
          onClick={logout}
          className="px-3 py-1 text-sm border rounded bg-white hover:bg-gray-200 transition"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
