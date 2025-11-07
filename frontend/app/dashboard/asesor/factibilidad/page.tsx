"use client";

import FactibilidadForm from "@/components/FactibilidadForm";

export default function AsesorFactibilidadPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Factibilidad Constructiva
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-2xl">
          Generá informes de factibilidad para tus clientes, estimando la
          superficie construible, costos y valor sugerido del lote según las
          condiciones urbanísticas.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <FactibilidadForm />
      </div>
    </div>
  );
}
