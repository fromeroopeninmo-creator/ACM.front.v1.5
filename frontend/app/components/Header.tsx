"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "#lib/supabaseClient";

interface Profile {
  id: string;
  email: string;
  nombre?: string;
  apellido?: string;
  telefono?: string;
  direccion?: string;
  localidad?: string;
  provincia?: string;
  matriculado_nombre?: string;
  cpi?: string;
  inmobiliaria?: string;
}

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const loadUserProfile = async (supabaseUser: any): Promise<Profile | null> => {
    if (!supabaseUser) return null;

    // 1) Intentar traer desde la tabla "profiles"
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "id, email, nombre, apellido, telefono, direccion, localidad, provincia, matriculado_nombre, cpi, inmobiliaria"
      )
      .eq("id", supabaseUser.id)
      .single();

    if (profile) {
      return { ...profile };
    }

    // 2) Fallback: si no existe fila en "profiles", usar user_metadata
    const meta = (supabaseUser.user_metadata ?? {}) as Record<string, any>;

    const fallback: Profile = {
      id: supabaseUser.id,
      email: supabaseUser.email,
      nombre: meta.nombre,
      apellido: meta.apellido,
      telefono: meta.telefono,
      direccion: meta.direccion,
      localidad: meta.localidad,
      provincia: meta.provincia,
      // Si el registro guardó "matriculado", lo mapeamos a "matriculado_nombre"
      matriculado_nombre: meta.matriculado_nombre ?? meta.matriculado,
      cpi: meta.cpi,
      inmobiliaria: meta.inmobiliaria,
    };

    return fallback;
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const sessionUser = session?.user ?? null;
      const profile = sessionUser ? await loadUserProfile(sessionUser) : null;
      setUser(profile);
      setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setLoading(true);
      const sessionUser = session?.user ?? null;
      const profile = sessionUser ? await loadUserProfile(sessionUser) : null;
      setUser(profile);
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext) as AuthContextType;
