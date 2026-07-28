import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import type { ReactNode } from "react";
import AppWrapper from "./AppWrapper";
import SiteFooter from "./components/SiteFooter";
import Script from "next/script";
import { AnalyticsTracker } from "./AnalyticsTracker";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://vaiprop.com"),
  title: { default: "VAI Prop | Inteligencia y rendimiento para inmobiliarias", template: "%s | VAI Prop" },
  description: "Plataforma para inmobiliarias y brokers con valuación, factibilidad, tracker, agenda, analytics, gestión de equipo y datos de mercado.",
  applicationName: "VAI Prop",
  alternates: { canonical: "/" },
  openGraph: { siteName: "VAI Prop", locale: "es_AR", type: "website", url: "https://vaiprop.com", title: "VAI Prop | Inteligencia y rendimiento para inmobiliarias", description: "Analizá, gestioná y medí mejor cada oportunidad inmobiliaria." },
  twitter: { card: "summary_large_image", title: "VAI Prop", description: "Inteligencia y rendimiento para inmobiliarias." },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="es-AR"><body className={inter.className}>
    <Script src="https://www.googletagmanager.com/gtag/js?id=G-DBZ71JRP47" strategy="afterInteractive" />
    <Script id="ga4-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-DBZ71JRP47',{page_path:window.location.pathname});`}</Script>
    <ThemeProvider><AuthProvider><AppWrapper><AnalyticsTracker />{children}</AppWrapper><SiteFooter /></AuthProvider></ThemeProvider>
  </body></html>;
}
