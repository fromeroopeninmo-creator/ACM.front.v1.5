"use client";

import { useState } from "react";

export default function TestGuardarInformePage() {
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("{\n  \"nota\": \"Ejemplo de informe\"\n}");
  const [status, setStatus] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setGuardando(true);

    try {
      // Validar JSON
      let cuerpoJson: any = null;
      try {
        cuerpoJson = JSON.parse(cuerpo);
      } catch {
        setStatus("❌ El cuerpo no es JSON válido.");
        setGuardando(false);
        return;
      }

      const res = await fetch("/api/informes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim() || "Informe sin título",
          cuerpo_json: cuerpoJson,
          fotos: [], // sin fotos por ahora (probamos sólo el guardado)
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus(`❌ Error: ${data?.error || "No se pudo guardar"}`);
      } else {
        setStatus(`✅ Informe creado (id: ${data.id}). Andá a Dashboard → Informes para verlo.`);
        setTitulo("");
        setCuerpo("{\n  \"nota\": \"Ejemplo de informe\"\n}");
      }
    } catch (err: any) {
      setStatus(`❌ Error inesperado: ${err?.message || err}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Test — Guardar Informe</h1>
      <p className="text-gray-600">
        Esta es una página temporal para comprobar que <code>/api/informes/create</code> funciona.
        No sube fotos todavía; sólo título y JSON.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded-lg border">
        <div>
          <label className="block text-sm font-medium text-gray-700">Título</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            placeholder="Ej: Av. Siempre Viva 123 - Córdoba"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Cuerpo (JSON)
          </label>
          <textarea
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            rows={10}
            className="mt-1 w-full border rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-sky-400"
          />
        </div>

        <button
          type="submit"
          disabled={guardando}
          className="bg-sky-600 text-white font-semibold px-6 py-2 rounded-md hover:bg-sky-700 transition disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar informe"}
        </button>
      </form>

      {status && (
        <p
          className={`text-sm ${
            status.startsWith("✅")
              ? "text-green-600"
              : status.startsWith("❌")
              ? "text-red-600"
              : "text-gray-700"
          }`}
        >
          {status}
        </p>
      )}
    </div>
  );
}
