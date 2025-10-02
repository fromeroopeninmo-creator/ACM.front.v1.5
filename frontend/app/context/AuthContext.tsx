"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<Profile | null>(null);

  const loadUserProfile = async (supabaseUser: any) => {
    if (!supabaseUser) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, nombre, apellido, matriculado_nombre, cpi, inmobiliaria")
      .eq("id", supabaseUser.id)
      .single();

    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      ...profile,
    };
  };

  // Al iniciar, pedimos la sesión
  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const profile = session?.user ? await loadUserProfile(session.user) : null;
      setUser(profile);
    };

    init();

    // Escuchar cambios de sesión
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const profile = session?.user ? await loadUserProfile(session.user) : null;
        setUser(profile);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext) as AuthContextType;
