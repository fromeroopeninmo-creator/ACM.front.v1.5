"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "#lib/supabaseClient";
import AuthLayout from "@/auth/components/AuthLayout";

export default function RegisterPage() {
  const router = useRouter();

  // Campos del formulario
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [cuit, setCuit] = useState("");
  const [condicionFiscal, setCondicionFiscal] = useState("");
  const [provincia, setProvincia] = useState("");
  const [localidad, setLocalidad] = useState("");
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

    if (!email || !password || !razonSocial || !cuit) {
      setErrorMsg("Completá todos los campos obligatorios.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    // 1️⃣ Crear usuario en Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { razonSocial, cuit, condicionFiscal, provincia, localidad },
      },
    });

    if (signUpError || !signUpData.user) {
      setErrorMsg(signUpError?.message || "Error al registrar usuario.");
      setLoading(false);
      return;
    }

    const userId = signUpData.user.id;

    // 2️⃣ Crear empresa
    const { data: empresa, error: empresaError } = await supabase
      .from("empresas")
      .insert([
        {
          user_id: userId,
          razon_social: razonSocial,
          cuit,
          condicion_fiscal: condicionFiscal,
          provincia,
          localidad,
          cpi,
          matriculado_nombre: matriculado,
          logo_url: null,
          color: "#2563eb", // por defecto
        },
      ])
      .select("id")
      .single();

    if (empresaError || !empresa) {
      setErrorMsg("Error al crear la empresa.");
      setLoading(false);
      return;
    }

    // 3️⃣ Asignar plan Trial de 7 días
    const trialDuration = 7;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + trialDuration);

    await supabase.from("empresas_planes").insert([
      {
        empresa_id: empresa.id,
        plan_id: "1", // ← ID del plan Trial (ajustar según DB)
        fecha_inicio: startDate.toISOString(),
        fecha_fin: endDate.toISOString(),
        activo: true,
      },
    ]);

    // 4️⃣ Crear perfil vinculado
    await supabase.from("profiles").insert([
      {
        id: userId,
        email,
        role: "empresa",
        empresa_id: empresa.id,
      },
    ]);

    setLoading(false);
    setInfoMsg("Cuenta creada correctamente. Redirigiendo al panel...");
    setTimeout(() => router.replace("/dashboard/empresa"), 1500);
  };

  return (
    <AuthLayout
      title="Registro de Empresa"
      subtitle="Completá los datos para comenzar tu prueba gratuita de 7 días"
    >
      {errorMsg && <div style={alertError}>{errorMsg}</div>}
      {infoMsg && <div style={alertInfo}>{infoMsg}</div>}

      <form
        onSubmit={handleRegister}
        style={{ display: "grid", gap: "12px" }}
        className="w-full text-sm sm:text-base"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
          placeholder="Email *"
          required
          style={inputStyle}
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña *"
          required
          style={inputStyle}
        />

        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirmar contraseña *"
          required
          style={inputStyle}
        />

        <input
          type="text"
          value={razonSocial}
          onChange={(e) => setRazonSocial(e.target.value)}
          placeholder="Razón Social *"
          required
          style={inputStyle}
        />

        <input
          type="text"
          value={cuit}
          onChange={(e) => setCuit(e.target.value)}
          placeholder="CUIT *"
          required
          style={inputStyle}
        />

        <input
          type="text"
          value={condicionFiscal}
          onChange={(e) => setCondicionFiscal(e.target.value)}
          placeholder="Condición fiscal"
          style={inputStyle}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={provincia}
            onChange={(e) => setProvincia(e.target.value)}
            placeholder="Provincia"
            style={inputStyle}
          />
          <input
            type="text"
            value={localidad}
            onChange={(e) => setLocalidad(e.target.value)}
            placeholder="Localidad"
            style={inputStyle}
          />
        </div>

        <input
          type="text"
          value={matriculado}
          onChange={(e) => setMatriculado(e.target.value)}
          placeholder="Nombre del matriculado (opcional)"
          style={inputStyle}
        />

        <input
          type="text"
          value={cpi}
          onChange={(e) => setCpi(e.target.value)}
          placeholder="CPI / Matrícula (opcional)"
          style={inputStyle}
        />

        <button
          type="submit"
          disabled={loading}
          style={buttonStyle}
          className="w-full hover:opacity-90 transition-all disabled:opacity-50"
        >
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>

        <p
          style={{ fontSize: 14, textAlign: "center", marginTop: 6 }}
          className="text-gray-600 text-xs sm:text-sm mt-2"
        >
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

/* 🎨 Estilos (mantengo los tuyos) */
const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 42,
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  padding: "0 12px",
  outline: "none",
};
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
