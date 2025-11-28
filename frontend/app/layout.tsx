import "./globals.css";
import { Inter } from "next/font/google";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ReactNode } from "react";
import AppWrapper from "./AppWrapper";
import SiteFooter from "./components/SiteFooter";
import Script from "next/script";
import { AnalyticsTracker } from "./AnalyticsTracker";

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
        {/* Google Analytics base */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-DBZ71JRP47"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-DBZ71JRP47', {
              page_path: window.location.pathname,
            });
          `}
        </Script>

        <ThemeProvider>
          <AuthProvider>
            <AppWrapper>
              {/* Tracker de pageviews en cada cambio de ruta */}
              <AnalyticsTracker />
              {children}
            </AppWrapper>
            {/* 🔻 Footer global visible en TODA la app */}
            <SiteFooter />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
