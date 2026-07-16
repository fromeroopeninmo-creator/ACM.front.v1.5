import ACMForm from "@/components/ACMForm";

export default function EmpresaValuadorPage() {
  return (
    <main className="w-full min-w-0 space-y-4 px-3 py-4 sm:px-4 md:px-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Valuador inmobiliario
        </h1>
        <p className="text-sm text-slate-500">
          Prepará, guardá y descargá informes de valuación desde el panel de tu empresa.
        </p>
      </header>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        <ACMForm />
      </section>
    </main>
  );
}
