"use client";

import { useAuth } from "../context/AuthContext";
import ACMForm from "../components/ACMForm";

export default function ProtectedHomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "40px" }}>
        <p>Cargando sesión...</p>
      </div>
    );
  }

  if (!user) {
    // 👈 El ProtectedRoute y el middleware ya deberían redirigir,
    // pero ponemos fallback por seguridad
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-center text-primary">
        VMI - Valoración de Mercado Inmobiliario
      </h1>
      <div className="bg-white shadow-lg rounded-lg p-6">
        <ACMForm />
      </div>
    </div>
  );
}
