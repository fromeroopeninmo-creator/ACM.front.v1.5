"use client";

import { useEffect, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

export default function AsesorCuentaPage() {
  const { user } = useAuth();
  const safeUser = user as any;

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [updatingCreds, setUpdatingCreds] = useState(false);

  // 🔹 Perfil (tabla profiles)
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");

  // 🔹 Credenciales
  const [emailActual, setEmailActual] = useState("");
  const [emailNuevo, setEmailNuevo] = useState("");

  const [passActual, setPassActual] = useState("");
  const [passNueva, setPassNueva] = useState("");
  const [passConfirm, setPassConfirm] = useState("");
  const [mostrarPass, setMostrarPass] = useState(false);

  // Mensajes
  const [msgPerfil, setMsgPerfil] = useState<string | null>(null);
  const [msgCreds, setMsgCreds] = useState<string | null>(null);

  // ==========================
  // Cargar datos iniciales
  // ==========================
  useEffect(() => {
    const load = async () => {
      try {
        if (!safeUser?.id) {
          setLoading(false);
          return;
        }
        // Preferimos tomar nombre/telefono desde profiles
        const { data, error } = await supabase
          .from("profiles")
          .select("nombre, telefono")
          .eq("id", safeUser.id)
          .maybeSingle();

        if (!error && data) {
          setNombre(data.nombre || safeUser?.nombre || "");
          setTelefono(data.telefono || safeUser?.telefono || "");
        } else {
          // Fallback a lo que tenga el user del contexto
          setNombre(safeUser?.nombre || "");
          setTelefono(safeUser?.telefono || "");
        }

        setEmailActual(safeUser?.email || "");
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [safeUser]);

  // ==========================
  // Guardar PERFIL (profiles)
  // ==========================
  const handleGuardarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!safeUser?.id) return;

    setMsgPerfil(null);
    setSavingProfile(true);
    try {
      const payload: Record<string, any> = {};
      if (typeof nombre === "string") payload.nombre = nombre.trim();
      if (typeof telefono === "string") payload.telefono = telefono.trim();

      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", safeUser.id);

      if (error) throw error;

      setMsgPerfil("✅ Perfil actualizado correctamente.");
    } catch (err: any) {
      console.error(err);
      setMsgPerfil("❌ Error al actualizar el perfil.");
    } finally {
      setSavingProfile(false);
    }
  };

  // =======================================
  // Guardar CREDENCIALES (email/password)
  // =======================================
  const handleGuardarCredenciales = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!safeUser?.email) return;

    setMsgCreds(null);
    setUpdatingCreds(true);

    try {
      // 1) Si cambia la contraseña, verificar actual y confirmar nueva
      if (passNueva || passConfirm) {
        if (!passActual) {
          setMsgCreds("❌ Ingresá tu contraseña actual para poder cambiarla.");
          setUpdatingCreds(false);
          return;
        }
        if (passNueva !== passConfirm) {
          setMsgCreds("❌ La nueva contraseña y su confirmación no coinciden.");
          setUpdatingCreds(false);
          return;
        }

        // Reautenticar con la contraseña actual
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: safeUser.email,
          password: passActual,
        });
        if (reauthError) {
          setMsgCreds("❌ La contraseña actual es incorrecta.");
          setUpdatingCreds(false);
          return;
        }

        // Actualizar password
        const { error: passErr } = await supabase.auth.updateUser({
          password: passNueva,
        });
        if (passErr) throw passErr;
      }

      // 2) Si cambia el email
      if (emailNuevo && emailNuevo !== safeUser.email && emailNuevo.includes("@")) {
        const { error: emailErr } = await supabase.auth.updateUser({
          email: emailNuevo,
        });
        if (emailErr) throw emailErr;
        setEmailActual(emailNuevo);
        setEmailNuevo("");
      }

      // Cleanup de campos de password
      setPassActual("");
      setPassNueva("");
      setPassConfirm("");

      setMsgCreds("✅ Credenciales actualizadas correctamente.");
    } catch (err: any) {
      console.error(err);
      // Mensaje genérico (puede requerir verificación de email si cambió el correo)
      setMsgCreds(
        err?.message?.toLowerCase().includes("email")
          ? "⚠️ Revisá tu email para confirmar el cambio de correo."
          : "❌ Error al actualizar credenciales."
      );
    } finally {
      setUpdatingCreds(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">Cargando datos...</div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 space-y-10">
      {/* ================= PERFIL ================= */}
      <section>
        <h1 className="text-2xl font-bold mb-4">Mis datos</h1>
        <form onSubmit={handleGuardarPerfil} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
              placeholder="Tu nombre"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Teléfono
            </label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
              placeholder="Tu teléfono"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingProfile}
              className="bg-sky-600 text-white font-semibold px-6 py-2 rounded-md hover:bg-sky-700 transition disabled:opacity-50"
            >
              {savingProfile ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>

          {msgPerfil && (
            <p
              className={`text-sm mt-2 ${
                msgPerfil.startsWith("✅")
                  ? "text-green-600"
                  : msgPerfil.startsWith("⚠️")
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}
            >
              {msgPerfil}
            </p>
          )}
        </form>
      </section>

      {/* ================= CREDENCIALES ================= */}
      <section>
        <h2 className="text-xl font-bold mb-4">Credenciales de acceso</h2>
        <form onSubmit={handleGuardarCredenciales} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Email actual (solo lectura) */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Email actual
            </label>
            <input
              type="email"
              value={emailActual}
              disabled
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-gray-100 cursor-not-allowed"
            />
          </div>

          {/* Nuevo email */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Nuevo email (opcional)
            </label>
            <input
              type="email"
              value={emailNuevo}
              onChange={(e) => setEmailNuevo(e.target.value)}
              placeholder="Dejar vacío si no querés cambiarlo"
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>

          {/* Passwords */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Contraseña actual
            </label>
            <input
              type={mostrarPass ? "text" : "password"}
              value={passActual}
              onChange={(e) => setPassActual(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nueva contraseña (opcional)
            </label>
            <input
              type={mostrarPass ? "text" : "password"}
              value={passNueva}
              onChange={(e) => setPassNueva(e.target.value)}
              placeholder="Dejar vacío si no querés cambiarla"
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Confirmar nueva contraseña
            </label>
            <input
              type={mostrarPass ? "text" : "password"}
              value={passConfirm}
              onChange={(e) => setPassConfirm(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400"
            />
            <button
              type="button"
              onClick={() => setMostrarPass((v) => !v)}
              className="text-xs text-sky-600 mt-1"
            >
              {mostrarPass ? "🙈 Ocultar contraseñas" : "👁️ Ver contraseñas"}
            </button>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={updatingCreds}
              className="bg-amber-600 text-white font-semibold px-6 py-2 rounded-md hover:bg-amber-700 transition disabled:opacity-50"
            >
              {updatingCreds ? "Actualizando..." : "Actualizar credenciales"}
            </button>
          </div>

          {msgCreds && (
            <p
              className={`md:col-span-2 text-sm mt-2 ${
                msgCreds.startsWith("✅")
                  ? "text-green-600"
                  : msgCreds.startsWith("⚠️")
                  ? "text-yellow-600"
                  : "text-red-600"
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
