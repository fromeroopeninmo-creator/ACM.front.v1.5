"use client";

import FactibilidadForm from "@/components/FactibilidadForm";

export default function EmpresaFactibilidadPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Factibilidad Constructiva
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-2xl">
          Calculá la factibilidad de un proyecto en función del lote, indicadores
          urbanísticos, superficie construible y costos estimados para obtener
          la incidencia del terreno y el costo aproximado del proyecto.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <FactibilidadForm />
      </div>
    </div>
  );
}
