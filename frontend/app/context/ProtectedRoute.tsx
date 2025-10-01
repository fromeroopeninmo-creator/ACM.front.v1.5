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
    if (!loading && !user && pathname !== "/login" && pathname !== "/register") {
      router.push("/login");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return <p>Cargando sesión...</p>; // 👈 indicador temporal
  }

  // Si está en login/register y no hay usuario → mostrar la página normal
  if (!user && (pathname === "/login" || pathname === "/register")) {
    return <>{children}</>;
  }

  // Si hay usuario → mostrar la app
  if (user) {
    return <>{children}</>;
  }

  // Fallback
  return null;
}
