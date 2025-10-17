"use client";

import { useEffect, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

export default function AsesorCuentaPage() {
  const { user } = useAuth();

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);

  const [msgProfile, setMsgProfile] = useState<string | null>(null);
  const [msgCreds, setMsgCreds] = useState<string | null>(null);

  const safeUser = (user || {}) as any;

  const [perfil, setPerfil] = useState({
    nombre: safeUser?.nombre || safeUser?.user_metadata?.nombre || "",
    apellido: safeUser?.apellido || safeUser?.user_metadata?.apellido || "",
    telefono: safeUser?.telefono || safeUser?.user_metadata?.telefono || "",
  });

  const [emailForm, setEmailForm] = useState({
    actualEmail: safeUser?.email || "",
    newEmail: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPasswords, setShowPasswords] = useState(false);

  // 🔄 Prefill desde profiles si existe (toma prioridad)
  useEffect(() => {
    const loadFromProfile = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("nombre, apellido, telefono")
        .eq("id", user.id)
        .maybeSingle();
      if (!error && data) {
        setPerfil((p) => ({
          nombre: data.nombre ?? p.nombre,
          apellido: data.apellido ?? p.apellido,
          telefono: data.telefono ?? p.telefono,
        }));
      }
    };
    loadFromProfile();
  }, [user]);

  // ==============================
  // Guardar datos personales
  // ==============================
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    setMsgProfile(null);

    try {
      // 1) Actualizar tabla profiles (RLS self-update)
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          nombre: perfil.nombre || null,
          apellido: perfil.apellido || null,
          telefono: perfil.telefono || null,
        })
        .eq("id", user.id);

      if (pErr) throw pErr;

      // 2) Actualizar metadata del usuario en Auth
      const { error: metaErr } = await supabase.auth.updateUser({
        data: {
          nombre: perfil.nombre || "",
          apellido: perfil.apellido || "",
          telefono: perfil.telefono || "",
          role: "asesor",
        },
      });

      if (metaErr) throw metaErr;

      setMsgProfile("✅ Datos personales actualizados.");
    } catch (err: any) {
      console.error("Error guardando perfil:", err);
      setMsgProfile("❌ Error al actualizar los datos personales.");
    } finally {
      setSavingProfile(false);
    }
  };

  // ==============================
  // Guardar email / contraseña
  // ==============================
  const handleSaveCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingCreds(true);
    setMsgCreds(null);

    try {
      // Validar contraseña actual
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: passwordForm.currentPassword,
      });
      if (signInError) {
        setMsgCreds("❌ Contraseña actual incorrecta.");
        setSavingCreds(false);
        return;
      }

      // Cambiar email (opcional)
      if (
        emailForm.newEmail &&
        emailForm.newEmail !== user.email &&
        emailForm.newEmail.includes("@")
      ) {
        const { error: emailErr } = await supabase.auth.updateUser({
          email: emailForm.newEmail,
        });
        if (emailErr) throw emailErr;
      }

      // Cambiar password (opcional)
      if (passwordForm.newPassword) {
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
          setMsgCreds("❌ Las contraseñas nuevas no coinciden.");
          setSavingCreds(false);
          return;
        }
        const { error: passErr } = await supabase.auth.updateUser({
          password: passwordForm.newPassword,
        });
        if (passErr) throw passErr;
      }

      // Limpieza de formularios
      setMsgCreds("✅ Credenciales actualizadas.");
      setEmailForm({
        actualEmail: emailForm.newEmail || user.email!,
        newEmail: "",
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      console.error("Error guardando credenciales:", err);
      setMsgCreds("❌ Error al actualizar credenciales.");
    } finally {
      setSavingCreds(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 space-y-10">
      <h1 className="text-2xl font-bold">Cuenta del Asesor</h1>

      {/* DATOS PERSONALES */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Datos personales</h2>
        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre</label>
            <input
              type="text"
              value={perfil.nombre}
              onChange={(e) => setPerfil({ ...perfil, nombre: e.target.value })}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Apellido</label>
            <input
              type="text"
              value={perfil.apellido}
              onChange={(e) => setPerfil({ ...perfil, apellido: e.target.value })}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Teléfono</label>
            <input
              type="text"
              value={perfil.telefono}
              onChange={(e) => setPerfil({ ...perfil, telefono: e.target.value })}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
              placeholder="Ej: 11-1234-5678"
            />
          </div>

          <div className="md:col-span-2 flex justify-center">
            <button
              type="submit"
              disabled={savingProfile}
              className="bg-sky-600 text-white font-semibold px-6 py-2 rounded-md hover:bg-sky-700 transition disabled:opacity-50"
            >
              {savingProfile ? "Guardando..." : "Guardar datos personales"}
            </button>
          </div>

          {msgProfile && (
            <p
              className={`md:col-span-2 text-center text-sm ${
                msgProfile.startsWith("✅")
                  ? "text-green-600"
                  : msgProfile.startsWith("❌")
                  ? "text-red-600"
                  : "text-gray-600"
              }`}
            >
              {msgProfile}
            </p>
          )}
        </form>
      </section>

      {/* CREDENCIALES */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Email y contraseña</h2>
        <form onSubmit={handleSaveCreds} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email actual</label>
            <input
              type="email"
              value={emailForm.actualEmail}
              disabled
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-gray-100 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text sm font-medium text-gray-700">Nuevo email</label>
            <input
              type="email"
              value={emailForm.newEmail}
              onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
              placeholder="Opcional"
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Contraseña actual</label>
            <input
              type={showPasswords ? "text" : "password"}
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Nueva contraseña</label>
            <input
              type={showPasswords ? "text" : "password"}
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              placeholder="Opcional"
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Confirmar nueva contraseña</label>
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

          <div className="md:col-span-2 flex justify-center">
            <button
              type="submit"
              disabled={savingCreds}
              className="bg-amber-600 text-white font-semibold px-6 py-2 rounded-md hover:bg-amber-700 transition disabled:opacity-50"
            >
              {savingCreds ? "Actualizando..." : "Actualizar email/contraseña"}
            </button>
          </div>

          {msgCreds && (
            <p
              className={`md:col-span-2 text-center text-sm ${
                msgCreds.startsWith("✅")
                  ? "text-green-600"
                  : msgCreds.startsWith("❌")
                  ? "text-red-600"
                  : "text-gray-600"
              }`}
            >
              {msgCreds}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
