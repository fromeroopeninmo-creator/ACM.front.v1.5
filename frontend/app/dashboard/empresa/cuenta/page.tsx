"use client";

import { useEffect, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext"; // 👈 usamos el contexto global

export default function EmpresaCuentaPage() {
  const { user } = useAuth(); // ✅ mismo patrón que en Asesores
  const [formData, setFormData] = useState({
    nombre_comercial: "",
    razon_social: "",
    matriculado: "",
    cpi: "",
    telefono: "",
    direccion: "",
    provincia: "",
    condicion_fiscal: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 🔹 Cargar datos de la empresa una vez que hay usuario
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from("empresas")
          .select(
            "nombre_comercial, razon_social, matriculado, cpi, telefono, direccion, provincia, condicion_fiscal"
          )
          .eq("id_usuario", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setFormData((prev) => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.error("Error cargando datos de la empresa:", err);
        setMessage("⚠️ Error al cargar los datos de la empresa.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("empresas")
        .update(formData)
        .eq("id_usuario", user.id);

      if (error) throw error;

      setMessage("✅ Datos actualizados correctamente.");
    } catch (err) {
      console.error("Error al guardar los cambios:", err);
      setMessage("❌ Error al guardar los cambios.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="p-6 text-center text-gray-500">
        Cargando información de la empresa...
      </div>
    );

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200">
      <h1 className="text-2xl font-bold mb-4">Mi Cuenta</h1>
      <form onSubmit={handleSave} className="space-y-4">
        {Object.entries(formData).map(([key, value]) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 capitalize">
              {key.replace("_", " ")}
            </label>
            <input
              type="text"
              name={key}
              value={value || ""}
              onChange={handleChange}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>
        ))}

        <button
          type="submit"
          disabled={saving}
          className="bg-sky-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-sky-700 transition disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>

        {message && (
          <p
            className={`mt-2 text-sm ${
              message.startsWith("✅") ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
