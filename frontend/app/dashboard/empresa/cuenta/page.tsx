"use client";

import { useEffect, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext"; // 🟢 agregado para el color dinámico

export default function EmpresaCuentaPage() {
  const { user } = useAuth();
  const { setPrimaryColor } = useTheme(); // 🟢 permite cambiar el color global

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

  // ================================
  // 🆕 Cambio de email y contraseña
  // ================================
  const [emailForm, setEmailForm] = useState({
    actualEmail: user?.email || "",
    newEmail: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [updatingAccount, setUpdatingAccount] = useState(false);

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
        if (data) {
          setFormData((prev) => ({ ...prev, ...data }));
          setPrimaryColor(data.color || "#E6A930");
        }
      } catch (err) {
        console.error("Error cargando datos de empresa:", err);
        setMessage("⚠️ Error al cargar los datos de la empresa.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, setPrimaryColor]);

  // ============================================================
  // 🔹 Manejo de cambios en formulario general
  // ============================================================
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ============================================================
  // 🔹 Guardar cambios (datos generales)
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

      setPrimaryColor(formData.color);
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

      const { error: uploadError } = await supabase.storage
        .from("logos_empresas")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("logos_empresas").getPublicUrl(filePath);

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
  // 🔹 Cambiar email o contraseña
  // ============================================================
  const handleAccountUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setUpdatingAccount(true);
    setAccountMessage(null);

    try {
      // Validaciones básicas
      if (
        passwordForm.newPassword &&
        passwordForm.newPassword !== passwordForm.confirmPassword
      ) {
        setAccountMessage("❌ Las contraseñas nuevas no coinciden.");
        setUpdatingAccount(false);
        return;
      }

      // Verificar contraseña actual antes de cualquier cambio
      const { data: signInCheck, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: user.email!,
          password: passwordForm.currentPassword,
        });

      if (signInError) {
        setAccountMessage("❌ Contraseña actual incorrecta.");
        setUpdatingAccount(false);
        return;
      }

      // Si se cambia el email
      if (
        emailForm.newEmail &&
        emailForm.newEmail !== user.email &&
        emailForm.newEmail.includes("@")
      ) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: emailForm.newEmail,
        });
        if (emailError) throw emailError;
      }

      // Si se cambia la contraseña
      if (passwordForm.newPassword) {
        const { error: passError } = await supabase.auth.updateUser({
          password: passwordForm.newPassword,
        });
        if (passError) throw passError;
      }

      setAccountMessage("✅ Credenciales actualizadas correctamente.");
      setEmailForm({ actualEmail: emailForm.newEmail || user.email!, newEmail: "" });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      console.error("Error actualizando cuenta:", err);
      setAccountMessage("❌ Error al actualizar credenciales.");
    } finally {
      setUpdatingAccount(false);
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
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 space-y-10">
      {/* ================= DATOS DE LA EMPRESA ================= */}
      <section>
        <h1 className="text-2xl font-bold mb-4">Datos de la Empresa</h1>

        <form onSubmit={handleSave} className="space-y-4">
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

          {/* Color corporativo */}
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

          {/* Logo */}
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
      </section>

      {/* ================= CUENTA / CREDENCIALES ================= */}
      <section>
        <h2 className="text-xl font-bold mb-4">Cuenta de Acceso</h2>
        <form onSubmit={handleAccountUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email actual
            </label>
            <input
              type="email"
              value={emailForm.actualEmail}
              disabled
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-gray-100 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nuevo email
            </label>
            <input
              type="email"
              value={emailForm.newEmail}
              onChange={(e) =>
                setEmailForm({ ...emailForm, newEmail: e.target.value })
              }
              placeholder="Opcional - dejar vacío si no cambia"
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>

          {/* Contraseñas */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Contraseña actual
            </label>
            <input
              type={showPasswords ? "text" : "password"}
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
              }
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nueva contraseña
            </label>
            <input
              type={showPasswords ? "text" : "password"}
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, newPassword: e.target.value })
              }
              placeholder="Opcional - dejar vacío si no cambia"
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Confirmar nueva contraseña
            </label>
            <input
              type={showPasswords ? "text" : "password"}
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
              }
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
              className="text-xs text-sky-600 mt-1"
            >
              {showPasswords ? "🙈 Ocultar contraseñas" : "👁️ Ver contraseñas"}
            </button>
          </div>

          <button
            type="submit"
            disabled={updatingAccount}
            className="bg-amber-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-amber-700 transition disabled:opacity-50"
          >
            {updatingAccount ? "Actualizando..." : "Actualizar credenciales"}
          </button>

          {accountMessage && (
            <p
              className={`mt-2 text-sm ${
                accountMessage.startsWith("✅")
                  ? "text-green-600"
                  : accountMessage.startsWith("❌")
                  ? "text-red-600"
                  : "text-yellow-600"
              }`}
            >
              {accountMessage}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
