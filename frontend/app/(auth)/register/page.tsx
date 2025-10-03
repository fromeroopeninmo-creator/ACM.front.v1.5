"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AuthLayout from "../components/AuthLayout";

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
  const [inmobiliaria, setInmobiliaria] = useState("");

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
          inmobiliaria, // 👈 se guarda en user_metadata
        },
      },
    });
    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    if (!data.session) {
      setInfoMsg(
        "Registro exitoso. Revisá tu email para confirmar la cuenta y luego iniciá sesión."
      );
      return;
    }

    router.push("/");
  };

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Bienvenido a VMI – Registrate para continuar"
    >
      {errorMsg && <div style={alertError}>{errorMsg}</div>}
      {infoMsg && <div style={alertInfo}>{infoMsg}</div>}

      <form onSubmit={handleRegister} style={{ display: "grid", gap: "12px" }}>
        {/* Datos personales */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>Nombre</label>
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
            <label style={labelStyle}>Apellido</label>
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
          <label style={labelStyle}>Email</label>
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
            placeholder="Mínimo 6 caracteres"
            required
            style={inputStyle}
          />
        </div>

        {/* Datos de contacto */}
        <div>
          <label style={labelStyle}>Teléfono</label>
          <input
            type="text"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="Teléfono"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Dirección</label>
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
            <label style={labelStyle}>Localidad</label>
            <input
              type="text"
              value={localidad}
              onChange={(e) => setLocalidad(e.target.value)}
              placeholder="Localidad"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Provincia</label>
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
          <label style={labelStyle}>Nombre del Matriculado/a</label>
          <input
            type="text"
            value={matriculado}
            onChange={(e) => setMatriculado(e.target.value)}
            placeholder="Nombre completo del matriculado/a"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>CPI</label>
          <input
            type="text"
            value={cpi}
            onChange={(e) => setCpi(e.target.value)}
            placeholder="Matrícula / CPI"
            style={inputStyle}
          />
        </div>

        {/* Inmobiliaria */}
        <div>
          <label style={labelStyle}>Inmobiliaria</label>
          <input
            type="text"
            value={inmobiliaria}
            onChange={(e) => setInmobiliaria(e.target.value)}
            placeholder="Nombre de la inmobiliaria"
            style={inputStyle}
          />
        </div>

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>

        <p style={{ fontSize: 14, textAlign: "center", marginTop: 6 }}>
          ¿Ya tenés cuenta? <a href="/auth/login">Ingresá acá</a>
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
const alertInfo: React.CSSProperties = {
  background: "#e6f4ff",
  border: "1px solid #b3ddff",
  color: "#084c8d",
  padding: "8px 10px",
  borderRadius: 6,
  fontSize: 14,
};
