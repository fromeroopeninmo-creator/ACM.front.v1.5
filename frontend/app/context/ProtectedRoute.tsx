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
    // 🚨 Si no hay usuario y terminó el loading, redirigir a /login
    if (
      !loading &&
      !user &&
      pathname !== "/login" &&
      pathname !== "/register"
    ) {
      router.replace("/login");
    }
  }, [user, loading, pathname, router]);

  // Mientras carga la sesión → spinner amigable
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

  // Si no hay usuario y estamos en /login o /register → mostrar el form
  if (!user && (pathname === "/login" || pathname === "/register")) {
    return <>{children}</>;
  }

  // Si hay usuario → permitir acceder
  if (user) {
    return <>{children}</>;
  }

  // Fallback de seguridad
  return null;
}
