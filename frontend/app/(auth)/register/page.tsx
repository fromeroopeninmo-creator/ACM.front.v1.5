// app/(auth)/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function RegisterPage() {
  const router = useRouter();

  // Campos del formulario
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [provincia, setProvincia] = useState("");
  const [matriculado, setMatriculado] = useState("");
  const [cpi, setCpi] = useState("");

  // UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!email || !password || !nombre || !apellido) {
      setErrorMsg("Completá al menos Nombre, Apellido, Email y Contraseña.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    // Registramos al usuario y guardamos los datos en user_metadata.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
          apellido,
          telefono,
          direccion,
          localidad,
          provincia,
          matriculado,
          cpi,
        },
      },
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    // Si el proyecto tiene verificación por email, no hay sesión automática
    if (!data.session) {
      setInfoMsg(
        "Registro exitoso. Revisá tu email para confirmar la cuenta y luego iniciá sesión."
      );
      return;
    }

    // Si no hay verificación y entra directo con sesión:
    router.push("/");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Columna izquierda: banner */}
      <div
        style={{
          flex: 1,
          backgroundImage: "url('/banner.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Columna derecha: formulario */}
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
          onSubmit={handleRegister}
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
              Crear cuenta
            </h1>
            <p style={{ margin: "6px 0 0 0", color: "#555" }}>
              Bienvenido a ACM – Registrate para continuar
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

          {infoMsg && (
            <div
              style={{
                background: "#e6f4ff",
                border: "1px solid #b3ddff",
                color: "#084c8d",
                padding: "8px 10px",
                borderRadius: 6,
                fontSize: 14,
              }}
            >
              {infoMsg}
            </div>
          )}

          {/* Datos personales */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Apellido</label>
              <input
                type="text"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                placeholder="Apellido"
                required
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Email</label>
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
              placeholder="Mínimo 6 caracteres"
              required
              style={inputStyle}
            />
          </div>

          {/* Datos de contacto */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Teléfono</label>
            <input
              type="text"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Teléfono"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Dirección</label>
            <input
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Calle y número"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Localidad</label>
              <input
                type="text"
                value={localidad}
                onChange={(e) => setLocalidad(e.target.value)}
                placeholder="Localidad"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Provincia</label>
              <input
                type="text"
                value={provincia}
                onChange={(e) => setProvincia(e.target.value)}
                placeholder="Provincia"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Datos del matriculado */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              Nombre del Matriculado/a
            </label>
            <input
              type="text"
              value={matriculado}
              onChange={(e) => setMatriculado(e.target.value)}
              placeholder="Nombre completo del matriculado/a"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>CPI</label>
            <input
              type="text"
              value={cpi}
              onChange={(e) => setCpi(e.target.value)}
              placeholder="Matrícula / CPI"
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
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>

          <p style={{ fontSize: 14, textAlign: "center", marginTop: 6 }}>
            ¿Ya tenés cuenta? <a href="/login">Ingresá acá</a>
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
