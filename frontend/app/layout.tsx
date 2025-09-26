// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "@/app/context/ThemeContext";

export const metadata: Metadata = {
  title: "ACM - Análisis Comparativo de Mercado",
  description: "Aplicación para generar informes de ACM inmobiliarios",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900">
        <ThemeProvider>
          <main className="min-h-screen">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
