import ACMForm from "@/app/components/ACMForm";

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-indigo-600 mb-4">
          Formulario de Análisis Comparativo de Mercado
        </h2>
        <ACMForm />
      </div>
    </div>
  );
}
