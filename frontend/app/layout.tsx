import "./globals.css";
import { Inter } from "next/font/google";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./context/ProtectedRoute";
import Header from "./components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "ACM - Análisis Comparativo de Mercado",
  description: "Generador de informes ACM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <AuthProvider>
          <ProtectedRoute>
            <Header />
            {children}
          </ProtectedRoute>
        </AuthProvider>
      </body>
    </html>
  );
}
