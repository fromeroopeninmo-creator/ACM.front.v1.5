"use client";
export const dynamic = "force-dynamic";

import ACMForm from "@/components/ACMForm";

export default function ProtectedPage() {
  return (
    <div
      className="
        max-w-7xl mx-auto
        px-3 sm:px-6 lg:px-8
        py-4 sm:py-6 lg:py-10
        w-full
        min-h-screen
        flex flex-col
      "
    >
      {/* 🔹 Título principal */}
      <h1
        className="
          text-xl sm:text-2xl md:text-3xl
          font-bold
          mb-6 sm:mb-8
          text-center
          text-primary
          leading-tight
        "
      >
        VMI - Valoración de Mercado Inmobiliario
      </h1>

      {/* 🔹 Contenedor del formulario */}
      <div
        className="
          bg-white shadow-lg rounded-xl
          p-4 sm:p-6 md:p-8
          w-full
          flex-1
          overflow-auto
          transition-all duration-300
        "
      >
        <ACMForm />
      </div>
    </div>
  );
}
