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

  // 🚀 cache-busting para el preview del logo
  const [logoBust, setLogoBust] = useState<number>(0);

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
  // 💾 GUARDAR DATOS EMPRESA (via API server-side segura)
  // =====================================================
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);

    try {
      // helper para leer del tope o desde posible a.*
      const pick = (key: string) => {
        const anyForm = formData as any;
        if (anyForm && anyForm[key] != null) return anyForm[key];
        if (
          anyForm &&
          anyForm.a &&
          typeof anyForm.a === "object" &&
          anyForm.a[key] != null
        )
          return anyForm.a[key];
        if (
          anyForm &&
          Object.prototype.hasOwnProperty.call(anyForm, `a.${key}`)
        )
          return anyForm[`a.${key}`];
        return undefined;
      };

      const update: Record<string, any> = {};
      const put = (k: string, v: any) => {
        if (v !== undefined) update[k] = v;
      };

      put("nombre_comercial", pick("nombre_comercial"));
      put("razon_social", pick("razon_social"));
      put("cuit", pick("cuit"));
      put("matriculado", pick("matriculado"));
      put("cpi", pick("cpi"));
      put("telefono", pick("telefono"));
      put("direccion", pick("direccion"));
      put("localidad", pick("localidad"));
      put("provincia", pick("provincia"));
      put("condicion_fiscal", pick("condicion_fiscal"));
      put("color", pick("color"));
      put("logo_url", pick("logo_url"));

      console.log("🔒 usando API /api/empresa/update");
      console.log("🧪 Payload hacia API:", { user_id: user.id, update });

      const res = await fetch("/api/empresa/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, update }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        console.error("API error:", j);
        throw new Error(j?.error?.message || "Error en actualización");
      }

      if (update.color) {
        setPrimaryColor(update.color);
        localStorage.setItem("vai_primaryColor", update.color);
        window.dispatchEvent(
          new CustomEvent("themeUpdated", { detail: { color: update.color } })
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
  // 🖼️ SUBIR LOGO EMPRESA (via API server-side + cache-busting)
  // =====================================================
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file || !user) return;

      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `empresa_${user.id}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // 1) Subir al storage (con cacheControl=0 para evitar nuevo cache)
      const { error: uploadError } = await supabase.storage
        .from("logos_empresas")
        .upload(filePath, file, { upsert: true, cacheControl: "0" });

      if (uploadError) throw uploadError;

      // 2) Obtener URL pública base (la que guardamos en BD)
      const {
        data: { publicUrl },
      } = supabase.storage.from("logos_empresas").getPublicUrl(filePath);

      // 3) Actualizar en DB vía API server-side (guardamos la URL BASE)
      const res = await fetch("/api/empresa/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, update: { logo_url: publicUrl } }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        console.error("API error:", j);
        throw new Error(j?.error?.message || "Error en actualización de logo");
      }

      // 4) Cache-busting para el preview inmediato (no cambiamos lo guardado en BD)
      const bustedUrl = `${publicUrl}?v=${Date.now()}`;

      // 5) Actualizar UI inmediata (SWR + ThemeContext + localStorage)
      mutate(
        {
          ...(formData as Record<string, any>),
          logo_url: bustedUrl, // preview bustead
        } as typeof formData,
        false
      );

      localStorage.setItem("vai_logoUrl", bustedUrl);
      setLogoUrl(bustedUrl);
      setLogoBust(Date.now()); // fuerza rerender del <img>

      window.dispatchEvent(
        new CustomEvent("themeUpdated", {
          detail: { logoUrl: bustedUrl },
          bubbles: false,
        })
      );

      // 6) Revalidar (traerá la URL base desde BD; el <img> seguirá bustead por el query param)
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
  // 🔐 ACTUALIZAR EMAIL / PASSWORD (igual)
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

      <form
        onSubmit={handleSave}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {[
          ["nombre_comercial", "Nombre Comercial"],
          ["razon_social", "Razón Social"],
          ["cuit", "CUIT"],
          // 👇 sacamos condicion_fiscal de este map, va como <select> aparte
          ["matriculado", "Profesional"],
          ["cpi", "Matricula N°"],
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

        {/* 🔽 Condición Fiscal con selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Condición Fiscal
          </label>
          <select
            name="condicion_fiscal"
            value={(formData as Record<string, any>).condicion_fiscal || ""}
            onChange={handleChange}
            className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
          >
            <option value="">Seleccionar...</option>
            <option value="Consumidor Final (Exento)">
              Consumidor Final (Exento)
            </option>
            <option value="Monotributista">Monotributista</option>
            <option value="Responsable Inscripto">
              Responsable Inscripto
            </option>
          </select>
        </div>

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
              src={`${
                (formData as Record<string, any>).logo_url
              }${
                (formData as Record<string, any>).logo_url.includes("?")
                  ? ""
                  : `?v=${logoBust}`
              }`}
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
