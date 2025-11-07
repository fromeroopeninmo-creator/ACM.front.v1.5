// app/layout.tsx
import "./globals.css";
import { Inter } from "next/font/google";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ReactNode } from "react";
import AppWrapper from "./AppWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "VAI PROP - Soluciones Digitales para el Real Estate",
  description: "Soluciones Digitales para el Real Estate",
};

interface LayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {/* 🎨 ThemeProvider primero, para cargar color antes del render */}
        <ThemeProvider>
          {/* 🔐 AuthProvider adentro, para manejar sesión sin retrasar color */}
          <AuthProvider>
            {/* 🧱 Wrapper de la app (componentes globales, modales, etc.) */}
            <AppWrapper>{children}</AppWrapper>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
