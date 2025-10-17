"use client";

import { useState } from "react";

export default function TestGuardarInformePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCrear = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const body = {
        titulo: "Informe de prueba",
        data: {
          // 👇 JSON mínimo requerido por /api/informes/create
          propiedad: { direccion: "Av. Siempreviva 742", ciudad: "Córdoba" },
          precioSugerido: 123456,
          comparables: [],
        },
        // Si antes subes imágenes con /api/informes/upload, mete acá esas URLs:
        fotos: [],
      };

      const res = await fetch("/api/informes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error || "Error desconocido");
      } else {
        setResult(json);
      }
    } catch (e: any) {
      setError(e?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleSubirFotosYCrear = async (evt: React.ChangeEvent<HTMLInputElement>) => {
    const files = evt.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const fd = new FormData();
      for (const f of Array.from(files)) {
        fd.append("file", f);
      }

      // 1) Subir fotos (se comprimen a 800px y se guardan en el bucket)
      const up = await fetch("/api/informes/upload", { method: "POST", body: fd });
      const upJson = await up.json();
      if (!up.ok) throw new Error(upJson?.error || "Error subiendo imágenes");
      const urls: string[] = upJson.urls || [];

      // 2) Crear informe usando esas URLs
      const body = {
        titulo: "Informe con fotos",
        data: {
          propiedad: { direccion: "Bv. San Juan 100", ciudad: "Córdoba" },
          precioSugerido: 987654,
          comparables: [],
        },
        fotos: urls,
      };

      const res = await fetch("/api/informes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Error creando informe");
      setResult(json);
    } catch (e: any) {
      setError(e?.message || "Error inesperado");
    } finally {
      setLoading(false);
      // Limpia input para poder volver a elegir el mismo archivo si querés
      evt.target.value = "";
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">Test: Crear Informe</h1>

      <button
        onClick={handleCrear}
        disabled={loading}
        className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
      >
        {loading ? "Creando..." : "Crear informe de prueba (sin fotos)"}
      </button>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Subir fotos y crear informe</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleSubirFotosYCrear}
          disabled={loading}
        />
      </div>

      {result && (
        <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}

      {error && <p className="text-red-600">❌ {error}</p>}
    </div>
  );
}
