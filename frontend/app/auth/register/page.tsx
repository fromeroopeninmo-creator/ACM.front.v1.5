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
  const [cuit, setCuit] = useState("");

  // UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 📧 Validar formato de email
  const validarEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // 🔢 Validar CUIT
  const validarCuit = (cuit: string) =>
    /^[0-9]{2}-[0-9]{8}-[0-9]$/.test(cuit.trim());

  const handleRegister = async (e: React.FormEvent) => {
  e.preventDefault();
  setErrorMsg(null);
  setInfoMsg(null);

  const clean = (val: string) => val.trim();

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
    !condicionFiscal ||
    !cuit
  ) {
    setErrorMsg("Por favor, completá todos los campos obligatorios.");
    return;
  }

  setLoading(true);

  try {
    // 1️⃣ Crear usuario
    const { data, error } = await supabase.auth.signUp({
      email: clean(email),
      password: clean(password),
      options: {
        data: {
          nombre: clean(nombre),
          apellido: clean(apellido),
          telefono: clean(telefono),
          direccion: clean(direccion),
          localidad: clean(localidad),
          provincia: clean(provincia),
          razon_social: clean(razonSocial),
          inmobiliaria: clean(inmobiliaria),
          condicion_fiscal: clean(condicionFiscal),
          cuit: clean(cuit),
          role: "empresa",
        },
      },
    });

    if (error) {
      console.error("❌ Error en supabase.auth.signUp:", error);
      setErrorMsg(`Error en registro de usuario: ${error.message}`);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setInfoMsg(
        "Registro exitoso. Revisá tu email para confirmar la cuenta."
      );
      return;
    }

    // 2️⃣ Insertar empresa
    const { error: empresaError } = await supabase.from("empresas").insert([
      {
        user_id: userId,
        nombre_comercial: clean(inmobiliaria),
        razon_social: clean(razonSocial),
        cuit: clean(cuit),
        matriculado: `${clean(nombre)} ${clean(apellido)}`,
        telefono: clean(telefono),
        direccion: clean(direccion),
        localidad: clean(localidad),
        provincia: clean(provincia),
        condicion_fiscal: clean(condicionFiscal),
        color: "#E6A930",
        logo_url: "",
      },
    ]);

    if (empresaError) {
      console.error("❌ Error insertando empresa:", empresaError);
      setErrorMsg(`Error creando empresa: ${empresaError.message}`);
      return;
    }

    setInfoMsg(
      "Registro exitoso. Revisá tu email para confirmar la cuenta e iniciá sesión."
    );
    router.push("/dashboard/empresa");
  } catch (err: any) {
    console.error("🔥 Error inesperado en registro:", err);
    setErrorMsg(`Error inesperado: ${err.message || "Desconocido"}`);
  } finally {
    setLoading(false);
  }
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
        {/* 🧍 Datos personales */}
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
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              style={{ ...inputStyle, paddingRight: 40 }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                color: "#555",
              }}
            >
              {showPassword ? "Ocultar" : "Ver"}
            </button>
          </div>
        </div>

        {/* 🏢 Datos empresa */}
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

        <div>
          <label style={labelStyle}>CUIT *</label>
          <input
            type="text"
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            placeholder="00-00000000-0"
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
