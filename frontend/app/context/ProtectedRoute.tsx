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
    // 🚨 Si no hay usuario y terminó el loading, redirigir
    if (!loading && !user && pathname !== "/login" && pathname !== "/register") {
      router.replace("/login");
    }
  }, [user, loading, pathname, router]);

  // Mientras carga la sesión → spinner
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "18px",
          fontWeight: "bold",
        }}
      >
        Cargando sesión...
      </div>
    );
  }

  // Si está en login o register y no hay user
  if (!user && (pathname === "/login" || pathname === "/register")) {
    return <>{children}</>;
  }

  // Si hay user
  if (user) {
    return <>{children}</>;
  }

  // fallback de seguridad
  return null;
}
