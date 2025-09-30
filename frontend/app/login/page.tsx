"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [matriculado, setMatriculado] = useState("");
  const [cpi, setCpi] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (isRegister) {
      // Registro
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // Crear perfil en la tabla profiles
      const userId = data.user?.id;
      if (userId) {
        const { error: profileError } = await supabase.from("profiles").insert([
          { id: userId, matriculado, cpi },
        ]);

        if (profileError) {
          setError(profileError.message);
        } else {
          router.push("/");
        }
      }
    } else {
      // Login
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        setError(loginError.message);
      } else {
        router.push("/");
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-center">
          {isRegister ? "Registro" : "Login"}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full border px-3 py-2 rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            className="w-full border px-3 py-2 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {isRegister && (
            <>
              <input
                type="text"
                placeholder="Nombre Matriculado/a"
                className="w-full border px-3 py-2 rounded"
                value={matriculado}
                onChange={(e) => setMatriculado(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="CPI"
                className="w-full border px-3 py-2 rounded"
                value={cpi}
                onChange={(e) => setCpi(e.target.value)}
                required
              />
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
          >
            {loading
              ? "Cargando..."
              : isRegister
              ? "Registrarse"
              : "Iniciar Sesión"}
          </button>
        </form>
        {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}

        <p
          className="text-sm text-center mt-4 cursor-pointer text-blue-600"
          onClick={() => setIsRegister(!isRegister)}
        >
          {isRegister
            ? "¿Ya tienes cuenta? Inicia sesión"
            : "¿No tienes cuenta? Regístrate"}
        </p>
      </div>
    </div>
  );
}
