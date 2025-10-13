"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
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

  // 🧩 Manejo de login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg("Error al iniciar sesión. Verifica tus credenciales.");
      return;
    }

    if (!data?.user) {
      setErrorMsg("No se pudo iniciar sesión. Intenta nuevamente.");
      return;
    }

    // 🔍 Detectar el rol desde los metadatos
    const role = data.user.user_metadata?.role || "empresa";

    const roleDashboard: Record<string, string> = {
      super_admin_root: "/dashboard/admin",
      super_admin: "/dashboard/admin",
      soporte: "/dashboard/soporte",
      empresa: "/dashboard/empresa",
      asesor: "/dashboard/asesor",
    };

    // 🚀 Redirigir al dashboard correspondiente
    const destino = roleDashboard[role] || "/dashboard/empresa";
    router.push(destino);
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
