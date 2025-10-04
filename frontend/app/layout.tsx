// app/layout.tsx
import "./globals.css";
import { Inter } from "next/font/google";
import { AuthProvider } from "./context/AuthContext";
import { ReactNode } from "react";
import AppWrapper from "./AppWrapper"; // 👈 moveremos la lógica de cliente aquí

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "VAI - Valuador de Activos Inmobiliario",
  description: "Generador de informes VAI",
};

interface LayoutProps {
  children: ReactNode;
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
