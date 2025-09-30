"use client";

import { useAuth } from "../context/AuthContext";

export default function Header() {
  const { user, loading } = useAuth();

  if (loading) return <div>Cargando...</div>;

  return (
    <header className="p-4 bg-gray-100 flex justify-between items-center">
      <h1 className="text-xl font-bold">ACM - Análisis Comparativo de Mercado</h1>
      {user ? (
        <div className="text-sm text-gray-700">
          Bienvenido/a: <b>{user.user_metadata?.matriculado ?? user.email}</b>{" "}
          (CPI: {user.user_metadata?.cpi ?? "N/A"})
        </div>
      ) : (
        <span className="text-sm text-gray-500">No has iniciado sesión</span>
      )}
    </header>
  );
}
