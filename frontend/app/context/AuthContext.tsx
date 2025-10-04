"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "#lib/supabaseClient";

interface Profile {
  id: string;
  email: string;
  nombre?: string;
  apellido?: string;
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

  // 🔐 Logout seguro
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
   window.location.replace("/auth/login");
  };

  const loadUserProfile = async (supabaseUser: any): Promise<Profile | null> => {
    if (!supabaseUser) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, nombre, apellido, matriculado_nombre, cpi, inmobiliaria")
      .eq("id", supabaseUser.id)
      .single();

    return profile || {
      id: supabaseUser.id,
      email: supabaseUser.email,
      nombre: supabaseUser.user_metadata?.nombre,
      apellido: supabaseUser.user_metadata?.apellido,
      matriculado_nombre: supabaseUser.user_metadata?.matriculado_nombre,
      cpi: supabaseUser.user_metadata?.cpi,
      inmobiliaria: supabaseUser.user_metadata?.inmobiliaria,
    };
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
      } else {
        loadUserProfile(session.user).then(setUser);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
};
