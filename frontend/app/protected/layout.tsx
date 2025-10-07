"use client";

import ProtectedRoute from "@/context/ProtectedRoute";
import Header from "@/components/Header";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div
        className="
          min-h-screen
          flex flex-col
          bg-gray-50
          text-gray-900
          transition-all duration-300
        "
      >
        {/* 🔹 Header fijo arriba */}
        <Header />

        {/* 🔹 Contenido principal con padding responsive */}
        <main
          className="
            flex-1
            w-full
            max-w-7xl
            mx-auto
            px-3 sm:px-6 lg:px-8
            py-4 sm:py-6 lg:py-8
          "
        >
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
