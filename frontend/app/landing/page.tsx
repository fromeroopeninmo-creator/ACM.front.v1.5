// app/landing/page.tsx
import type { Metadata } from "next";
import LandingPage from "./LandingPage";

export const metadata: Metadata = {
  title: "Valuación de propiedades para inmobiliarias | VAI Prop",
  description:
    "VAI Prop es un software para valuación de propiedades, estudios de factibilidad, gestión y organización de asesores. Diseñado para inmobiliarias, desarrollistas y profesionales del real estate que quieren informes para sus clientes en minutos.",
};

export default function Page() {
  return <LandingPage />;
}
