// app/layout.tsx
"use client";

import "./globals.css";
import { Inter } from "next/font/google";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ReactNode } from "react";
import Header from "./components/Header";
import { usePathname } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "VMI - Valoración de Mercado Inmobiliario",
  description: "Generador de informes VMI",
};

interface LayoutProps {
  children: ReactNode;
}

function AppWrapper({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  // ❌ no renderizar header en login ni register
  const hideHeader = pathname === "/login" || pathname === "/register";

  return (
    <>
      {!hideHeader && user && <Header />}
      {children}
    </>
  );
}

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <AuthProvider>
          <AppWrapper>{children}</AppWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
