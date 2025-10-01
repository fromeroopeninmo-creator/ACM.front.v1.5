"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    } else {
      router.push("/"); // Redirige al home protegido
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Columna izquierda con banner */}
      <div
        style={{
          flex: 1,
          backgroundImage: "url('/banner.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Columna derecha con login */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <form
          onSubmit={handleLogin}
          style={{
            width: "100%",
            maxWidth: 420,
            display: "grid",
            gap: "12px",
            background: "#fff",
            padding: "24px",
            borderRadius: 8,
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
              Iniciar sesión
            </h1>
            <p style={{ margin: "6px 0 0 0", color: "#555" }}>
              Bienvenido a ACM – Ingresa tus credenciales
            </p>
          </div>

          {errorMsg && (
            <div
              style={{
                background: "#ffe6e6",
                border: "1px solid #ffb3b3",
                color: "#b00020",
                padding: "8px 10px",
                borderRadius: 6,
                fontSize: 14,
              }}
            >
              {errorMsg}
            </div>
          )}

          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Correo</label>
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
            <label style={{ fontSize: 13, fontWeight: 600 }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              required
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              height: 42,
              borderRadius: 8,
              border: 0,
              background: "#111",
              color: "#fff",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: 6,
            }}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>

          <p style={{ fontSize: 14, textAlign: "center", marginTop: 6 }}>
            ¿No tienes cuenta? <a href="/register">Regístrate aquí</a>
          </p>
        </form>
      </div>
    </div>
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
