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
    // 🚨 Si no hay usuario y terminó el loading, redirigir a login
    // Pero solo si no estamos en /auth/login o /auth/register
    if (
      !loading &&
      !user &&
      pathname !== "/auth/login" &&
      pathname !== "/auth/register"
    ) {
      router.replace("/auth/login");
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

  // Si no hay usuario y estamos en login/register → dejar ver el form
  if (!user && (pathname === "/auth/login" || pathname === "/auth/register")) {
    return <>{children}</>;
  }

  // Si hay usuario → permitir acceder
  if (user) {
    return <>{children}</>;
  }

  // Fallback de seguridad (si nada aplica)
  return null;
}
