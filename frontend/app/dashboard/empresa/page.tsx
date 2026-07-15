// frontend/app/dashboard/empresa/page.tsx
"use client";

import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import Link from "next/link";
import { supabase } from "#lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import UvaCalculatorModal from "@/components/UvaCalculatorModal";
import CotizacionDolar from "@/components/CotizacionDolar";
import IndicadoresEconomicos from "@/components/IndicadoresEconomicos";


function parseBillingDate(value?: string | null): Date | null {
  if (!value) return null;

  const datePart = value.includes("T") ? value.split("T")[0] : value;
  const [year, month, day] = datePart.split("-").map(Number);

  if (!year || !month || !day) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function daysUntilDate(target: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const normalizedTarget = new Date(target);
  normalizedTarget.setHours(0, 0, 0, 0);

  return Math.ceil(
    (normalizedTarget.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}


function formatDate(value?: string | null): string {
  const parsed = parseBillingDate(value);
  if (!parsed) return "No informado";

  return parsed.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMoney(value?: number | string | null): string {
  if (value === null || value === undefined || value === "") {
    return "No informado";
  }

  const amount =
    typeof value === "number"
      ? value
      : Number(String(value).replace(",", "."));

  if (!Number.isFinite(amount)) return "No informado";

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

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
  description: string;
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
  description,
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

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight text-gray-900 sm:text-base">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-gray-500">
          {description}
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
    "group flex min-h-[92px] w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

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

export default function EmpresaDashboardPage() {
  const { user } = useAuth();
  const { setPrimaryColor, setLogoUrl, primaryColor } = useTheme();
  const router = useRouter();

  const [puedeUsarTracker, setPuedeUsarTracker] = useState<boolean | null>(
    null,
  );
  const [billingLoading, setBillingLoading] = useState<boolean>(true);
  const [showUvaCalc, setShowUvaCalc] = useState(false);
  const [billingEstado, setBillingEstado] = useState<any>(null);

  // 🔹 Función para obtener datos de empresa (incluye updated_at para bust)
  const fetchEmpresa = async (userId: string) => {
    const { data, error } = await supabase
      .from("empresas")
      .select(
        "nombre_comercial, razon_social, condicion_fiscal, matriculado, cpi, telefono, logo_url, color, updated_at",
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

  // 🛠 Asegurar que exista la fila de empresa para este usuario (fix usuarios "fantasma")
  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const res = await fetch("/api/empresa/ensure", {
          method: "POST",
        });
        if (!res.ok) return;

        const j = await res.json().catch(() => null as any);
        if (j?.ok && j.empresa) {
          // Actualizamos SWR con la empresa recién creada / encontrada
          mutate(j.empresa, false);
        }
      } catch (e) {
        console.warn("Error en /api/empresa/ensure:", e);
      }
    })();
  }, [user, mutate]);

  // 🧭 Escucha en tiempo real para actualizar sin recargar
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("empresa-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "empresas",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const newData = payload.new as Record<string, any> | null;
          if (!newData) return;

          // ✅ Cache-busting de logo con updated_at del payload
          const bustedLogo =
            newData.logo_url && newData.logo_url.trim() !== ""
              ? `${newData.logo_url}${
                  newData.logo_url.includes("?")
                    ? ""
                    : `?v=${new Date(newData.updated_at || Date.now()).getTime()}`
                }`
              : "";

          // Actualiza SWR (preview al instante)
          mutate(
            {
              ...(empresa as any),
              ...newData,
              logo_url:
                bustedLogo ||
                newData.logo_url ||
                (empresa as any)?.logo_url ||
                "",
            } as any,
            false,
          );

          // 🎨 Tema
          if (newData.color) {
            setPrimaryColor(newData.color);
            localStorage.setItem("vai_primaryColor", newData.color);
          }
          if (bustedLogo) {
            setLogoUrl(bustedLogo);
            localStorage.setItem("vai_logoUrl", bustedLogo);
          }

          // Evento global
          window.dispatchEvent(
            new CustomEvent("themeUpdated", {
              detail: { color: newData.color, logoUrl: bustedLogo },
            }),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, mutate, setPrimaryColor, setLogoUrl, empresa]);

  // 🔹 Hook auxiliar: sincronizar tema cuando cambia empresa (con bust)
  useEffect(() => {
    if (empresa) {
      if (empresa.color) {
        setPrimaryColor(empresa.color);
        localStorage.setItem("vai_primaryColor", empresa.color);
      }
      const bustedLogo =
        empresa.logo_url && empresa.logo_url.trim() !== ""
          ? `${empresa.logo_url}${
              empresa.logo_url.includes("?")
                ? ""
                : `?v=${new Date(empresa.updated_at || Date.now()).getTime()}`
            }`
          : "";

      if (bustedLogo) {
        setLogoUrl(bustedLogo);
        localStorage.setItem("vai_logoUrl", bustedLogo);
      }
    }
  }, [empresa, setPrimaryColor, setLogoUrl]);

  // 🔎 Billing: saber si el plan permite usar Tracker (Trial o planes con incluye_tracker)
  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      try {
        const res = await fetch("/api/billing/estado", { cache: "no-store" });
        if (!res.ok) {
          setPuedeUsarTracker(null);
          return;
        }

        const data: any = await res.json().catch(() => null);
        setBillingEstado(data);
        const plan = data?.plan || null;

        const nombrePlan: string | null = plan?.nombre ?? null;
        const esTrialFlag: boolean = plan?.es_trial === true;
        const esTrialNombre = nombrePlan === "Trial";
        const incluyeTracker: boolean = plan?.incluye_tracker === true;

        if (esTrialFlag || esTrialNombre || incluyeTracker) {
          setPuedeUsarTracker(true);
        } else {
          setPuedeUsarTracker(false);
        }
      } catch (e) {
        console.error("Error obteniendo /api/billing/estado en dashboard:", e);
        setPuedeUsarTracker(null);
      } finally {
        setBillingLoading(false);
      }
    })();
  }, [user]);


  const cicloReminder = useMemo(() => {
    const estado = billingEstado?.estado ?? null;

    if (!billingEstado || !estado) return null;

    const estaSuspendida = estado?.suspendida === true;
    const planVencido = estado?.plan_vencido === true || estado?.planVencido === true;
    const enGracia = estado?.en_periodo_gracia === true || estado?.enPeriodoGracia === true;

    if (estaSuspendida || planVencido || enGracia) return null;

    const fechaCicloIso =
      billingEstado?.ciclo?.proximoCobro ?? billingEstado?.ciclo?.fin ?? null;

    const fechaCiclo = parseBillingDate(fechaCicloIso);
    if (!fechaCiclo) return null;

    const dias = daysUntilDate(fechaCiclo);

    if (dias === 2) {
      return "Tu plan vence en 2 días";
    }

    if (dias === 1) {
      return "Tu plan vence en 1 día";
    }

    return null;
  }, [billingEstado]);

  if (isLoading)
    return (
      <div className="p-6 text-center text-gray-500">
        Cargando datos de la empresa...
      </div>
    );

  // 🔒 Fallbacks de datos
  const meta = (user as any)?.user_metadata || user || {};
  const nombre = meta.nombre || "Usuario";
  const nombreEmpresa =
    empresa?.nombre_comercial ||
    meta.inmobiliaria ||
    meta.empresa ||
    "No especificado";
  const razonSocial =
    empresa?.razon_social || meta.razon_social || "No especificado";
  const condicionFiscal =
    empresa?.condicion_fiscal || meta.condicion_fiscal || "No especificado";
  const matriculado =
    empresa?.matriculado || meta.matriculado || "No especificado";
  const cpi = empresa?.cpi || meta.cpi || "No especificado";
  const telefono = empresa?.telefono || meta.telefono || "No especificado";
  const email = (user as any)?.email || "No especificado";

  // 🖼️ Logo con bust (si ThemeContext todavía no inyectó, usamos bust local)
  const logoUrl =
    empresa?.logo_url && empresa.logo_url.trim() !== ""
      ? `${empresa.logo_url}${
          empresa.logo_url.includes("?")
            ? ""
            : `?v=${new Date(empresa.updated_at || Date.now()).getTime()}`
        }`
      : "/images/default-logo.png";

  const handleTrackerClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (billingLoading) return; // dejamos pasar mientras se carga para no molestar

    if (puedeUsarTracker === false) {
      e.preventDefault();
      alert(
        "Para usar Business Tracker necesitás un plan Full o un plan Business Tracker. Te llevamos al portal de planes para actualizar tu suscripción.",
      );
      router.push("/dashboard/empresa/planes");
    }
  };


  const acuerdoComercialVigente =
    billingEstado?.acuerdoComercial?.activo === true;

  const nombrePlanActual =
    billingEstado?.plan?.nombre || "No informado";

  const cicloInicio =
    billingEstado?.ciclo?.inicio ?? null;

  const cicloFin =
    billingEstado?.ciclo?.fin ??
    billingEstado?.ciclo?.proximoCobro ??
    null;

  const acuerdoFechaFin =
    billingEstado?.acuerdoComercial?.fecha_fin ?? null;

  const importeTotal =
    billingEstado?.pricing?.precio_total_final ??
    billingEstado?.acuerdoComercial?.precio_total_final ??
    billingEstado?.plan?.totalConIVA ??
    billingEstado?.pricing?.precio_neto_final ??
    billingEstado?.acuerdoComercial?.precio_neto_final ??
    billingEstado?.plan?.precioNeto ??
    null;

  return (
    <div className="space-y-6">
      {/* 🏢 Bienvenida */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
              Panel de empresa
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
              Bienvenid@, {nombre}
            </h1>
            <p className="mt-1 text-sm text-gray-600 sm:text-base">
              Desde este Dashboard podés gestionar toda tu empresa.
            </p>
          </div>

          {cicloReminder ? (
            <div className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 shadow-sm">
              <span className="mr-1.5">⏰</span>
              {cicloReminder}
            </div>
          ) : null}
        </div>
      </section>

      {/* 🔧 VAI TOOLS */}
      <section className="rounded-2xl border border-gray-200 bg-gray-50/70 p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
            Ecosistema de herramientas
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
            VAI TOOLS
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600 sm:text-base">
            Accedé a las herramientas digitales de VAIPROP para valuar propiedades,
            analizar proyectos y gestionar el desempeño comercial de tu equipo
            desde un solo lugar.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ToolCard
            href="/vai/acmforms"
            title="Valuador de Activos"
            description="Valuaciones inmobiliarias e informes profesionales."
            icon="valuation"
            primaryColor={primaryColor}
          />

          <ToolCard
            href="/dashboard/empresa/tracker"
            title="Business Tracker"
            description="Gestión comercial de contactos, captaciones y cierres."
            icon="tracker"
            primaryColor={primaryColor}
            onClick={handleTrackerClick}
          />

          <ToolCard
            title="Calculadora Créditos UVA"
            description="Simulación y análisis de créditos hipotecarios UVA."
            icon="uva"
            primaryColor={primaryColor}
            onClick={() => setShowUvaCalc(true)}
          />

          <ToolCard
            href="/dashboard/empresa/agenda"
            title="Agenda"
            description="Organización de actividades y seguimiento del equipo."
            icon="agenda"
            primaryColor={primaryColor}
            onClick={handleTrackerClick}
          />

          <ToolCard
            href="/dashboard/empresa/factibilidad"
            title="Factibilidad Constructiva"
            description="Análisis preliminar del potencial constructivo."
            icon="feasibility"
            primaryColor={primaryColor}
          />

          <ToolCard
            href="/dashboard/empresa/tracker-analytics"
            title="Business Analytics"
            description="Indicadores, rendimiento y evolución comercial."
            icon="analytics"
            primaryColor={primaryColor}
            onClick={handleTrackerClick}
          />

          <ToolCard
            href="/dashboard/empresa/calculadora-alquileres"
            title="Calculadora de Alquileres"
            description="Proyecciones, actualizaciones y rentabilidad."
            icon="rent"
            primaryColor={primaryColor}
          />

          <ToolCard
            href="/dashboard/empresa/mercado"
            title="VAI Market Data"
            description="Datos agregados del mercado inmobiliario."
            icon="market"
            primaryColor={primaryColor}
          />
        </div>
      </section>

      {/* 💵 Cotización diaria del dólar + indicadores económicos */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
        <div className="cotizacion-dolar-alineada h-full">
          <CotizacionDolar />
        </div>

        <div className="indicadores-economicos-alineados h-full">
          <IndicadoresEconomicos />
        </div>
      </div>

      <style jsx global>{`
        @media (min-width: 1280px) {
          .cotizacion-dolar-alineada > section,
          .indicadores-economicos-alineados > section {
            height: 100%;
          }

          .cotizacion-dolar-alineada section > div.grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .indicadores-economicos-alineados section > div.grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>

      {/* 🧾 Datos de empresa, plan y logo */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
            Información de la cuenta
          </p>
          <h2 className="mt-1 text-xl font-semibold text-gray-900">
            Empresa y suscripción
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_1fr_220px]">
          {/* Datos de la empresa */}
          <div className="border-b border-gray-100 p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Datos de la Empresa
            </h3>

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Nombre comercial</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {nombreEmpresa}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Razón social</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {razonSocial}
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
              <div>
                <dt className="text-xs text-gray-500">Email</dt>
                <dd className="mt-0.5 break-all font-medium text-gray-900">
                  {email}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Teléfono</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {telefono}
                </dd>
              </div>
            </dl>
          </div>

          {/* Datos del plan */}
          <div className="border-b border-gray-100 p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Datos del Plan
              </h3>

              <span
                className={[
                  "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                  acuerdoComercialVigente
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                    : "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
                ].join(" ")}
              >
                {acuerdoComercialVigente
                  ? "Acuerdo comercial vigente"
                  : "Plan estándar"}
              </span>
            </div>

            <dl className="space-y-3 text-sm">
              {acuerdoComercialVigente ? (
                <div>
                  <dt className="text-xs text-gray-500">
                    Vigencia del acuerdo comercial
                  </dt>
                  <dd className="mt-0.5 font-medium text-gray-900">
                    Hasta {formatDate(acuerdoFechaFin)}
                  </dd>
                </div>
              ) : null}

              <div>
                <dt className="text-xs text-gray-500">Plan actual</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {nombrePlanActual}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-gray-500">Ciclo actual</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {formatDate(cicloInicio)} — {formatDate(cicloFin)}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-gray-500">Importe total</dt>
                <dd className="mt-0.5 text-base font-semibold text-gray-900">
                  {formatMoney(importeTotal)}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-gray-500">Condición fiscal</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {condicionFiscal}
                </dd>
              </div>
            </dl>

            <Link
              href="/dashboard/empresa/planes"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-900 bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 sm:w-auto"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 10h18" />
              </svg>
              Ver planes
            </Link>
          </div>

          {/* Logo */}
          <div className="flex items-center justify-center p-5 sm:p-6">
            <div className="w-full text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Identidad de la empresa
              </p>
              <img
                src={logoUrl}
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
