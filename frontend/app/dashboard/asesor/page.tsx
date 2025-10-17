"use client";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "#lib/supabaseClient";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function AsesorDashboardPage() {
  const { user } = useAuth();
  const { primaryColor, setPrimaryColor, setLogoUrl } = useTheme();

  const [empresa, setEmpresa] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const safeUser = user as any; // evita errores de tipo

  // 🧮 Derivados del asesor
  const nombreAsesor = useMemo(
    () =>
      `${safeUser?.nombre ?? ""} ${safeUser?.apellido ?? ""}`.trim() ||
      "Asesor",
    [safeUser]
  );
  const emailAsesor = safeUser?.email || "—";
  // ✅ Teléfono del ASESOR (sin fallback al de la empresa)
  const telefonoAsesor =
    (safeUser?.telefono ??
      safeUser?.user_metadata?.telefono ??
      "").toString().trim() || "—";

  // 🧠 Cargar datos de la empresa (heredada del asesor) + aplicar tema y logo
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
            "id, nombre_comercial, matriculado, cpi, telefono, logo_url, color, updated_at"
          )
          .eq("id", safeUser.empresa_id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setEmpresa(data);

          // 🎨 color corporativo heredado
          if (data.color) {
            setPrimaryColor(data.color);
            localStorage.setItem("vai_primaryColor", data.color);
          }

          // 🖼️ logo con cache-busting
          if (data.logo_url && data.logo_url.trim() !== "") {
            const bustedLogo = `${data.logo_url}${
              data.logo_url.includes("?")
                ? ""
                : `?v=${new Date(data.updated_at || Date.now()).getTime()}`
            }`;
            setLogoUrl(bustedLogo);
            localStorage.setItem("vai_logoUrl", bustedLogo);
          }

          // 📢 informar a otros headers/partes
          window.dispatchEvent(
            new CustomEvent("themeUpdated", {
              detail: {
                color: data.color,
                logoUrl:
                  data.logo_url &&
                  `${data.logo_url}${
                    data.logo_url.includes("?")
                      ? ""
                      : `?v=${new Date(
                          data.updated_at || Date.now()
                        ).getTime()}`
                  }`,
              },
            })
          );
        }
      } catch (err) {
        console.error("Error al obtener datos de empresa:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmpresa();
  }, [safeUser, setPrimaryColor, setLogoUrl]);

  // 🔴 Realtime: si la empresa cambia (logo/color/matriculado/cpi), reflejar al instante
  useEffect(() => {
    if (!safeUser?.empresa_id) return;

    const channel = supabase
      .channel("asesor-empresa-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "empresas",
          filter: `id=eq.${safeUser.empresa_id}`,
        },
        (payload: any) => {
          const e = payload.new as any;
          setEmpresa((prev: any) => ({ ...(prev || {}), ...e }));

          // 🎨 color
          if (e.color) {
            setPrimaryColor(e.color);
            localStorage.setItem("vai_primaryColor", e.color);
          }

          // 🖼️ logo bust
          if (e.logo_url && e.logo_url.trim() !== "") {
            const bustedLogo = `${e.logo_url}${
              e.logo_url.includes("?")
                ? ""
                : `?v=${new Date(e.updated_at || Date.now()).getTime()}`
            }`;
            setLogoUrl(bustedLogo);
            localStorage.setItem("vai_logoUrl", bustedLogo);
          }

          // 📢 notificar
          window.dispatchEvent(
            new CustomEvent("themeUpdated", {
              detail: {
                color: e.color,
                logoUrl:
                  e.logo_url &&
                  `${e.logo_url}${
                    e.logo_url.includes("?")
                      ? ""
                      : `?v=${new Date(
                          e.updated_at || Date.now()
                        ).getTime()}`
                  }`,
              },
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [safeUser?.empresa_id, setPrimaryColor, setLogoUrl]);

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Cargando panel de asesor...
      </div>
    );
  }

  // 🏢 Datos heredados (con fallbacks)
  const nombreEmpresa = empresa?.nombre_comercial || "—";
  const matriculado = empresa?.matriculado || "—";
  const cpi = empresa?.cpi || "—";
  const logoBusted =
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

      {/* 🧾 Datos del Asesor (con logo y datos de la empresa) */}
      <section className="bg-white shadow-sm rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        {/* 📋 Datos en el orden solicitado */}
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-4">Datos del Asesor</h2>
          <ul className="space-y-2 text-gray-700">
            <li>
              <strong>Nombre:</strong> {nombreAsesor}
            </li>
            <li>
              <strong>Teléfono:</strong> {telefonoAsesor}
            </li>
            <li>
              <strong>Email:</strong> {emailAsesor}
            </li>
            <li>
              <strong>Empresa:</strong> {nombreEmpresa}
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
