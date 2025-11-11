// app/layout.tsx
import "./globals.css";
import { Inter } from "next/font/google";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ReactNode } from "react";
import AppWrapper from "./AppWrapper";
import SiteFooter from "./components/SiteFooter";

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
        <ThemeProvider>
          <AuthProvider>
            <AppWrapper>{children}</AppWrapper>
            {/* 🔻 Footer global visible en TODA la app */}
            <SiteFooter />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
