"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "#lib/supabaseClient";
import AuthLayout from "@/auth/components/AuthLayout";

export default function LoginPage() {
  const router = useRouter();

  // Campos del formulario
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Estado para reenvío de verificación
  const [canResend, setCanResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  // Modal: forgot password
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  // 🚀 Redirección automática si ya está logueado
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const role = session.user.user_metadata?.role || "empresa";
        const roleDashboard: Record<string, string> = {
          super_admin_root: "/dashboard/admin",
          super_admin: "/dashboard/admin",
          soporte: "/dashboard/soporte",
          empresa: "/dashboard/empresa",
          asesor: "/dashboard/asesor",
        };

        router.replace(roleDashboard[role] || "/dashboard/empresa");
      }
    };

    checkSession();
  }, [router]);

  // Mensaje guía cuando falta confirmar
  const unconfirmedHelp = useMemo(
    () =>
      "Tu email aún no está confirmado. Revisá tu bandeja de entrada (y spam). Si no lo recibiste, reenvialo desde el botón de abajo.",
    []
  );

  // 🧩 Manejo de login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResendMsg(null);
    setCanResend(false);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      const msg = (error.message || "").toLowerCase();
      const code = (error as any).code || "";

      const looksUnconfirmed =
        code === "email_not_confirmed" ||
        msg.includes("confirm") ||
        msg.includes("not confirmed") ||
        msg.includes("email not confirmed") ||
        msg.includes("must be confirmed");

      if (looksUnconfirmed) {
        setErrorMsg(unconfirmedHelp);
        setCanResend(true);
      } else {
        setErrorMsg("Error al iniciar sesión. Verificá tus credenciales.");
      }
      return;
    }

    if (!data?.user) {
      setErrorMsg("No se pudo iniciar sesión. Intentá nuevamente.");
      return;
    }

    const role = data.user.user_metadata?.role || "empresa";
    const roleDashboard: Record<string, string> = {
      super_admin_root: "/dashboard/admin",
      super_admin: "/dashboard/admin",
      soporte: "/dashboard/soporte",
      empresa: "/dashboard/empresa",
      asesor: "/dashboard/asesor",
    };
    router.push(roleDashboard[role] || "/dashboard/empresa");
  };

  // 🔁 Reenviar correo de verificación
  const handleResend = async () => {
    setResendMsg(null);
    setResendLoading(true);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : undefined;

      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
        },
      });

      if (error) {
        setResendMsg(`No se pudo reenviar el correo: ${error.message}`);
      } else {
        setResendMsg("Te enviamos un nuevo correo de verificación. Revisá tu inbox.");
      }
    } catch (e: any) {
      setResendMsg(e?.message || "Error reenviando el correo.");
    } finally {
      setResendLoading(false);
    }
  };

  // 🔐 Forgot password (envía email)
  const handleSendReset = async () => {
    setResetMsg(null);
    setResetLoading(true);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(
        resetEmail.trim(),
        {
          redirectTo: origin ? `${origin}/auth/reset` : undefined,
        }
      );

      if (error) {
        setResetMsg(`No se pudo enviar el correo: ${error.message}`);
      } else {
        setResetMsg(
          "Te enviamos un correo con el enlace para restablecer tu contraseña."
        );
      }
    } catch (e: any) {
      setResetMsg(e?.message || "Error enviando el correo.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Bienvenido a VAI – Ingresá tus credenciales"
    >
      {errorMsg && (
        <div
          style={alertError}
          className="text-center text-sm sm:text-base break-words"
        >
          {errorMsg}
          {canResend && (
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading || !email}
                className="px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {resendLoading ? "Reenviando..." : "Reenviar correo de verificación"}
              </button>
              {resendMsg && (
                <div className="text-xs text-gray-700 bg-blue-50 border border-blue-200 p-2 rounded">
                  {resendMsg}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={handleLogin}
        style={{ display: "grid", gap: "12px" }}
        className="w-full text-sm sm:text-base"
      >
        {/* 📧 Campo correo */}
        <div>
          <label style={labelStyle} className="block mb-1">
            Correo
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            placeholder="tu@email.com"
            required
            style={inputStyle}
            className="focus:ring-2 focus:ring-sky-400 transition-all w-full"
          />
        </div>

        {/* 🔒 Campo contraseña */}
        <div>
          <label style={labelStyle} className="block mb-1">
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            required
            style={inputStyle}
            className="focus:ring-2 focus:ring-sky-400 transition-all w-full"
          />
        </div>

        {/* 🔘 Botón */}
        <button
          type="submit"
          disabled={loading}
          style={buttonStyle}
          className="w-full text-sm sm:text-base hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>

        {/* ➕ Acciones secundarias */}
        <div className="flex items-center justify-between text-xs sm:text-sm mt-2">
          <a
            href="/auth/register"
            className="text-sky-600 font-semibold hover:underline"
          >
            Registrate
          </a>

          <button
            type="button"
            onClick={() => {
              setResetEmail(email || "");
              setShowResetModal(true);
            }}
            className="text-sky-600 font-semibold hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </form>

      {/* Modal reset password */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/30 grid place-items-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-5 w-[92%] max-w-md">
            <h3 className="text-lg font-semibold mb-2">Restablecer contraseña</h3>
            <p className="text-sm text-gray-600 mb-3">
              Ingresá tu correo y te enviaremos un enlace para restablecer tu contraseña.
            </p>
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full border rounded-lg px-3 py-2 mb-3"
            />
            {resetMsg && (
              <div className="text-xs text-gray-700 bg-blue-50 border border-blue-200 p-2 rounded mb-3">
                {resetMsg}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                className="px-3 py-2 text-sm rounded bg-gray-100 hover:bg-gray-200"
                onClick={() => {
                  setShowResetModal(false);
                  setResetMsg(null);
                }}
              >
                Cancelar
              </button>
              <button
                className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={handleSendReset}
                disabled={resetLoading || !resetEmail}
              >
                {resetLoading ? "Enviando..." : "Enviar enlace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

/* 🎨 Estilos */
const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 42,
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  padding: "0 12px",
  outline: "none",
};

const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600 };

const buttonStyle: React.CSSProperties = {
  height: 42,
  borderRadius: 8,
  border: 0,
  background: "#111",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  marginTop: 6,
};

const alertError: React.CSSProperties = {
  background: "#ffe6e6",
  border: "1px solid #ffb3b3",
  color: "#b00020",
  padding: "8px 10px",
  borderRadius: 6,
  fontSize: 14,
};
