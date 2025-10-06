"use client";
export const dynamic = "force-dynamic";

import ACMForm from "@/components/ACMForm";

export default function ProtectedPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-primary leading-tight">
        VMI - Valoración de Mercado Inmobiliario
      </h1>

      <div className="bg-white shadow-lg rounded-lg p-4 sm:p-6 md:p-8">
        <ACMForm />
      </div>
    </div>
  );
}
