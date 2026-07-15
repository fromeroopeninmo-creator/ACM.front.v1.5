"use client";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "#lib/supabaseClient";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import UvaCalculatorModal from "@/components/UvaCalculatorModal";
import CotizacionDolar from "@/components/CotizacionDolar";
import IndicadoresEconomicos from "@/components/IndicadoresEconomicos";


type ToolIconName =
  | "valuation"
  | "tracker"
  | "uva"
  | "agenda"
  | "feasibility"
  | "analytics"
  | "rent"
  | "market";

function ToolIcon({ name }: { name: ToolIconName }) {
  const commonProps = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-6 w-6",
    "aria-hidden": true,
  };

  switch (name) {
    case "valuation":
      return (
        <svg {...commonProps}>
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v10h14V10" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );
    case "tracker":
      return (
        <svg {...commonProps}>
          <path d="M4 19V9" />
          <path d="M10 19V5" />
          <path d="M16 19v-7" />
          <path d="M22 19V3" />
        </svg>
      );
    case "uva":
      return (
        <svg {...commonProps}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 7h8" />
          <path d="M8 11h2" />
          <path d="M14 11h2" />
          <path d="M8 15h2" />
          <path d="M14 15h2" />
        </svg>
      );
    case "agenda":
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4" />
          <path d="M8 3v4" />
          <path d="M3 10h18" />
          <path d="m9 16 2 2 4-4" />
        </svg>
      );
    case "feasibility":
      return (
        <svg {...commonProps}>
          <path d="M4 20h16" />
          <path d="M6 20V9l6-5 6 5v11" />
          <path d="M9 20v-6h6v6" />
          <path d="M4 9h16" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...commonProps}>
          <path d="M3 3v18h18" />
          <path d="m7 15 4-4 3 3 5-7" />
          <path d="M15 7h4v4" />
        </svg>
      );
    case "rent":
      return (
        <svg {...commonProps}>
          <path d="M4 10 12 4l8 6" />
          <path d="M6 9v11h12V9" />
          <path d="M9 14h6" />
          <path d="M12 11v6" />
        </svg>
      );
    case "market":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a15 15 0 0 1 0 18" />
          <path d="M12 3a15 15 0 0 0 0 18" />
        </svg>
      );
    default:
      return null;
  }
}

type ToolCardProps = {
  title: string;
  icon: ToolIconName;
  primaryColor: string;
  href?: string;
  onClick?: (
    event:
      | React.MouseEvent<HTMLAnchorElement>
      | React.MouseEvent<HTMLButtonElement>,
  ) => void;
};

function ToolCard({
  title,
  icon,
  primaryColor,
  href,
  onClick,
}: ToolCardProps) {
  const content = (
    <>
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
        style={{ backgroundColor: primaryColor }}
      >
        <ToolIcon name={icon} />
      </span>

      <span className="min-w-0 flex-1 text-center">
        <span className="block text-sm font-semibold leading-tight text-gray-900 sm:text-base">
          {title}
        </span>
      </span>

      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-gray-700"
        aria-hidden="true"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </>
  );

  const className =
    "group flex min-h-[76px] w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

  if (href) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
}

export default function AsesorDashboardPage() {
  const { user } = useAuth();
  const { primaryColor, setPrimaryColor, setLogoUrl } = useTheme();

  const [empresa, setEmpresa] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showUvaCalc, setShowUvaCalc] = useState(false);

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
      {/* Bienvenida */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
          Panel de asesor
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
          Bienvenid@, {nombreAsesor}
        </h1>
        <p className="mt-1 text-sm text-gray-600 sm:text-base">
          Desde este dashboard vas a poder utilizar las herramientas de VAI PROP,
          gestionar tus datos e informes.
        </p>
      </section>

      {/* VAI TOOLS */}
      <section className="rounded-2xl border border-gray-200 bg-gray-50/70 p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
            Ecosistema de herramientas
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
            VAI TOOLS
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ToolCard
            href="/vai/acmforms"
            title="Valuador de Activos Inmobiliarios"
            icon="valuation"
            primaryColor={primaryColor}
          />

          <ToolCard
            href="/dashboard/asesor/tracker"
            title="Business Tracker"
            icon="tracker"
            primaryColor={primaryColor}
          />

          <ToolCard
            title="Calculadora Créditos UVA"
            icon="uva"
            primaryColor={primaryColor}
            onClick={() => setShowUvaCalc(true)}
          />

          <ToolCard
            href="/dashboard/asesor/agenda"
            title="Agenda"
            icon="agenda"
            primaryColor={primaryColor}
          />

          <ToolCard
            href="/dashboard/empresa/factibilidad"
            title="Factibilidad Constructiva"
            icon="feasibility"
            primaryColor={primaryColor}
          />

          <ToolCard
            href="/dashboard/asesor/tracker-analytics"
            title="Business Analytics"
            icon="analytics"
            primaryColor={primaryColor}
          />

          <ToolCard
            href="/dashboard/asesor/calculadora-alquileres"
            title="Calculadora de Alquileres"
            icon="rent"
            primaryColor={primaryColor}
          />

          <ToolCard
            href="/dashboard/asesor/mercado"
            title="VAI Market Data"
            icon="market"
            primaryColor={primaryColor}
          />
        </div>
      </section>

      {/* Cotización diaria del dólar + indicadores económicos */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(360px,0.78fr)_minmax(0,1.22fr)] xl:items-stretch">
        <div className="cotizacion-dolar-asesor h-full">
          <CotizacionDolar />
        </div>

        <div className="indicadores-economicos-asesor h-full">
          <IndicadoresEconomicos />
        </div>
      </div>

      <style jsx global>{`
        @media (min-width: 1280px) {
          .cotizacion-dolar-asesor > section,
          .indicadores-economicos-asesor > section {
            height: 100%;
          }

          .cotizacion-dolar-asesor section > div.grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .indicadores-economicos-asesor > section,
          .indicadores-economicos-asesor > div {
            width: 100%;
          }
        }
      `}</style>

      {/* Datos del Asesor */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
            Información personal
          </p>
          <h2 className="mt-1 text-xl font-semibold text-gray-900">
            Datos del Asesor
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_220px]">
          <div className="border-b border-gray-100 p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-gray-500">Nombre</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {nombreAsesor}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-gray-500">Teléfono</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {telefonoAsesor}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-gray-500">Email</dt>
                <dd className="mt-0.5 break-all font-medium text-gray-900">
                  {emailAsesor}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-gray-500">Empresa</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {nombreEmpresa}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-gray-500">Profesional</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {matriculado}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-gray-500">Matrícula N.º</dt>
                <dd className="mt-0.5 font-medium text-gray-900">{cpi}</dd>
              </div>
            </dl>
          </div>

          <div className="flex items-center justify-center p-5 sm:p-6">
            <div className="w-full text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Identidad de la empresa
              </p>
              <img
                src={logoBusted}
                alt="Logo de la empresa"
                className="mx-auto h-40 w-40 rounded-2xl border border-gray-200 bg-white object-contain p-3 shadow-sm"
              />
            </div>
          </div>
        </div>
      </section>

      <UvaCalculatorModal
        open={showUvaCalc}
        onClose={() => setShowUvaCalc(false)}
      />
    </div>
  );
}
