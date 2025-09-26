import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "ACM Inmobiliario",
  description: "Aplicación para generar Análisis Comparativos de Mercado (ACM) inmobiliarios.",
  viewport: "width=device-width, initial-scale=1",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* Espacio para fuentes externas, favicons adicionales, Google Analytics, etc. */}
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased min-h-screen">
        {/* 
          FUTURO: acá podés envolver con ThemeProvider o Contexts
          Ejemplo: 
          <ThemeProvider>{children}</ThemeProvider> 
        */}
        <div className="max-w-7xl mx-auto p-6">{children}</div>
      </body>
    </html>
  );
}
