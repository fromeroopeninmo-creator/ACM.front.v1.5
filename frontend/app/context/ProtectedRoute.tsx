"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login"); // 👈 si no está logueado, lo mando al login
    }
  }, [user, loading, router]);

  if (loading) return <div>Cargando...</div>;

  return <>{user ? children : null}</>;
}
