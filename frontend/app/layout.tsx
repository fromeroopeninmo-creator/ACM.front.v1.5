// app/layout.tsx
import "./globals.css";
import { Inter } from "next/font/google";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ReactNode } from "react";
import AppWrapper from "./AppWrapper"; // ✅ mejor ruta absoluta (Next.js 13+)

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "VAI - Valuador de Activos Inmobiliarios",
  description: "Generador de informes VAI",
};

interface LayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {/* 🔐 Contexto de autenticación (maneja sesión y roles) */}
        <AuthProvider>
          {/* 🎨 Contexto de tema (color, logo) */}
          <ThemeProvider>
            {/* 🧱 Wrapper de la app (componentes globales, modales, etc.) */}
            <AppWrapper>{children}</AppWrapper>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
