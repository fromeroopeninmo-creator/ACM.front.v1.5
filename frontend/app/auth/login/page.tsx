"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    // ✅ Redirige al área protegida
    router.push("/");
  };

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Bienvenido a VAI – Ingresa tus credenciales"
    >
      {errorMsg && (
        <div
          style={alertError}
          className="text-center text-sm sm:text-base break-words"
        >
          {errorMsg}
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

        {/* 🔗 Registro */}
        <p
          style={{ fontSize: 14, textAlign: "center", marginTop: 6 }}
          className="text-gray-600 text-xs sm:text-sm mt-2"
        >
          ¿No tienes cuenta?{" "}
          <a
            href="/auth/register"
            className="text-sky-600 font-semibold hover:underline"
          >
            Regístrate aquí
          </a>
        </p>
      </form>
    </AuthLayout>
  );
}

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
