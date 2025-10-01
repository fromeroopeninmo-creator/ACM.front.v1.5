"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Header() {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const getProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("nombre, apellido, nombre_matriculado, cpi")
          .eq("id", user.id)
          .single();

        if (!error && data) {
          setProfile(data);
        }
      }
    };

    getProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <header className="w-full bg-blue-600 text-white flex justify-between items-center px-6 py-4 shadow-md">
      {/* Izquierda: matriculado y cpi */}
      <div>
        {profile ? (
          <div>
            <p className="font-bold">{profile.nombre_matriculado}</p>
            <p className="text-sm">CPI: {profile.cpi}</p>
          </div>
        ) : (
          <p className="font-semibold">ACM</p>
        )}
      </div>

      {/* Derecha: bienvenida + logout */}
      <div className="flex items-center gap-4">
        {profile && (
          <span>
            Bienvenido/a:{" "}
            <strong>
              {profile.nombre} {profile.apellido}
            </strong>
          </span>
        )}
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded-md text-sm"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
