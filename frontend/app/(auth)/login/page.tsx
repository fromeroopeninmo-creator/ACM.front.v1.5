"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import AuthLayout from "@/ (auth)/components/AuthLayout";  // ojo, confirmame si está en app/(auth)/components

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Si ya hay sesión activa → redirigir al panel
  if (!loading && user) {
    router.push("/");
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-600">Redirigiendo al panel...</p>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);

    if (error) {
      setErrorMsg(error.message);
    } else {
      router.push("/"); // onAuthStateChange actualiza el contexto
    }
  };

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Bienvenido a ACM – Ingresa tus credenciales"
    >
      {errorMsg && <div style={alertError}>{errorMsg}</div>}

      <form onSubmit={handleLogin} style={{ display: "grid", gap: "12px" }}>
        <div>
          <label style={labelStyle}>Correo</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            placeholder="tu@email.com"
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            required
            style={inputStyle}
          />
        </div>

        <button type="submit" disabled={submitting} style={buttonStyle}>
          {submitting ? "Ingresando..." : "Ingresar"}
        </button>

        <p style={{ fontSize: 14, textAlign: "center", marginTop: 6 }}>
          ¿No tienes cuenta? <a href="/auth/register">Regístrate aquí</a>
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
