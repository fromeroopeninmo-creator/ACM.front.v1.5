import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Informe ACM",
  description: "Aplicación para generar Análisis Comparativo de Mercado inmobiliario",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-800 antialiased">
        <main className="min-h-screen flex flex-col">
          <header className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <h1 className="text-2xl font-bold text-indigo-600">
                Informe ACM
              </h1>
            </div>
          </header>
          <div className="flex-1 max-w-7xl mx-auto w-full p-6">{children}</div>
          <footer className="bg-gray-100 border-t mt-8">
            <div className="max-w-7xl mx-auto px-6 py-4 text-sm text-gray-500 text-center">
              © {new Date().getFullYear()} Informe ACM — Generado con Next.js & TailwindCSS
            </div>
          </footer>
        </main>
      </body>
    </html>
  );
}
