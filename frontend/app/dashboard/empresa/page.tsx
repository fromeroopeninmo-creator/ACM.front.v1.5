"use client";

import { useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useEmpresa } from "@/hooks/useEmpresa";
import { supabase } from "#lib/supabaseClient";
import PlanStatusBanner from "./components/PlanStatusBanner";
import Link from "next/link";

export default function EmpresaDashboardPage() {
  const { user } = useAuth();
  const { empresa, isLoading, mutate } = useEmpresa();
  const { setPrimaryColor, setLogoUrl, primaryColor } = useTheme();

  // 🎯 Aplicar color/logo al cargar empresa
  useEffect(() => {
    if (!empresa) return;
    if (empresa.color) {
      setPrimaryColor(empresa.color);
      localStorage.setItem("vai_primaryColor", empresa.color);
    }
    if (empresa.logo_url) {
      setLogoUrl(empresa.logo_url);
      localStorage.setItem("vai_logoUrl", empresa.logo_url);
    }
  }, [empresa, setPrimaryColor, setLogoUrl]);

  // 🔴 Realtime: escuchar updates de la empresa y actualizar el cache central del hook
  useEffect(() => {
    if (!user) return;

    // Filtro: si es empresa → user_id; si es asesor → empresa.id (cuando esté disponible)
    const filter =
      (user.role || "empresa") === "empresa" && user.id
        ? `user_id=eq.${user.id}`
        : empresa?.id
        ? `id=eq.${empresa.id}`
        : null;

    if (!filter) return;

    const channel = supabase
      .channel("empresa-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "empresas",
          filter,
        },
        (payload: any) => {
          const newData = payload.new as typeof empresa | null;
          if (!newData) return;

          // Actualizar cache central sin revalidación remota
          mutate(newData as any, false);

          // Sincronizar tema
          if (newData.color) {
            setPrimaryColor(newData.color);
            localStorage.setItem("vai_primaryColor", newData.color);
          }
          if (newData.logo_url) {
            setLogoUrl(newData.logo_url);
            localStorage.setItem("vai_logoUrl", newData.logo_url);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, empresa?.id, mutate, setPrimaryColor, setLogoUrl]);

  if (isLoading)
    return (
      <div className="p-6 text-center text-gray-500">
        Cargando datos de la empresa...
      </div>
    );

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
