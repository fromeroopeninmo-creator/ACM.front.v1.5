"use client";

import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/context/ProtectedRoute";
import ACMForm from "@/components/ACMForm";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      // 👈 si no hay sesión, redirigimos a /auth/login
      router.replace("/auth/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "40px" }}>
        <p>Cargando sesión...</p>
      </div>
    );
  }

  if (!user) {
    return null; // se redirige en useEffect
  }

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6 text-center text-primary">
          VMI - Valoración de Mercado Inmobiliario
        </h1>
        <div className="bg-white shadow-lg rounded-lg p-6">
          <ACMForm />
        </div>
      </div>
    </ProtectedRoute>
  );
}
