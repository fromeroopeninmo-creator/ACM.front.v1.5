"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [matriculado, setMatriculado] = useState("");
  const [cpi, setCpi] = useState("");
  const [message, setMessage] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Crea el usuario en Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const user = data.user;
    if (user) {
      // 2. Inserta datos en la tabla profiles
      const { error: insertError } = await supabase.from("profiles").insert([
        {
          id: user.id, // mismo UUID que auth.users
          matriculado,
          cpi,
        },
      ]);

      if (insertError) {
        setMessage(`Error insertando perfil: ${insertError.message}`);
        return;
      }

      setMessage("✅ Usuario registrado con éxito");
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "auto", padding: "20px" }}>
      <h2>Registro</h2>
      <form onSubmit={handleRegister}>
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <br />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <br />
        <input
          type="text"
          placeholder="Nombre matriculado/a"
          value={matriculado}
          onChange={(e) => setMatriculado(e.target.value)}
          required
        />
        <br />
        <input
          type="text"
          placeholder="CPI"
          value={cpi}
          onChange={(e) => setCpi(e.target.value)}
          required
        />
        <br />
        <button type="submit">Registrarse</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
