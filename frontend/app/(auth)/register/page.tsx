"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    nombre: "",
    apellido: "",
    nombre_matriculado: "",
    cpi: "",
    telefono: "",
    direccion: "",
    localidad: "",
    provincia: "",
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1️⃣ Registrar usuario en auth
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    // 2️⃣ Insertar datos extra en profiles
    const user = data.user;
    if (user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          nombre: form.nombre,
          apellido: form.apellido,
          nombre_matriculado: form.nombre_matriculado,
          cpi: form.cpi,
          telefono: form.telefono,
          direccion: form.direccion,
          localidad: form.localidad,
          provincia: form.provincia,
        })
        .eq("id", user.id);

      if (profileError) {
        setError(profileError.message);
        return;
      }
    }

    alert("Registro exitoso. Por favor confirma tu email.");
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <img
        src="/login-banner.jpg"
        alt="Banner"
        className="w-full max-h-48 object-cover mb-6"
      />

      <div className="w-full max-w-lg bg-white shadow-lg rounded-xl p-6">
        <h1 className="text-2xl font-bold text-center mb-6">
          Crea tu cuenta
        </h1>

        <form onSubmit={handleRegister} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input name="nombre" placeholder="Nombre" onChange={handleChange} required className="border rounded-md px-3 py-2" />
            <input name="apellido" placeholder="Apellido" onChange={handleChange} required className="border rounded-md px-3 py-2" />
          </div>
          <input name="nombre_matriculado" placeholder="Nombre del Matriculado/a" onChange={handleChange} className="w-full border rounded-md px-3 py-2" />
          <input name="cpi" placeholder="CPI" onChange={handleChange} className="w-full border rounded-md px-3 py-2" />
          <input name="telefono" placeholder="Teléfono" onChange={handleChange} className="w-full border rounded-md px-3 py-2" />
          <input name="direccion" placeholder="Dirección" onChange={handleChange} className="w-full border rounded-md px-3 py-2" />
          <div className="grid grid-cols-2 gap-3">
            <input name="localidad" placeholder="Localidad" onChange={handleChange} className="border rounded-md px-3 py-2" />
            <input name="provincia" placeholder="Provincia" onChange={handleChange} className="border rounded-md px-3 py-2" />
          </div>
          <input name="email" type="email" placeholder="Correo electrónico" onChange={handleChange} required className="w-full border rounded-md px-3 py-2" />
          <input name="password" type="password" placeholder="Contraseña" onChange={handleChange} required className="w-full border rounded-md px-3 py-2" />

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full bg-green-600 text-white rounded-md py-2 font-semibold hover:bg-green-700">
            Registrarse
          </button>
        </form>

        <p className="mt-4 text-sm text-center">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
