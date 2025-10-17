"use client";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type EmpresaMin = {
  id: string;
  nombre_comercial: string | null;
  matriculado: string | null;
  cpi: string | null;
  telefono: string | null;
  logo_url: string | null;
  color: string | null;
  updated_at: string | null;
};

export default function AsesorDashboardPage() {
  const { user } = useAuth();
  const { primaryColor, setPrimaryColor, setLogoUrl } = useTheme();

  const [empresa, setEmpresa] = useState<EmpresaMin | null>(null);
  const [loading, setLoading] = useState(true);

  const safeUser = user as any; // evita errores de tipo

  // 👤 Derivados del asesor
  const nombreAsesor = useMemo(
    () =>
      `${safeUser?.nombre ?? ""} ${safeUser?.apellido ?? ""}`.trim() ||
      "Asesor",
    [safeUser]
  );
  const emailAsesor = safeUser?.email || "—";
  const telefonoAsesor = safeUser?.telefono || "—";

  // 🧠 Cargar datos de la empresa (heredada del asesor) via API (Service Role)
  useEffect(() => {
    const fetchEmpresa = async () => {
      try {
        if (!safeUser?.empresa_id) {
          setEmpresa(null);
          return;
        }

        const res = await fetch("/api/asesor/empresa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empresa_id: safeUser.empresa_id }),
        });

        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Error consultando empresa");

        const data = j.data as EmpresaMin;
        setEmpresa(data);

        // 🎨 Color corporativo heredado
        if (data?.color) {
          setPrimaryColor(data.color);
          localStorage.setItem("vai_primaryColor", data.color);
        }

        // 🖼️ Logo con cache-busting
        if (data?.logo_url && data.logo_url.trim() !== "") {
          const busted = `${data.logo_url}${
            data.logo_url.includes("?")
              ? ""
              : `?v=${new Date(data.updated_at || Date.now()).getTime()}`
          }`;
          setLogoUrl(busted);
          localStorage.setItem("vai_logoUrl", busted);
        }

        // 📢 Notificar a otros componentes (ej: Header) para Matriculado/CPI
        window.dispatchEvent(
          new CustomEvent("empresaDataUpdated", {
            detail: {
              nombre_comercial: data?.nombre_comercial ?? "—",
              matriculado: data?.matriculado ?? "—",
              cpi: data?.cpi ?? "—",
            },
          })
        );
      } catch (e) {
        console.error(e);
        setEmpresa(null);
      } finally {
        setLoading(false);
      }
    };

    fetchEmpresa();
  }, [safeUser, setPrimaryColor, setLogoUrl]);

  // (Opcional) Suscripción realtime si querés reflejar cambios en caliente:
  // La podríamos agregar luego usando otro endpoint o un canal público.

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Cargando panel de asesor...
      </div>
    );
  }

  // 🏢 Datos heredados (con fallbacks)
  const empresaNombre = empresa?.nombre_comercial || "—";
  const matriculado = empresa?.matriculado || "—";
  const cpi = empresa?.cpi || "—";
  const telefonoEmpresa = empresa?.telefono || "—";

  // 🖼️ Logo para tarjeta inferior (cache-busting)
  const logoBusted =
    empresa?.logo_url && empresa.logo_url.trim() !== ""
      ? `${empresa.logo_url}${
          empresa.logo_url.includes("?")
            ? ""
            : `?v=${new Date(empresa.updated_at || Date.now()).getTime()}`
        }`
      : "/images/default-logo.png";

  // 📞 Teléfono preferido: del asesor; si no tiene, de la empresa
  const telefonoPreferido =
    telefonoAsesor !== "—" ? telefonoAsesor : telefonoEmpresa;

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

      {/* 🧾 Datos del Asesor (con logo y herencia de empresa) */}
      <section className="bg-white shadow-sm rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        {/* 📋 Campos en el orden solicitado */}
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-4">Datos del Asesor</h2>
          <ul className="space-y-2 text-gray-700">
            <li>
              <strong>Nombre:</strong> {nombreAsesor}
            </li>
            <li>
              <strong>Teléfono:</strong> {telefonoPreferido}
            </li>
            <li>
              <strong>Email:</strong> {emailAsesor}
            </li>
            <li>
              <strong>Empresa:</strong> {empresaNombre}
            </li>
            <li>
              <strong>Matriculado:</strong> {matriculado}
            </li>
            <li>
              <strong>CPI:</strong> {cpi}
            </li>
          </ul>
        </div>

        {/* 🖼️ Logo (abajo a la derecha) */}
        <div className="flex-shrink-0 w-full md:w-48 text-center">
          <img
            src={logoBusted}
            alt="Logo de la empresa"
            className="w-40 h-40 object-contain mx-auto border rounded-xl shadow-sm bg-white"
          />
        </div>
      </section>
    </div>
  );
}
