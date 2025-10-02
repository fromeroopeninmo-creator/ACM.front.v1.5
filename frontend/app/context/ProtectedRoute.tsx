"use client";
import { useAuth } from "./AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== "/login" && pathname !== "/register") {
        router.replace("/login");
      }
    }
  }, [user, loading, pathname, router]);

  // Mostrar un pequeño loader solo mientras carga sesión la primera vez
  if (loading) {
    return <p>Cargando sesión...</p>;
  }

  // Si no hay usuario y estamos en login/register → mostrar normalmente
  if (!user && (pathname === "/login" || pathname === "/register")) {
    return <>{children}</>;
  }

  // Si hay usuario → mostrar la app
  if (user) {
    return <>{children}</>;
  }

  // Evitar loops infinitos: si no hay user y no está en login/register → null
  return null;
}
