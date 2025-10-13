"use client";

import { useState } from "react";
import { supabase } from "#lib/supabaseClient";

interface Props {
  empresaId: string;
  onCreated: () => void;
}

export default function NewAsesorForm({ empresaId, onCreated }: Props) {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!empresaId) {
      setError("No se encontró la empresa asociada.");
      return;
    }

    if (!nombre || !apellido || !email) {
      setError("Por favor, completá los campos obligatorios.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.from("asesores").insert([
      {
        empresa_id: empresaId,
        nombre,
        apellido,
        email,
        telefono,
        activo: true,
        fecha_creacion: new Date().toISOString(),
      },
    ]);

    setLoading(false);

    if (error) {
      console.error("Error al crear asesor:", error);
      setError("No se pudo crear el asesor.");
    } else {
      setNombre("");
      setApellido("");
      setEmail("");
      setTelefono("");
      onCreated();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white shadow-sm border border-gray-200 p-4 rounded-lg"
    >
      <h2 className="text-lg font-medium mb-3">Nuevo Asesor</h2>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <input
          type="text"
          placeholder="Nombre *"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Apellido *"
          value={apellido}
          onChange={(e) => setApellido(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="email"
          placeholder="Email *"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Teléfono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
      >
        {loading ? "Guardando..." : "Guardar Asesor"}
      </button>
    </form>
  );
}
