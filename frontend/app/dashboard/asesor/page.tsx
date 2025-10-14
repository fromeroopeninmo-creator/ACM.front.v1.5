"use client";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "#lib/supabaseClient";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AsesorDashboardPage() {
  const { user } = useAuth();
  const { primaryColor, logoUrl } = useTheme();
  const [empresa, setEmpresa] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 🧠 Cargar datos de empresa (heredada) y datos personales del asesor
  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!user || !user.empresa_id) return;

      try {
        const { data, error } = await supabase
          .from("empresas")
          .select("nombre_comercial, matriculado, cpi, logo_url")
          .eq("id", user.empresa_id)
          .maybeSingle();

        if (error) throw error;
        setEmpresa(data);
      } catch (err) {
        console.error("Error al obtener datos de empresa:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmpresa();
  }, [user]);

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Cargando panel de asesor...
      </div>
    );
  }

  const nombre = user?.nombre || user?.user_metadata?.nombre || "Asesor";
  const email = user?.email || user?.user_metadata?.email || "—";
  const telefono = user?.telefono || user?.user_metadata?.telefono || "—";

  return (
    <div className="space-y-6">
      {/* 🏠 Bienvenida */}
      <section className="bg-white shadow-sm rounded-xl p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">
          Bienvenido, {nombre}
        </h1>
        <p className="text-gray-600">
          Este es el panel principal para asesores. Desde aquí podrás gestionar tus informes y tus datos personales.
        </p>
      </section>

      {/* ⚙️ Botón principal */}
      <section className="bg-white shadow-sm rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <Link
          href="/app/acmforms"
          className="px-6 py-3 text-white font-semibold rounded-lg shadow transition text-center"
          style={{
            backgroundColor: primaryColor,
            boxShadow: "0 3px 8px rgba(0,0,0,0.15)",
          }}
        >
          🧾 Valuador de Activos Inmobiliarios
        </Link>

        {logoUrl && (
          <div className="flex justify-center md:justify-end w-full md:w-48">
            <img
              src={logoUrl}
              alt="Logo Empresa"
              className="w-40 h-40 object-contain border rounded-xl shadow-sm bg-white p-2"
            />
          </div>
        )}
      </section>

      {/* 🧾 Datos básicos */}
      <section className="bg-white shadow-sm rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Datos de la Empresa</h2>
        <ul className="space-y-2 text-gray-700">
          <li>
            <strong>Inmobiliaria:</strong> {empresa?.nombre_comercial || "—"}
          </li>
          <li>
            <strong>Matriculado:</strong> {empresa?.matriculado || "—"}
          </li>
          <li>
            <strong>CPI:</strong> {empresa?.cpi || "—"}
          </li>
          <li>
            <strong>Email Personal:</strong> {email}
          </li>
          <li>
            <strong>Teléfono Personal:</strong> {telefono}
          </li>
        </ul>
      </section>
    </div>
  );
}
