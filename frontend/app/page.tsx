// app/page.tsx  (SERVER COMPONENT)
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import LandingPage from "./landing/LandingPage"; // 👈 nuevo componente

export const metadata: Metadata = {
  metadataBase: new URL("https://vaiprop.com"),
  title: "VAI Prop | Software para valuación inmobiliaria, factibilidad y tracker",
  description:
    "VAI Prop es un software para inmobiliarias y desarrollistas: valuación y tasación por método comparativo, informes listos para enviar, factibilidad constructiva y tracker de actividades con métricas del equipo.",
  alternates: {
    canonical: "https://vaiprop.com/",
  },
  keywords: [
    "software inmobiliario",
    "valuación de propiedades",
    "tasación inmobiliaria",
    "método comparativo",
    "informe de tasación",
    "factibilidad constructiva",
    "prefactibilidad",
    "métricas inmobiliarias",
    "tracker de actividades",
    "business analytics real estate",
    "inmobiliarias",
    "desarrollistas",
  ],
  openGraph: {
    title: "VAI Prop | Valuaciones, Factibilidad y Tracker para Real Estate",
    description:
      "Valuación/tasación por método comparativo + factibilidad constructiva + tracker de actividades y métricas del equipo. Informes prolijos con tu marca.",
    url: "https://vaiprop.com/",
    siteName: "VAI Prop",
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VAI Prop | Software para valuación y factibilidad",
    description:
      "Valuación/tasación + factibilidad constructiva + tracker y métricas para inmobiliarias y desarrollistas.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootPage() {
  // Leer sesión desde cookie en el servidor
  const supabase = supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Si hay sesión → mandar al dashboard
  if (session) {
    redirect("/dashboard");
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "VAI Prop",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://vaiprop.com/",
    description:
      "Software para inmobiliarias y desarrollistas: valuación/tasación por método comparativo, informes listos para enviar, factibilidad constructiva, tracker de actividades y métricas del equipo.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "ARS",
      description: "Plan Trial disponible",
      url: "https://vaiprop.com/auth/register",
    },
    publisher: {
      "@type": "Organization",
      name: "VAI Prop",
      url: "https://vaiprop.com/",
    },
  };

  // Si NO hay sesión → mostrar la landing pública
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
