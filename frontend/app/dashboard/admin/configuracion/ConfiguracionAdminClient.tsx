// frontend/app/dashboard/admin/configuracion/ConfiguracionAdminClient.tsx
"use client";

import { useMemo, useState } from "react";

type InitialProps = {
  userId: string;
  role: string;
  isRoot: boolean;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
};

export default function ConfiguracionAdminClient({
  initial,
}: {
  initial: InitialProps;
  cookieHeader?: string; // opcional, no se usa en cliente
}) {
  // ====== State ======
  const [nombre, setNombre] = useState(initial.nombre || "");
  const [apellido, setApellido] = useState(initial.apellido || "");
  const [telefono, setTelefono] = useState(initial.telefono || "");
  const [email, setEmail] = useState(initial.email || "");

  const [newEmail, setNewEmail] = useState("");
  const [confirmNewEmail, setConfirmNewEmail] = useState("");

  const [newPass, setNewPass] = useState("");
  const [confirmNewPass, setConfirmNewPass] = useState("");

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canSaveProfile = useMemo(() => {
    return (nombre || "").trim().length > 0 || (apellido || "").trim().length > 0 || (telefono || "").trim().length > 0;
  }, [nombre, apellido, telefono]);

  const canSaveEmail = useMemo(() => {
    return newEmail.trim().length > 3 && newEmail === confirmNewEmail;
  }, [newEmail, confirmNewEmail]);

  const canSavePass = useMemo(() => {
    return newPass.length >= 8 && newPass === confirmNewPass;
  }, [newPass, confirmNewPass]);

  // ====== Handlers ======
  async function onSaveProfile() {
    setMsg(null);
    setErr(null);
    if (!canSaveProfile) return;
    setSavingProfile(true);
    try {
      const res = await fetch("/api/admin/account/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nombre: nombre || undefined,
          apellido: apellido || undefined,
          telefono: telefono || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`PUT /api/admin/account/profile → ${res.status} ${res.statusText} ${body}`);
      }
      setMsg("Datos personales actualizados.");
    } catch (e: any) {
      setErr(e?.message || "No se pudo actualizar el perfil.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onSaveEmail() {
    setMsg(null);
    setErr(null);
    if (!canSaveEmail) return;
    setSavingEmail(true);
    try {
      const res = await fetch("/api/admin/account/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newEmail }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`POST /api/admin/account/email → ${res.status} ${res.statusText} ${body}`);
      }
      setMsg("Solicitud de cambio de email enviada. Revisá tu bandeja.");
      setNewEmail("");
      setConfirmNewEmail("");
    } catch (e: any) {
      setErr(e?.message || "No se pudo iniciar el cambio de email.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function onSavePassword() {
    setMsg(null);
    setErr(null);
    if (!canSavePass) return;
    setSavingPass(true);
    try {
      const res = await fetch("/api/admin/account/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newPassword: newPass }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`POST /api/admin/account/password → ${res.status} ${res.statusText} ${body}`);
      }
      setMsg("Contraseña actualizada correctamente.");
      setNewPass("");
      setConfirmNewPass("");
    } catch (e: any) {
      setErr(e?.message || "No se pudo actualizar la contraseña.");
    } finally {
      setSavingPass(false);
    }
  }

  async function onSaveAvatar() {
    setMsg(null);
    setErr(null);
    if (!avatarFile) return;
    setSavingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", avatarFile);

      const res = await fetch("/api/admin/account/avatar", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`POST /api/admin/account/avatar → ${res.status} ${res.statusText} ${body}`);
      }
      setMsg("Foto de perfil actualizada.");
      // Podríamos refrescar preview desde la URL devuelta
      setAvatarFile(null);
    } catch (e: any) {
      setErr(e?.message || "No se pudo actualizar la foto de perfil.");
    } finally {
      setSavingAvatar(false);
    }
  }

  // ====== UI ======
  return (
    <div className="p-4 space-y-6">
      {msg ? (
        <div className="rounded-md border border-green-200 bg-green-50 text-green-700 px-3 py-2 text-sm">
          {msg}
        </div>
      ) : null}
      {err ? (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {err}
        </div>
      ) : null}

      {/* Datos personales */}
      <section className="p-4 border-b last:border-b-0">
        <h2 className="text-base font-semibold mb-3">Datos personales</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Nombre</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Apellido</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              placeholder="Apellido"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Teléfono</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+54 9 ..."
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onSaveProfile}
            disabled={savingProfile || !canSaveProfile}
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-60"
          >
            {savingProfile ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </section>

      {/* Email actual + cambio de email */}
      <section className="p-4 border-b last:border-b-0">
        <h2 className="text-base font-semibold mb-1">Email de acceso</h2>
        <p className="text-xs text-gray-500 mb-3">
          Email actual: <strong>{email || "—"}</strong>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Nuevo email</label>
            <input
              type="email"
              className="w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nuevo@correo.com"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Confirmar nuevo email</label>
            <input
              type="email"
              className="w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              value={confirmNewEmail}
              onChange={(e) => setConfirmNewEmail(e.target.value)}
              placeholder="nuevo@correo.com"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onSaveEmail}
            disabled={savingEmail || !canSaveEmail}
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-60"
            title="Envía un correo de verificación/cambio (flow controlado por el endpoint)."
          >
            {savingEmail ? "Enviando…" : "Cambiar email"}
          </button>
        </div>
      </section>

      {/* Cambio de contraseña */}
      <section className="p-4 border-b last:border-b-0">
        <h2 className="text-base font-semibold mb-3">Cambiar contraseña</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Nueva contraseña</label>
            <input
              type="password"
              className="w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Confirmar nueva contraseña</label>
            <input
              type="password"
              className="w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              value={confirmNewPass}
              onChange={(e) => setConfirmNewPass(e.target.value)}
              placeholder="Repetir contraseña"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onSavePassword}
            disabled={savingPass || !canSavePass}
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-60"
          >
            {savingPass ? "Actualizando…" : "Actualizar contraseña"}
          </button>
        </div>
      </section>

      {/* Foto de perfil */}
      <section className="p-4">
        <h2 className="text-base font-semibold mb-3">Foto de perfil</h2>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gray-100 overflow-hidden border">
            {avatarPreview ? (
              // preview local
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                Sin foto
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setAvatarFile(f);
                if (f) {
                  const url = URL.createObjectURL(f);
                  setAvatarPreview(url);
                } else {
                  setAvatarPreview(null);
                }
              }}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={onSaveAvatar}
                disabled={savingAvatar || !avatarFile}
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-60"
              >
                {savingAvatar ? "Subiendo…" : "Actualizar foto"}
              </button>
              {avatarPreview ? (
                <button
                  className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800"
                  onClick={() => {
                    setAvatarFile(null);
                    setAvatarPreview(null);
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
            <p className="text-xs text-gray-500">
              Formatos recomendados JPG/PNG, peso &lt; 2MB. El endpoint guardará en Storage y actualizará tu perfil.
            </p>
          </div>
        </div>
      </section>

      {/* Nota para root */}
      {initial.isRoot ? (
        <div className="px-4 pb-4 text-xs text-gray-500">
          Como <strong>super_admin_root</strong> también vas a poder administrar otros Administradores (crear, resetear password y cambiar email) desde el módulo “Usuarios Admin”. 
        </div>
      ) : null}
    </div>
  );
}
