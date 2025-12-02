// frontend/app/dashboard/empresa/page.tsx
"use client";

import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import Link from "next/link";
import PlanStatusBanner from "./components/PlanStatusBanner";
import { supabase } from "#lib/supabaseClient";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function EmpresaDashboardPage() {
  const { user } = useAuth();
  const { setPrimaryColor, setLogoUrl, primaryColor } = useTheme();
  const router = useRouter();

  const [puedeUsarTracker, setPuedeUsarTracker] = useState<boolean | null>(null);
  const [billingLoading, setBillingLoading] = useState<boolean>(true);

  // 🔹 Función para obtener datos de empresa (incluye updated_at para bust)
  const fetchEmpresa = async (userId: string) => {
    const { data, error } = await supabase
      .from("empresas")
      .select(
        "nombre_comercial, razon_social, condicion_fiscal, matriculado, cpi, telefono, logo_url, color, updated_at"
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
            false
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
            })
          );
        }
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
        "Para usar Business Tracker necesitás un plan Full o un plan Business Tracker. Te llevamos al portal de planes para actualizar tu suscripción."
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

          {/* 🟩 Acciones (Gestión de Asesores + Planes) */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/dashboard/empresa/asesores"
              className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition text-sm text-center"
            >
              👥 Gestionar Asesores
            </Link>

            <Link
              href="/dashboard/empresa/planes"
              className="px-5 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 transition text-sm text-center"
            >
              💼 Ver Planes
            </Link>
          </div>
        </div>

        {/* 🔧 Sección Herramientas */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-1">Herramientas VAI</h2>
          <p className="text-sm text-gray-600 mb-4">
            Accedé a tus soluciones digitales para valuar propiedades, analizar
            factibilidad y medir el rendimiento comercial de tu empresa y tus asesores.
          </p>

          {/* Botones de herramientas: compactos, alineados a la izquierda, listos para crecer a 6 */}
          <div className="flex flex-wrap gap-3">
            {/* Valuador */}
            <Link
              href="/vai/acmforms"
              className="inline-flex items-center justify-center px-4 py-2.5 text-white font-semibold rounded-lg shadow transition text-sm min-w-[210px]"
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

            {/* Business Tracker */}
            <Link
              href="/dashboard/empresa/tracker"
              className="inline-flex items-center justify-center px-4 py-2.5 text-white font-semibold rounded-lg shadow transition text-sm min-w-[210px]"
              style={{
                backgroundColor: primaryColor,
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              }}
              onClick={handleTrackerClick}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.filter =
                  "brightness(1.1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.filter =
                  "brightness(1)";
              }}
            >
              📊 Business Tracker
            </Link>

            {/* Factibilidad Constructiva */}
            <Link
              href="/dashboard/empresa/factibilidad"
              className="inline-flex items-center justify-center px-4 py-2.5 text-white font-semibold rounded-lg shadow transition text-sm min-w-[210px]"
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
              📐 Factibilidad Constructiva
            </Link>

            {/* Business Analytics */}
            <Link
              href="/dashboard/empresa/tracker/analytics"
              className="inline-flex items-center justify-center px-4 py-2.5 text-white font-semibold rounded-lg shadow transition text-sm min-w-[210px]"
              style={{
                backgroundColor: primaryColor,
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              }}
              onClick={handleTrackerClick}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.filter =
                  "brightness(1.1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.filter =
                  "brightness(1)";
              }}
            >
              📈 Business Analytics
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
    </div>
  );
}
