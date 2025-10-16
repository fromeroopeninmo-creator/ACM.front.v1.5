"use client";

import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import Link from "next/link";
import PlanStatusBanner from "./components/PlanStatusBanner";
import { supabase } from "#lib/supabaseClient";
import { useEffect } from "react";

export default function EmpresaDashboardPage() {
  const { user } = useAuth();
  const { setPrimaryColor, setLogoUrl, primaryColor } = useTheme();

  // 🔹 Función para obtener datos de empresa
  const fetchEmpresa = async (userId: string) => {
    const { data, error } = await supabase
      .from("empresas")
      .select(
        "nombre_comercial, razon_social, condicion_fiscal, matriculado, cpi, telefono, logo_url, color"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  };

  // 🔹 SWR: carga reactiva con cache y revalidación automática
  const {
    data: empresa,
    isLoading,
    mutate,
  } = useSWR(user ? ["empresa", user.id] : null, () => fetchEmpresa(user!.id));

  // 🧭 Escucha en tiempo real para actualizar sin recargar
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("empresa-updates")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "empresas" },
        (payload: any) => {
          const newData = payload.new as Record<string, any> | null;
          if (newData && newData.user_id === user.id) {
            mutate(newData as any, false); // ✅ Actualiza datos en SWR
            // 🔄 Sincroniza color y logo globales
            if (newData.color) setPrimaryColor(newData.color);
            if (newData.logo_url) {
              setLogoUrl(newData.logo_url);
              localStorage.setItem("vai_logoUrl", newData.logo_url);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, mutate, setPrimaryColor, setLogoUrl]);

  if (isLoading)
    return (
      <div className="p-6 text-center text-gray-500">
        Cargando datos de la empresa...
      </div>
    );

  // 🔒 Fallbacks de datos
  const meta = (user as any)?.user_metadata || user || {};
  const nombre = meta.nombre || "Usuario";
  const inmobiliaria =
    empresa?.nombre_comercial || meta.inmobiliaria || "No especificado";
  const razonSocial =
    empresa?.razon_social || meta.razon_social || "No especificado";
  const condicionFiscal =
    empresa?.condicion_fiscal || meta.condicion_fiscal || "No especificado";
  const matriculado =
    empresa?.matriculado || meta.matriculado || "No especificado";
  const cpi = empresa?.cpi || meta.cpi || "No especificado";
  const telefono = empresa?.telefono || meta.telefono || "No especificado";
  const email = (user as any)?.email || "No especificado";
  const logoUrl =
    empresa?.logo_url && empresa.logo_url.trim() !== ""
      ? empresa.logo_url
      : "/images/default-logo.png";

  return (
    <div className="space-y-6">
      {/* 🧭 Banner del plan */}
      <PlanStatusBanner />

      {/* 🏢 Bienvenida */}
      <section className="bg-white shadow-sm rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-2">Bienvenido, {nombre}</h1>
        <p className="text-gray-600 mb-4">
          Panel principal de tu inmobiliaria. Desde aquí podés gestionar tu
          equipo, tus planes y toda la configuración de tu empresa.
        </p>

        {/* 🔹 Botones principales */}
        <div className="flex justify-between flex-wrap gap-3">
          {/* 🟦 Valuador (color corporativo) */}
          <Link
            href="/vai/acmforms"
            className="px-5 py-2 text-white font-semibold rounded-lg shadow transition"
            style={{
              backgroundColor: primaryColor,
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.filter =
                "brightness(1.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.filter =
                "brightness(1)";
            }}
          >
            🏠 Valuador de Activos Inmobiliarios
          </Link>

          {/* 🟩 Acciones */}
          <div className="flex gap-3">
            <Link
              href="/dashboard/empresa/asesores"
              className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition"
            >
              👥 Gestionar Asesores
            </Link>

            <Link
              href="/dashboard/empresa/planes"
              className="px-5 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 transition"
            >
              💼 Ver Planes
            </Link>
          </div>
        </div>
      </section>

      {/* 🧾 Info básica con logo */}
      <section className="bg-white shadow-sm rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        {/* 📋 Datos */}
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-4">Datos de la Empresa</h2>
          <ul className="space-y-2 text-gray-700">
            <li>
              <strong>Inmobiliaria:</strong> {inmobiliaria}
            </li>
            <li>
              <strong>Razón Social:</strong> {razonSocial}
            </li>
            <li>
              <strong>Condición Fiscal:</strong> {condicionFiscal}
            </li>
            <li>
              <strong>Matriculado:</strong> {matriculado}
            </li>
            <li>
              <strong>CPI:</strong> {cpi}
            </li>
            <li>
              <strong>Email:</strong> {email}
            </li>
            <li>
              <strong>Teléfono:</strong> {telefono}
            </li>
          </ul>
        </div>

        {/* 🖼️ Logo */}
        <div className="flex-shrink-0 w-full md:w-48 text-center">
          <img
            src={logoUrl}
            alt="Logo de la empresa"
            className="w-40 h-40 object-contain mx-auto border rounded-xl shadow-sm"
          />
        </div>
      </section>
    </div>
  );
}
