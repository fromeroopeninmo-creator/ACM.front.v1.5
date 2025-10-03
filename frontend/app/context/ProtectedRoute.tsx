"use client";
import { useAuth } from "./AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== "/login" && pathname !== "/register") {
      router.replace("/login");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        fontSize: 18,
        fontWeight: "bold"
      }}>
        Cargando sesión...
      </div>
    );
  }

  if (!user && (pathname === "/login" || pathname === "/register")) {
    return <>{children}</>;
  }

  if (user) {
    return <>{children}</>;
  }

  return null;
}
