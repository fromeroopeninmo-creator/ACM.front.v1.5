export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import LandingPage from "./landing/LandingPage";

export const metadata: Metadata = {
  title: "Software para inmobiliarias: analizá, gestioná y medí",
  description: "VAI Prop ayuda a inmobiliarias y brokers a valuar propiedades, analizar factibilidad, gestionar oportunidades y medir el rendimiento comercial.",
  alternates: { canonical: "/" },
  keywords: ["software para inmobiliarias", "valuación inmobiliaria", "tasación de propiedades", "tracker inmobiliario", "analytics inmobiliario", "gestión de asesores", "factibilidad constructiva", "datos de mercado inmobiliario"],
};

export default async function RootPage() {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) redirect("/dashboard");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": "https://vaiprop.com/#organization", name: "VAI Prop", url: "https://vaiprop.com/", email: "info@vaiprop.com" },
      { "@type": "SoftwareApplication", "@id": "https://vaiprop.com/#software", name: "VAI Prop", applicationCategory: "BusinessApplication", operatingSystem: "Web", url: "https://vaiprop.com/", description: "Plataforma de inteligencia y rendimiento para inmobiliarias y brokers.", publisher: { "@id": "https://vaiprop.com/#organization" }, offers: { "@type": "AggregateOffer", priceCurrency: "ARS", lowPrice: "25000", highPrice: "75000", offerCount: "3", url: "https://vaiprop.com/planes" } },
      { "@type": "WebSite", "@id": "https://vaiprop.com/#website", url: "https://vaiprop.com/", name: "VAI Prop", publisher: { "@id": "https://vaiprop.com/#organization" }, inLanguage: "es-AR" }
    ]
  };

  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><LandingPage /></>;
}
