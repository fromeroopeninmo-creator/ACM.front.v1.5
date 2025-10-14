"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import DashboardHeader from "./components/DashboardHeader";
import DashboardSidebar from "./components/DashboardSidebar";

/**
 * 🧱 DashboardLayout
 * Layout base del área autenticada (/dashboard/*)
 * 
 * - Controla autenticación y redirección si no hay usuario.
 * - Proporciona el Sidebar y Header globales.
 * - Mantiene consistencia visual entre todas las subrutas.
 * - Evita retornos null prematuros que causaban 404 en subrutas (empresa/cuenta, etc.).
 */

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { primaryColor } = useTheme();
  const router = useRouter();

  // 🔒 Estado para asegurar que no se renderice nada antes de validar auth
  const [authChecked, setAuthChecked] = useState(false);

  /**
   * 👇 Efecto que valida la sesión
   * - Espera a que se resuelva "loading" (AuthContext)
   * - Si no hay usuario, redirige al login
   * - Si hay usuario, marca authChecked como true
   */
  useEffect(() => {
    if (!loading) setAuthChecked(true);
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  /**
   * 🚧 Fase inicial: esperamos validación de sesión
   * - Importante: nunca retornar null aquí, para evitar SSR vacío (404)
   */
  if (!authChecked) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Cargando sesión...
      </div>
    );
  }

  /**
   * 🚫 Si la sesión fue validada y no hay usuario,
   * mostramos pantalla temporal de redirección
   */
  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-400">
        Redirigiendo al login...
      </div>
    );
  }

  /**
   * ✅ Render principal del dashboard autenticado
   * Estructura general: Sidebar + Header + Contenido
   */
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      {/* 🔹 Barra lateral */}
      <DashboardSidebar role={user.role || "empresa"} color={primaryColor} />

      {/* 🔹 Contenedor principal */}
      <div className="flex-1 flex flex-col">
        {/* Header superior */}
        <DashboardHeader user={user} logout={logout} color={primaryColor} />

        {/* Contenido dinámico de la página */}
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
