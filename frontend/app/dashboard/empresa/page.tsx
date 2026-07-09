// frontend/app/dashboard/empresa/page.tsx
"use client";

import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import Link from "next/link";
import PlanStatusBanner from "./components/PlanStatusBanner";
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

  return (
    <div className="space-y-6">
      {/* 🧭 Banner del plan */}
      <PlanStatusBanner />

      {/* 🏢 Bienvenida + acciones de gestión */}
      <section className="bg-white shadow-sm rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">Bienvenid@, {nombre}</h1>
            <p className="text-gray-600 mb-1">
              Desde este Dashboard podés gestionar toda tu empresa.
            </p>
          </div>

          {/* Acciones de gestión (alineadas a la derecha, mismo ancho) */}
          <div className="flex flex-col gap-3 md:items-end">
            {cicloReminder ? (
              <div className="inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 shadow-sm md:self-end">
                ⏰ {cicloReminder}
              </div>
            ) : null}

            <Link
              href="/dashboard/empresa/planes"
              className="px-5 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 transition w-full md:w-[230px]"
            >
              💼 Ver Planes
            </Link>

            <Link
              href="/dashboard/empresa/asesores"
              className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition w-full md:w-[230px]"
            >
              👥 Gestionar Asesores
            </Link>
          </div>
        </div>
      </section>

      {/* 🔧 VAI TOOLS */}
      <section className="bg-white shadow-sm rounded-xl p-6">
        <h2 className="text-2xl font-bold tracking-tight mb-1">VAI TOOLS</h2>
        <p className="text-gray-600 mb-4 text-sm md:text-base">
          Accedé a las herramientas digitales de VAI para valuar propiedades,
          analizar proyectos y gestionar el desempeño comercial de tu equipo en
          un solo lugar.
        </p>

        {/* Bloque de herramientas: 6 botones en 2 filas (3 arriba, 3 abajo en desktop) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl">
          {/* 🏠 Valuador de Activos Inmobiliarios */}
          <Link
            href="/vai/acmforms"
            className="w-full min-h-[72px] px-5 py-3 text-sm sm:text-base text-white font-semibold rounded-xl shadow-md border border-black/10 text-center inline-flex items-center justify-center gap-2 hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 transition"
            style={{
              backgroundColor: primaryColor,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.filter =
                "brightness(1.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.filter =
                "brightness(1)";
            }}
          >
            <span>🏠</span>
            <span>Valuador de Activos Inmobiliarios</span>
          </Link>

          {/* 📊 Business Tracker */}
          <Link
            href="/dashboard/empresa/tracker"
            className="w-full min-h-[72px] px-5 py-3 text-sm sm:text-base text-white font-semibold rounded-xl shadow-md border border-black/10 text-center inline-flex items-center justify-center gap-2 hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 transition"
            style={{
              backgroundColor: primaryColor,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
            onClick={handleTrackerClick}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.filter =
                "brightness(1.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.filter =
                "brightness(1)";
            }}
          >
            <span>📊</span>
            <span>Business Tracker</span>
          </Link>

          {/* 🧮 Calculadora Créditos UVA */}
          <button
            type="button"
            onClick={() => setShowUvaCalc(true)}
            className="w-full min-h-[72px] px-5 py-3 text-sm sm:text-base text-white font-semibold rounded-xl shadow-md border border-black/10 text-center inline-flex items-center justify-center gap-2 hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 transition"
            style={{
              backgroundColor: primaryColor,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.filter =
                "brightness(1.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.filter =
                "brightness(1)";
            }}
          >
            <span>🧮</span>
            <span>Calculadora Créditos UVA</span>
          </button>

          {/* 📐 Factibilidad Constructiva */}
          <Link
            href="/dashboard/empresa/factibilidad"
            className="w-full min-h-[72px] px-5 py-3 text-sm sm:text-base text-white font-semibold rounded-xl shadow-md border border-black/10 text-center inline-flex items-center justify-center gap-2 hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 transition"
            style={{
              backgroundColor: primaryColor,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.filter =
                "brightness(1.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.filter =
                "brightness(1)";
            }}
          >
            <span>📐</span>
            <span>Factibilidad Constructiva</span>
          </Link>

         
          {/* 📈 Business Analytics */}
          <Link
            href="/dashboard/empresa/tracker-analytics"
            className="w-full min-h-[72px] px-5 py-3 text-sm sm:text-base text-white font-semibold rounded-xl shadow-md border border-black/10 text-center inline-flex items-center justify-center gap-2 hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 transition"
            style={{
              backgroundColor: primaryColor,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
            onClick={handleTrackerClick}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.filter =
                "brightness(1.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.filter =
                "brightness(1)";
            }}
          >
            <span>📈</span>
            <span>Business Analytics</span>
          </Link>
          
           {/* 📅 Agenda */}
          <Link
            href="/dashboard/empresa/agenda"
            className="w-full min-h-[72px] px-5 py-3 text-sm sm:text-base text-white font-semibold rounded-xl shadow-md border border-black/10 text-center inline-flex items-center justify-center gap-2 hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 transition"
            style={{
              backgroundColor: primaryColor,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
            onClick={handleTrackerClick}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.filter =
                "brightness(1.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.filter =
                "brightness(1)";
            }}
          >
            <span>📅</span>
            <span>Agenda</span>
          </Link>

          {/* 🌐 VAI Market Data */}
          <Link
            href="/dashboard/empresa/mercado"
            className="w-full min-h-[72px] px-5 py-3 text-sm sm:text-base text-white font-semibold rounded-xl shadow-md border border-black/10 text-center inline-flex items-center justify-center gap-2 hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 transition"
            style={{
              backgroundColor: primaryColor,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.filter =
                "brightness(1.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.filter =
                "brightness(1)";
            }}
          >
            <span>🌐</span>
            <span>VAI Market Data</span>
          </Link>
        </div>
      </section>

      {/* 💵 Cotización diaria del dólar + indicadores económicos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start max-w-5xl">
        <div className="cotizacion-dolar-vertical">
          <CotizacionDolar />
        </div>

        <IndicadoresEconomicos />
      </div>

      <style jsx global>{`
        @media (min-width: 1024px) {
          .cotizacion-dolar-vertical section > div.grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>

      {/* 🧾 Info básica con logo */}
      <section className="bg-white shadow-sm rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        {/* 📋 Datos */}
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-4">Datos de la Empresa</h2>
          <ul className="space-y-2 text-gray-700">
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
              <strong>Profesional:</strong> {matriculado}
            </li>
            <li>
              <strong>Matricula N°:</strong> {cpi}
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

      {/* 🧮 Modal Calculadora UVA */}
      <UvaCalculatorModal
        open={showUvaCalc}
        onClose={() => setShowUvaCalc(false)}
      />
    </div>
  );
}
