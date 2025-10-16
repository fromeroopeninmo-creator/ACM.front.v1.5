"use client";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "#lib/supabaseClient";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AsesorDashboardPage() {
  const { user } = useAuth();
  const { primaryColor } = useTheme();

  const [empresa, setEmpresa] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const safeUser = user as any; // evitar errores de tipo

  // 🧠 Cargar datos de la empresa (heredada del asesor)
  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!safeUser || !safeUser.empresa_id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("empresas")
          .select(
            "nombre_comercial, razon_social, condicion_fiscal, matriculado, cpi, telefono, logo_url, updated_at"
          )
          .eq("id", safeUser.empresa_id)
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
  }, [safeUser]);

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Cargando panel de asesor...
      </div>
    );
  }

  // 👤 Datos del asesor
  const nombreAsesor =
    `${safeUser?.nombre ?? ""} ${safeUser?.apellido ?? ""}`.trim() || "Asesor";
  const email = safeUser?.email || "—";
  const telefonoPersonal = safeUser?.telefono || "—";

  // 🏢 Datos de la empresa (con fallbacks)
  const nombreEmpresa = empresa?.nombre_comercial || "—";
  const razonSocial = empresa?.razon_social || "—";
  const condicionFiscal = empresa?.condicion_fiscal || "—";
  const matriculado = empresa?.matriculado || "—";
  const cpi = empresa?.cpi || "—";
  const telefonoEmpresa = empresa?.telefono || "—";

  // 🖼️ Logo con cache-busting basado en updated_at
  const logoUrl =
    empresa?.logo_url && empresa.logo_url.trim() !== ""
      ? `${empresa.logo_url}${
          empresa.logo_url.includes("?")
            ? ""
            : `?v=${new Date(empresa.updated_at || Date.now()).getTime()}`
        }`
      : "/images/default-logo.png";

  return (
    <div className="space-y-6">
      {/* ⚙️ Botón principal (sin logo arriba) */}
      <section className="bg-white shadow-sm rounded-xl p-6 flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold">
          Bienvenido, {nombreAsesor}
        </h1>

        <Link
          href="/vai/acmforms"
          className="px-6 py-3 text-white font-semibold rounded-lg shadow transition text-center"
          style={{
            backgroundColor: primaryColor,
            boxShadow: "0 3px 8px rgba(0,0,0,0.15)",
          }}
        >
          🧾 Valuador de Activos Inmobiliarios
        </Link>
      </section>

      {/* 🧾 Datos del Asesor + Empresa (logo abajo) */}
      <section className="bg-white shadow-sm rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        {/* 📋 Datos */}
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-4">Datos del Asesor</h2>
          <ul className="space-y-2 text-gray-700">
            {/* Empresa */}
            <li>
              <strong>Nombre:</strong> {nombreEmpresa}
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

            {/* Asesor */}
            <li className="pt-2">
              <strong>Email Personal:</strong> {email}
            </li>
            <li>
              <strong>Teléfono Personal:</strong> {telefonoPersonal}
            </li>

            {/* (Opcional) Teléfono de la empresa si querés mostrarlo */}
            <li>
              <strong>Teléfono Empresa:</strong> {telefonoEmpresa}
            </li>
          </ul>
        </div>

        {/* 🖼️ Logo (abajo a la derecha) */}
        <div className="flex-shrink-0 w-full md:w-48 text-center">
          <img
            src={logoUrl}
            alt="Logo de la empresa"
            className="w-40 h-40 object-contain mx-auto border rounded-xl shadow-sm bg-white"
          />
        </div>
      </section>
    </div>
  );
}
