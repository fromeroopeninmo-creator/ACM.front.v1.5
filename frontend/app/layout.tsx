// app/layout.tsx
import "./globals.css";
import { Inter } from "next/font/google";
import { AuthProvider } from "./context/AuthContext";
import { ReactNode } from "react";
import Header from "./components/Header"; // 👈 asegurate que la ruta sea correcta

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "VMI - Valoración de Mercado Inmobiliario",
  description: "Generador de informes VMI",
};

interface LayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <AuthProvider>
          <Header /> {/* 👈 ahora el header se muestra en todas las páginas */}
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
