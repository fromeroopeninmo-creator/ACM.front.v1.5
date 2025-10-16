"use client";

import { useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useEmpresa } from "@/hooks/useEmpresa";

export default function EmpresaCuentaPage() {
  const { user } = useAuth();
  const { setPrimaryColor, setLogoUrl } = useTheme();
  const { empresa: formData, mutate, isLoading } = useEmpresa();

  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  if (isLoading || !formData)
    return (
      <div className="p-6 text-center text-gray-500">
        Cargando información de la empresa...
      </div>
    );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    mutate(
      {
        ...(formData as Record<string, any>),
        [e.target.name]: e.target.value,
      } as typeof formData,
      false
    );
  };

  // =====================================================
// 💾 GUARDAR DATOS EMPRESA (payload blindado sin alias)
// =====================================================
const handleSave = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!user) return;
  setSaving(true);
  setMessage(null);

  try {
    // Helper para leer del tope o, si vino “contaminado”, desde a.*
    const pick = (key: string) => {
      const anyForm = formData as any;

      // Top-level
      if (anyForm && anyForm[key] !== undefined && anyForm[key] !== null) {
        return anyForm[key];
      }

      // Posible contaminación: a.{key}
      if (
        anyForm &&
        anyForm.a &&
        typeof anyForm.a === "object" &&
        anyForm.a[key] !== undefined &&
        anyForm.a[key] !== null
      ) {
        return anyForm.a[key];
      }

      // Posible forma plana “a.key” (clave con punto): NO la usamos en el payload,
      // pero si existiera, la tomamos solo como valor (nunca como clave).
      if (
        anyForm &&
        typeof anyForm === "object" &&
        Object.prototype.hasOwnProperty.call(anyForm, `a.${key}`)
      ) {
        return anyForm[`a.${key}`];
      }

      return undefined;
    };

    // Construimos payload campo por campo (sin spreads de objetos “sospechosos”)
    const cleanData: Record<string, any> = {};
    const put = (k: string, v: any) => {
      if (v !== undefined) cleanData[k] = v;
    };

    put("nombre_comercial", pick("nombre_comercial"));
    put("razon_social",     pick("razon_social"));
    put("cuit",             pick("cuit"));
    put("matriculado",      pick("matriculado"));
    put("cpi",              pick("cpi"));
    put("telefono",         pick("telefono"));
    put("direccion",        pick("direccion"));
    put("localidad",        pick("localidad"));
    put("provincia",        pick("provincia"));
    put("condicion_fiscal", pick("condicion_fiscal"));
    put("color",            pick("color"));
    put("logo_url",         pick("logo_url"));

    // 🚫 Eliminar cualquier rastro de alias/contaminación
    delete (cleanData as any).a;
    delete (cleanData as any)["a.color"];
    delete (cleanData as any)["a.logo_url"];
    delete (cleanData as any).empresa;
    delete (cleanData as any).id;
    delete (cleanData as any).user_id;
    delete (cleanData as any).created_at;
    delete (cleanData as any).updated_at;

    // 🔍 Log de diagnóstico
    console.log("🧪 Keys en formData:", Object.keys(formData as any));
    console.log("🧪 Payload limpio a enviar:", cleanData);

    // ✅ Update por user_id (rol empresa)
    const { error } = await supabase
      .from("empresas")
      .update(cleanData)
      .eq("user_id", user.id);

    if (error) throw error;

    // 🎨 Actualizar color global instantáneamente si cambió
    if (cleanData.color) {
      setPrimaryColor(cleanData.color);
      localStorage.setItem("vai_primaryColor", cleanData.color);
      window.dispatchEvent(
        new CustomEvent("themeUpdated", {
          detail: { color: cleanData.color },
        })
      );
    }

    await mutate(); // revalidar datos
    setMessage("✅ Datos actualizados correctamente.");
  } catch (err) {
    console.error("Error al guardar:", err);
    setMessage("❌ Error al guardar los cambios.");
  } finally {
    setSaving(false);
  }
};

// =====================================================
// 🖼️ SUBIR LOGO EMPRESA
// =====================================================
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

    mutate(
      {
        ...(formData as Record<string, any>),
        logo_url: publicUrl,
      } as typeof formData,
      false
    );

    localStorage.setItem("vai_logoUrl", publicUrl);
    setLogoUrl(publicUrl);

    window.dispatchEvent(
      new CustomEvent("themeUpdated", {
        detail: { logoUrl: publicUrl },
        bubbles: false,
      })
    );

    await mutate();
    setMessage("✅ Logo actualizado correctamente.");
  } catch (err) {
    console.error("Error subiendo logo:", err);
    setMessage("❌ Error al subir el logo.");
  } finally {
    setUploading(false);
  }
};

// =====================================================
// 🔐 ACTUALIZAR EMAIL / PASSWORD (sin cambios lógicos)
// =====================================================
const handleAccountUpdate = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!user) return;
  setUpdatingAccount(true);
  setAccountMessage(null);

  try {
    if (
      passwordForm.newPassword &&
      passwordForm.newPassword !== passwordForm.confirmPassword
    ) {
      setAccountMessage("❌ Las contraseñas nuevas no coinciden.");
      setUpdatingAccount(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: passwordForm.currentPassword,
    });

    if (signInError) {
      setAccountMessage("❌ Contraseña actual incorrecta.");
      setUpdatingAccount(false);
      return;
    }

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

    if (passwordForm.newPassword) {
      const { error: passError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });
      if (passError) throw passError;
    }

    setAccountMessage("✅ Credenciales actualizadas correctamente.");
    setEmailForm({
      actualEmail: emailForm.newEmail || user.email!,
      newEmail: "",
    });
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  } catch (err) {
    console.error("Error actualizando cuenta:", err);
    setAccountMessage("❌ Error al actualizar credenciales.");
  } finally {
    setUpdatingAccount(false);
  }
};

  // =====================================================
  // 🧱 Render principal
  // =====================================================
  return (
    <div className="p-6 max-w-5xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 space-y-10">
      {/* DATOS EMPRESA */}
      <section>
        <h1 className="text-2xl font-bold mb-6">Datos de la Empresa</h1>

        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                value={(formData as Record<string, any>)[key] || ""}
                onChange={handleChange}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Provincia
            </label>
            <select
              name="provincia"
              value={(formData as Record<string, any>).provincia || ""}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color Corporativo
            </label>
            <input
              type="color"
              name="color"
              value={(formData as Record<string, any>).color || "#2563eb"}
              onChange={handleChange}
              className="w-20 h-10 border rounded cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="block text-sm font-medium text-gray-700">
              Logo de la empresa
            </label>
            {(formData as Record<string, any>).logo_url ? (
              <img
                src={(formData as Record<string, any>).logo_url}
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
          </div>

          <div className="md:col-span-2 flex justify-center mt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-sky-600 text-white font-semibold px-6 py-2 rounded-md hover:bg-sky-700 transition disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>

        {message && (
          <p
            className={`mt-3 text-center text-sm ${
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
      </section>

      {/* CUENTA / CREDENCIALES */}
      <section>
        <h2 className="text-xl font-bold mb-6">Cuenta de Acceso</h2>
        <form
          onSubmit={handleAccountUpdate}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
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

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Contraseña actual
            </label>
            <input
              type={showPasswords ? "text" : "password"}
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm({
                  ...passwordForm,
                  currentPassword: e.target.value,
                })
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
                setPasswordForm({
                  ...passwordForm,
                  newPassword: e.target.value,
                })
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
                setPasswordForm({
                  ...passwordForm,
                  confirmPassword: e.target.value,
                })
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

          <div className="col-span-2 flex justify-center mt-4">
            <button
              type="submit"
              disabled={updatingAccount}
              className="bg-amber-600 text-white font-semibold px-6 py-2 rounded-md hover:bg-amber-700 transition disabled:opacity-50"
            >
              {updatingAccount ? "Actualizando..." : "Actualizar credenciales"}
            </button>
          </div>

          {accountMessage && (
            <p
              className={`col-span-2 text-center mt-3 text-sm ${
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
