"use client";

import { useEffect, useState } from "react";
import { supabase } from "#lib/supabaseClient";

export default function EmpresaCuentaPage() {
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

  // 🔹 Cargar datos de la empresa al montar el componente
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session?.user) {
          if (isMounted) setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("empresas")
          .select(
            "nombre_comercial, razon_social, matriculado, cpi, telefono, direccion, provincia, condicion_fiscal"
          )
          .eq("id_usuario", session.user.id)
          .maybeSingle(); // ✅ más seguro que .single()

        if (error) throw error;

        if (data && isMounted) {
          setFormData((prev) => ({
            ...prev,
            ...data,
          }));
        }
      } catch (err) {
        console.error("Error cargando datos de empresa:", err);
        if (isMounted) setMessage("⚠️ Error al cargar los datos.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // 👇 Ejecutar solo en cliente
    if (typeof window !== "undefined") {
      fetchData();
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // 🔹 Actualizar estado del formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 🔹 Guardar cambios en Supabase
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setMessage("⚠️ Sesión no encontrada.");
        return;
      }

      const { error } = await supabase
        .from("empresas")
        .update(formData)
        .eq("id_usuario", session.user.id);

      if (error) throw error;

      setMessage("✅ Datos actualizados correctamente.");
    } catch (err) {
      console.error("Error guardando datos:", err);
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

  // 🔹 Render principal
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
