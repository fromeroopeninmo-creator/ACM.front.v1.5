// app/(auth)/register/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    email: "",
    password: "",
    telefono: "",
    direccion: "",
    localidad: "",
    provincia: "",
    matriculado: "",
    cpi: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            nombre: formData.nombre,
            apellido: formData.apellido,
            telefono: formData.telefono,
            direccion: formData.direccion,
            localidad: formData.localidad,
            provincia: formData.provincia,
            matriculado: formData.matriculado,
            cpi: formData.cpi,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      alert("Registro exitoso. Revisa tu correo para confirmar tu cuenta.");
      router.push("/login");
    } catch (err: any) {
      setError("Error en el registro: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Banner a la izquierda */}
      <div className="w-1/2 bg-gray-200 flex items-center justify-center">
        <img src="/banner-login.jpg" alt="Banner ACM" className="max-h-full object-cover" />
      </div>

      {/* Formulario a la derecha */}
      <div className="w-1/2 flex items-center justify-center p-10">
        <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-center">Registro de Usuario</h1>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <input type="text" name="nombre" placeholder="Nombre" value={formData.nombre} onChange={handleChange} className="w-full p-2 border rounded mb-3" required />
          <input type="text" name="apellido" placeholder="Apellido" value={formData.apellido} onChange={handleChange} className="w-full p-2 border rounded mb-3" required />
          <input type="email" name="email" placeholder="Correo electrónico" value={formData.email} onChange={handleChange} className="w-full p-2 border rounded mb-3" required />
          <input type="password" name="password" placeholder="Contraseña" value={formData.password} onChange={handleChange} className="w-full p-2 border rounded mb-3" required />

          <input type="text" name="telefono" placeholder="Teléfono" value={formData.telefono} onChange={handleChange} className="w-full p-2 border rounded mb-3" />
          <input type="text" name="direccion" placeholder="Dirección" value={formData.direccion} onChange={handleChange} className="w-full p-2 border rounded mb-3" />
          <input type="text" name="localidad" placeholder="Localidad" value={formData.localidad} onChange={handleChange} className="w-full p-2 border rounded mb-3" />
          <input type="text" name="provincia" placeholder="Provincia" value={formData.provincia} onChange={handleChange} className="w-full p-2 border rounded mb-3" />

          <input type="text" name="matriculado" placeholder="Nombre del Matriculado/a" value={formData.matriculado} onChange={handleChange} className="w-full p-2 border rounded mb-3" />
          <input type="text" name="cpi" placeholder="CPI" value={formData.cpi} onChange={handleChange} className="w-full p-2 border rounded mb-6" />

          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
            {loading ? "Registrando..." : "Registrarse"}
          </button>

          <p className="mt-4 text-sm text-center">
            ¿Ya tienes cuenta?{" "}
            <a href="/login" className="text-blue-600 hover:underline">
              Inicia sesión aquí
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
