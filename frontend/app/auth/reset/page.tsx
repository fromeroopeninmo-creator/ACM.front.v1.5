"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "#lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const search = useSearchParams();

  const [stage, setStage] = useState<"checking" | "form" | "done" | "error">(
    "checking"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Intercambiamos el código por sesión (necesario con los links de Supabase)
  useEffect(() => {
    const doExchange = async () => {
      try {
        const fullUrl =
          typeof window !== "undefined" ? window.location.href : "";

        // Si es un link de recovery, exchangeCodeForSession setea la sesión
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          fullUrl
        );

        if (error) {
          // Si no hay code (porque ya se intercambió) no es fatal, probamos sesión
          const { data: s } = await supabase.auth.getSession();
          if (!s?.session) {
            setErrorMsg(error.message || "No se pudo validar el enlace.");
            setStage("error");
            return;
          }
        }

        setStage("form");
      } catch (e: any) {
        setErrorMsg(e?.message || "Error procesando el enlace.");
        setStage("error");
      }
    };

    doExchange();
  }, [search]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });
      if (error) {
        setErrorMsg(error.message);
        setSaving(false);
        return;
      }
      setStage("done");
      setTimeout(() => router.replace("/auth/login"), 1500);
    } catch (e: any) {
      setErrorMsg(e?.message || "Error actualizando la contraseña.");
      setSaving(false);
    }
  };

  if (stage === "checking") {
    return (
      <div className="min-h-[60vh] grid place-items-center text-gray-600">
        Validando enlace…
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Restablecer contraseña</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">
          {errorMsg || "No se pudo validar el enlace de restablecimiento."}
        </div>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Contraseña actualizada</h1>
        <p className="text-gray-700">
          Redirigiendo al inicio de sesión…
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-3">Elegí tu nueva contraseña</h1>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-3">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleChangePassword} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Nueva contraseña</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Mínimo 6 caracteres"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
    </div>
  );
}
