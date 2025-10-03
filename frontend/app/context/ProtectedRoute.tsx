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
    // Si ya terminó de cargar y no hay usuario → mandar al login
    if (!loading && !user && pathname !== "/login" && pathname !== "/register") {
      router.replace("/login");
    }
  }, [user, loading, pathname, router]);

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

  // Caso: sin usuario, pero en login o register → mostrar esa página
  if (!user && (pathname === "/login" || pathname === "/register")) {
    return <>{children}</>;
  }

  // Caso: usuario autenticado → mostrar la app
  if (user) {
    return <>{children}</>;
  }

  // Fallback (seguridad extra)
  return null;
}
