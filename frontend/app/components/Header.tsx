// app/components/Header.tsx
"use client";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function Header() {
  const { user } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login"; // Redirige al login tras cerrar sesión
  };

  return (
    <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
      {/* 🔹 Datos del matriculado (cuando los tengamos en el perfil se mostrarán aquí) */}
      <div className="flex flex-col">
        <span className="text-lg font-bold">ACM - Análisis Comparativo de Mercado</span>
        {user?.user_metadata?.matriculado && (
          <span className="text-sm">
            {user.user_metadata.matriculado} - CPI {user.user_metadata.cpi}
          </span>
        )}
      </div>

      {/* 🔹 Lado derecho con bienvenida y logout */}
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span>
              Bienvenido/a:{" "}
              <strong>
                {user.user_metadata?.nombre ?? user.email}
              </strong>
            </span>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-sm"
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <span className="italic">No autenticado</span>
        )}
      </div>
    </header>
  );
}
