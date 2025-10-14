"use client";

import { useEffect, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

export default function EmpresaCuentaPage() {
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    nombre_comercial: "",
    razon_social: "",
    matriculado: "",
    cpi: "",
    telefono: "",
    direccion: "",
    localidad: "",
    provincia: "",
    condicion_fiscal: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 🔹 Listado de provincias (ARG) y condiciones fiscales (AFIP)
  const provincias = [
    "Buenos Aires",
    "CABA",
    "Catamarca",
    "Chaco",
    "Chubut",
    "Córdoba",
    "Corrientes",
    "Entre Ríos",
    "Formosa",
    "Jujuy",
    "La Pampa",
    "La Rioja",
    "Mendoza",
    "Misiones",
    "Neuquén",
    "Río Negro",
    "Salta",
    "San Juan",
    "San Luis",
    "Santa Cruz",
    "Santa Fe",
    "Santiago del Estero",
    "Tierra del Fuego",
    "Tucumán",
  ];

  const condicionesFiscales = [
    "Responsable Inscripto",
    "Monotributista",
    "Consumidor Final",
  ];

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
          .eq("user_id", user.id) // 👈 corregido campo clave
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setFormData((prev) => ({ ...prev, ...data }));
        } else {
          setMessage("⚠️ No se encontraron datos de empresa asociados a este usuario.");
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

  // 🔹 Actualizar estado del formulario
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 🔹 Guardar cambios
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);

    try {
      const updateData = {
        nombre_comercial: formData.nombre_comercial,
        razon_social: formData.razon_social,
        matriculado: formData.matriculado,
        cpi: formData.cpi,
        telefono: formData.telefono,
        direccion: formData.direccion,
        provincia: formData.provincia,
        condicion_fiscal: formData.condicion_fiscal,
      };

      const { error } = await supabase
        .from("empresas")
        .update(updateData)
        .eq("user_id", user.id); // 👈 mismo fix aquí

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

  // 🔹 Render principal
  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200">
      <h1 className="text-2xl font-bold mb-4">Datos de la Empresa</h1>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Nombre comercial */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Nombre Comercial
          </label>
          <input
            type="text"
            name="nombre_comercial"
            value={formData.nombre_comercial || ""}
            onChange={handleChange}
            placeholder="Ej: Inmobiliaria Delta"
            className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
          />
        </div>

        {/* Razón social */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Razón Social
          </label>
          <input
            type="text"
            name="razon_social"
            value={formData.razon_social || ""}
            onChange={handleChange}
            placeholder="Ej: Delta Propiedades S.A."
            className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
          />
        </div>

        {/* Matriculado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Matriculado/a
            </label>
            <input
              type="text"
              name="matriculado"
              value={formData.matriculado || ""}
              onChange={handleChange}
              placeholder="Nombre del matriculado"
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              CPI / CUCICBA
            </label>
            <input
              type="text"
              name="cpi"
              value={formData.cpi || ""}
              onChange={handleChange}
              placeholder="Ej: CPI 3456"
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>
        </div>

        {/* Teléfono y dirección */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Teléfono
            </label>
            <input
              type="text"
              name="telefono"
              value={formData.telefono || ""}
              onChange={handleChange}
              placeholder="Ej: +54 9 11 5555-5555"
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Dirección
            </label>
            <input
              type="text"
              name="direccion"
              value={formData.direccion || ""}
              onChange={handleChange}
              placeholder="Calle, número y localidad"
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>
        </div>
        
        {/* Localidad */}
<div>
  <label className="block text-sm font-medium text-gray-700">
    Localidad
  </label>
  <input
    type="text"
    name="localidad"
    value={formData.localidad || ""}
    onChange={handleChange}
    placeholder="Ej: Rosario, Mar del Plata, San Isidro..."
    className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
  />
</div>


        {/* Provincia */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Provincia
          </label>
          <select
            name="provincia"
            value={formData.provincia || ""}
            onChange={handleChange}
            className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
          >
            <option value="">Seleccionar provincia</option>
            {provincias.map((prov) => (
              <option key={prov} value={prov}>
                {prov}
              </option>
            ))}
          </select>
        </div>

        {/* Condición Fiscal */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Condición Fiscal
          </label>
          <select
            name="condicion_fiscal"
            value={formData.condicion_fiscal || ""}
            onChange={handleChange}
            className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
          >
            <option value="">Seleccionar condición fiscal</option>
            {condicionesFiscales.map((cond) => (
              <option key={cond} value={cond}>
                {cond}
              </option>
            ))}
          </select>
        </div>

        {/* Botón guardar */}
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
