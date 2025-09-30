import "./globals.css";
import { Inter } from "next/font/google";
import { AuthProvider } from "./context/AuthContext";
import Header from "./components/Header"; // 👈 agregamos el import

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "ACM - Análisis Comparativo de Mercado",
  description: "Generador de informes ACM",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <AuthProvider>
          <Header /> {/* 👈 agregado aquí */}
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
