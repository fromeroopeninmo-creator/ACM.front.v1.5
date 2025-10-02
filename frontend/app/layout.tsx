// app/layout.tsx
import "./globals.css";
import { Inter } from "next/font/google";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext"; // 👈 importamos ThemeProvider

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "VMI - Valoración de Mercado Inmobiliario",
  description: "Generador de informes VMI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
