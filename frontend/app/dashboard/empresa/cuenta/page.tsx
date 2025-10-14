"use client";

import { useEffect, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

export default function EmpresaCuentaPage() {
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    nombre_comercial: "",
    razon_social: "",
    cuit: "",
    matriculado: "",
    cpi: "",
    telefono: "",
    direccion: "",
    localidad: "",
    provincia: "",
    condicion_fiscal: "",
    color: "#E6A930",
    logo_url: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // ============================================================
  // 🔹 Cargar datos actuales de la empresa
  // ============================================================
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from("empresas")
          .select(
            "nombre_comercial, razon_social, cuit, matriculado, cpi, telefono, direccion, localidad, provincia, condicion_fiscal, color, logo_url"
          )
          .eq("user_id", user.id)
          .single();

        if (error) throw error;
        if (data) setFormData((prev) => ({ ...prev, ...data }));
      } catch (err) {
        console.error("Error cargando datos de empresa:", err);
        setMessage("⚠️ Error al cargar los datos de la empresa.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // ============================================================
  // 🔹 Manejo de cambios en formulario
  // ============================================================
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ============================================================
  // 🔹 Guardar cambios
  // ============================================================
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("empresas")
        .update(formData)
        .eq("user_id", user.id);

      if (error) throw error;
      setMessage("✅ Datos actualizados correctamente.");
    } catch (err) {
      console.error("Error al guardar:", err);
      setMessage("❌ Error al guardar los cambios.");
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // 🔹 Subir o cambiar logo
  // ============================================================
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file || !user) return;

      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `empresa_${user.id}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Subir archivo a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("logos").getPublicUrl(filePath);

      // Actualizar en BD
      const { error: dbError } = await supabase
        .from("empresas")
        .update({ logo_url: publicUrl })
        .eq("user_id", user.id);

      if (dbError) throw dbError;

      setFormData((prev) => ({ ...prev, logo_url: publicUrl }));
      setMessage("✅ Logo actualizado correctamente.");
    } catch (err) {
      console.error("Error subiendo logo:", err);
      setMessage("❌ Error al subir el logo.");
    } finally {
      setUploading(false);
    }
  };

  // ============================================================
  // 🔹 Render principal
  // ============================================================
  if (loading)
    return (
      <div className="p-6 text-center text-gray-500">
        Cargando información de la empresa...
      </div>
    );

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200">
      <h1 className="text-2xl font-bold mb-4">Datos de la Empresa</h1>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Campos generales */}
        {[
          ["nombre_comercial", "Nombre Comercial"],
          ["razon_social", "Razón Social"],
          ["cuit", "CUIT"],
          ["matriculado", "Matriculado/a"],
          ["cpi", "CPI"],
          ["telefono", "Teléfono"],
          ["direccion", "Dirección"],
          ["localidad", "Localidad"],
        ].map(([key, label]) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700">
              {label}
            </label>
            <input
              type="text"
              name={key}
              value={formData[key as keyof typeof formData] || ""}
              onChange={handleChange}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>
        ))}

        {/* Provincia */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Provincia
          </label>
          <select
            name="provincia"
            value={formData.provincia}
            onChange={handleChange}
            className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
          >
            <option value="">Seleccionar provincia...</option>
            {[
              "CABA",
              "Buenos Aires",
              "Córdoba",
              "Santa Fe",
              "Mendoza",
              "Tucumán",
              "Salta",
              "Entre Ríos",
              "Corrientes",
              "Misiones",
              "Chaco",
              "San Luis",
              "San Juan",
              "Neuquén",
              "Río Negro",
              "Chubut",
              "Santa Cruz",
              "La Pampa",
              "La Rioja",
              "Catamarca",
              "Formosa",
              "Santiago del Estero",
              "Jujuy",
              "Tierra del Fuego",
            ].map((prov) => (
              <option key={prov} value={prov}>
                {prov}
              </option>
            ))}
          </select>
        </div>

        {/* Condición fiscal */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Condición Fiscal
          </label>
          <select
            name="condicion_fiscal"
            value={formData.condicion_fiscal}
            onChange={handleChange}
            className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
          >
            <option value="">Seleccionar...</option>
            <option value="Responsable Inscripto">Responsable Inscripto</option>
            <option value="Monotributista">Monotributista</option>
            <option value="Exento">Exento</option>
            <option value="Consumidor Final">Consumidor Final</option>
          </select>
        </div>

        {/* 🎨 Color corporativo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Color Corporativo
          </label>
          <input
            type="color"
            name="color"
            value={formData.color}
            onChange={handleChange}
            className="w-20 h-10 border rounded cursor-pointer"
          />
        </div>

        {/* 🖼️ Logo */}
        <div className="flex flex-col gap-2">
          <label className="block text-sm font-medium text-gray-700">
            Logo de la empresa
          </label>
          {formData.logo_url ? (
            <img
              src={formData.logo_url}
              alt="Logo actual"
              className="h-16 object-contain border rounded"
            />
          ) : (
            <p className="text-gray-400 text-sm">No hay logo cargado</p>
          )}

          <input
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            disabled={uploading}
            className="text-sm text-gray-600"
          />
          {uploading && (
            <p className="text-xs text-gray-400 mt-1">
              Subiendo imagen, por favor espera...
            </p>
          )}
        </div>

        {/* Botón guardar */}
        <button
          type="submit"
          disabled={saving}
          className="bg-sky-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-sky-700 transition disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>

        {/* Mensajes */}
        {message && (
          <p
            className={`mt-2 text-sm ${
              message.startsWith("✅")
                ? "text-green-600"
                : message.startsWith("⚠️")
                ? "text-yellow-600"
                : "text-red-600"
            }`}
          >
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
