"use client";
export const dynamic = "force-dynamic";

import ACMForm from "@/components/ACMForm";

export default function ProtectedPage() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-center text-primary">
        VMI - Valoración de Mercado Inmobiliario
      </h1>
      <div className="bg-white shadow-lg rounded-lg p-6">
        <ACMForm />
      </div>
    </div>
  );
}
