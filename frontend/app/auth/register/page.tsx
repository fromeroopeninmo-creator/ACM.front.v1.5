"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "#lib/supabaseClient";
import AuthLayout from "@/auth/components/AuthLayout";

export default function RegisterPage() {
  const router = useRouter();

  // Campos del formulario (versión corta)
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inmobiliaria, setInmobiliaria] = useState("");

  // UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // 🛡️ Evitar múltiples envíos mientras ya hay uno en curso
    if (loading) {
      return;
    }

    setErrorMsg(null);
    setInfoMsg(null);

    const clean = (val: string) => val.trim();

    // ✅ Primero, obligamos a aceptar TyC
    if (!acceptedTerms) {
      setErrorMsg(
        "Debés aceptar los Términos y Condiciones para continuar."
      );
      return;
    }

    // ✅ Validamos solo datos básicos
    if (!nombre || !apellido || !email || !password || !inmobiliaria) {
      setErrorMsg(
        "Completá los datos básicos marcados con * para crear tu cuenta."
      );
      return;
    }

    setLoading(true);

    try {
      // URL de redirect para el mail de confirmación
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: clean(email),
        password: clean(password),
        options: {
          emailRedirectTo: redirectTo,
          data: {
            nombre: clean(nombre),
            apellido: clean(apellido),
            inmobiliaria: clean(inmobiliaria),
            role: "empresa",
          },
        },
      });

      if (error) {
        let msg = error.message || "No se pudo registrar.";

        // Caso específico: límite de envío de emails de Supabase Auth
        if ((error as any)?.status === 429) {
          msg =
            "Estamos enviando demasiados correos seguidos. Esperá 1 minuto y volvé a intentar.";
        }

        // Mapear el caso clásico de email ya usado
        if (
          /email/i.test(error.message || "") &&
          /(exists|registered|taken|used)/i.test(error.message || "")
        ) {
          msg = "El email ya fue registrado.";
        }
        if (/User already registered/i.test(error.message || "")) {
          msg = "El email ya fue registrado.";
        }

        setErrorMsg(msg);
        return;
      }

      // Con confirmación de email activa, Supabase normalmente NO devuelve session
      // y simplemente envía el mail con el link a /auth/callback.
      if (!data.user) {
        setInfoMsg(
          "Registro exitoso. Revisá tu email para confirmar la cuenta."
        );
        return;
      }

      // Caso estándar con confirmación:
      setInfoMsg(
        "Registro exitoso. Revisá tu email para confirmar la cuenta."
      );
      return;
    } catch (e: any) {
      setErrorMsg(e?.message || "No se pudo registrar.");
      return;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Registro de Empresa"
      subtitle="Completá los datos básicos para crear la cuenta de tu inmobiliaria. Más adelante podrás cargar tus datos fiscales desde Configuración."
      variant="wide"
    >
      {errorMsg && <div style={alertError}>{errorMsg}</div>}
      {infoMsg && <div style={alertInfo}>{infoMsg}</div>}

      <form
        onSubmit={handleRegister}
        style={{ display: "grid", gap: "12px" }}
        className="w-full text-sm sm:text-base"
      >
        {/* 🧩 Campos en 2 columnas (desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* 🧍 Datos personales */}
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

          {/* 🏢 Nombre comercial */}
          <div>
            <label style={labelStyle}>
              Nombre Comercial de la inmobiliaria *
            </label>
            <input
              type="text"
              value={inmobiliaria}
              onChange={(e) => setInmobiliaria(e.target.value)}
              style={inputStyle}
              required
            />
          </div>
        </div>

        {/* ✅ Aceptación de Términos y Condiciones */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            fontSize: 13,
            marginTop: 4,
          }}
        >
          <input
            type="checkbox"
            id="acepto-tyc"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            style={{ marginTop: 3, cursor: "pointer" }}
          />
          <label htmlFor="acepto-tyc" style={{ cursor: "pointer" }}>
            Acepto los{" "}
            <a
              href="/landing/legales"
              target="_blank"
              className="text-sky-600 font-semibold hover:underline"
            >
              Términos y Condiciones
            </a>{" "}
            y la Política de Privacidad.
          </label>
        </div>

        {/* 🔘 Botón y link ocupan todo el ancho */}
        <button
          type="submit"
          disabled={loading || !acceptedTerms}
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
