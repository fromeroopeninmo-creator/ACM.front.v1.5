"use client";
import { useAuth } from "./AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth(); // ✅ ahora funciona
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== "/login" && pathname !== "/register") {
      router.push("/login");
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

  // Si no hay usuario pero está en login/register, mostrar la página normal
  if (!user && (pathname === "/login" || pathname === "/register")) {
    return <>{children}</>;
  }

  // Si hay usuario → mostrar el contenido protegido
  if (user) {
    return <>{children}</>;
  }

  // Fallback (seguridad extra)
  return null;
}
