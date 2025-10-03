"use client";

import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/context/ProtectedRoute";
import ACMForm from "@/components/ACMForm";

export default function RootPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "40px" }}>
        <p>Cargando sesión...</p>
      </div>
    );
  }

  if (!user) {
    // 👈 El middleware debería redirigir a /auth/login,
    // pero dejamos fallback de seguridad
    return null;
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
