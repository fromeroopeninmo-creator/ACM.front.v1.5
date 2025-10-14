"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import PlanStatusBanner from "./components/PlanStatusBanner";
import { supabase } from "#lib/supabaseClient";
import { useEffect, useState } from "react";

export default function EmpresaDashboardPage() {
  const { user } = useAuth();
  const [empresa, setEmpresa] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 🔹 Cargar datos actualizados de la empresa
  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("empresas")
          .select(
            "nombre_comercial, razon_social, condicion_fiscal, matriculado, cpi, telefono, logo_url"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;
        setEmpresa(data || null);
      } catch (err) {
        console.error("Error al obtener datos de empresa:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmpresa();

    // 🧭 Escucha de cambios en la tabla "empresas"
    const channel = supabase
      .channel("empresa-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "empresas" },
        (payload) => {
          if (payload.new?.user_id === user?.id) {
            setEmpresa(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 🔒 Fallbacks de metadatos (si no hay datos en la tabla)
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
      : "/images/default-logo.png"; // 🖼️ Fallback si no hay logo

  if (loading)
    return (
      <div className="p-6 text-center text-gray-500">
        Cargando datos de la empresa...
      </div>
    );

  return (
    <div className="space-y-6">
      {/* 🧭 Banner de plan */}
      <PlanStatusBanner />

      {/* 🏢 Bienvenida */}
      <section className="bg-white shadow-sm rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-2">Bienvenido, {nombre}</h1>
        <p className="text-gray-600 mb-4">
          Panel principal de tu inmobiliaria. Desde aquí podés gestionar tu
          equipo, tus planes y toda la configuración de tu empresa.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/empresa/asesores"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            👥 Gestionar Asesores
          </Link>

          <Link
            href="/dashboard/empresa/planes"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
          >
            💼 Ver Planes
          </Link>
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
