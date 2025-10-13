"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "#lib/supabaseClient";
import AuthLayout from "@/auth/components/AuthLayout";

// 📍 Provincias argentinas
const provincias = [
  "Buenos Aires",
  "Ciudad Autónoma de Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

// 💰 Condiciones fiscales
const condicionesFiscales = [
  "Consumidor Final (Exento)",
  "Monotributista",
  "Responsable Inscripto",
];

export default function RegisterPage() {
  const router = useRouter();

  // Campos del formulario
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [provincia, setProvincia] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [inmobiliaria, setInmobiliaria] = useState("");
  const [condicionFiscal, setCondicionFiscal] = useState("");

  // UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 📧 Validar formato de email
  const validarEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    // ✅ Validaciones básicas
    if (
      !nombre ||
      !apellido ||
      !email ||
      !password ||
      !telefono ||
      !direccion ||
      !localidad ||
      !provincia ||
      !razonSocial ||
      !inmobiliaria ||
      !condicionFiscal
    ) {
      setErrorMsg("Por favor, completá todos los campos obligatorios.");
      return;
    }

    if (!validarEmail(email)) {
      setErrorMsg("Ingresá un email válido.");
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
          razon_social: razonSocial,
          inmobiliaria,
          condicion_fiscal: condicionFiscal,
          role: "empresa", // 👈 se asigna directamente
        },
      },
    });

    setLoading(false);

    if (error) {
      console.error("Error en registro:", error);
      setErrorMsg(error.message);
      return;
    }

    if (!data.session) {
      setInfoMsg(
        "Registro exitoso. Revisá tu email para confirmar la cuenta y luego iniciá sesión."
      );
      return;
    }

    router.push("/dashboard/empresa");
  };

  return (
    <AuthLayout
      title="Registro de Empresa"
      subtitle="Completá tus datos para crear la cuenta de tu inmobiliaria"
    >
      {errorMsg && <div style={alertError}>{errorMsg}</div>}
      {infoMsg && <div style={alertInfo}>{infoMsg}</div>}

      <form
        onSubmit={handleRegister}
        style={{ display: "grid", gap: "12px" }}
        className="w-full text-sm sm:text-base"
      >
        {/* 🧍 Datos del responsable */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Nombre *</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>Apellido *</label>
            <input
              type="text"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              style={inputStyle}
              required
            />
          </div>
        </div>

        {/* 📧 Email */}
        <div>
          <label style={labelStyle}>Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            style={inputStyle}
            required
          />
        </div>

        {/* 🔒 Contraseña */}
        <div>
          <label style={labelStyle}>Contraseña *</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            style={inputStyle}
            required
          />
        </div>

        {/* 🏢 Empresa */}
        <div>
          <label style={labelStyle}>Razón Social *</label>
          <input
            type="text"
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
            style={inputStyle}
            required
          />
        </div>

        <div>
          <label style={labelStyle}>Nombre Comercial / Inmobiliaria *</label>
          <input
            type="text"
            value={inmobiliaria}
            onChange={(e) => setInmobiliaria(e.target.value)}
            style={inputStyle}
            required
          />
        </div>

        {/* 📞 Contacto */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Teléfono *</label>
            <input
              type="text"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>Dirección *</label>
            <input
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              style={inputStyle}
              required
            />
          </div>
        </div>

        {/* 📍 Ubicación */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Localidad *</label>
            <input
              type="text"
              value={localidad}
              onChange={(e) => setLocalidad(e.target.value)}
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>Provincia *</label>
            <select
              value={provincia}
              onChange={(e) => setProvincia(e.target.value)}
              style={inputStyle}
              required
            >
              <option value="">Seleccionar...</option>
              {provincias.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 💼 Condición fiscal */}
        <div>
          <label style={labelStyle}>Condición Fiscal *</label>
          <select
            value={condicionFiscal}
            onChange={(e) => setCondicionFiscal(e.target.value)}
            style={inputStyle}
            required
          >
            <option value="">Seleccionar...</option>
            {condicionesFiscales.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* 🔘 Botón */}
        <button
          type="submit"
          disabled={loading}
          style={buttonStyle}
          className="hover:opacity-90 transition-all disabled:opacity-50"
        >
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>

        <p style={{ fontSize: 14, textAlign: "center", marginTop: 6 }}>
          ¿Ya tenés cuenta?{" "}
          <a
            href="/auth/login"
            className="text-sky-600 font-semibold hover:underline"
          >
            Ingresá acá
          </a>
        </p>
      </form>
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
const alertInfo: React.CSSProperties = {
  background: "#e6f4ff",
  border: "1px solid #b3ddff",
  color: "#084c8d",
  padding: "8px 10px",
  borderRadius: 6,
  fontSize: 14,
};
