"use client";

import { useState } from "react";

export default function PasswordResetAdminButton({ email }: { email: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendReset() {
    if (!window.confirm(`¿Enviar enlace de restablecimiento a ${email}?`)) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/soporte/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "No se pudo enviar el enlace.");
      setMessage("Enlace enviado correctamente.");
    } catch (e: any) {
      setError(e?.message || "No se pudo enviar el enlace.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={sendReset}
        disabled={loading}
        className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-neutral-800"
      >
        {loading ? "Enviando..." : "Enviar restablecimiento de contraseña"}
      </button>
      {message ? <p className="text-xs text-emerald-600">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
