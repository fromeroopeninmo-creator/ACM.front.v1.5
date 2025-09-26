"use client";

import ACMForm from "@/app/components/ACMForm";

export default function HomePage() {
  return (
    <main className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-blue-600">
        Informe ACM
      </h1>
      <div className="bg-white shadow-lg rounded-lg p-6">
        <ACMForm />
      </div>
    </main>
  );
}
