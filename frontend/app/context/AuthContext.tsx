"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Profile {
  id: string;
  email: string;
  nombre?: string;
  matriculado?: string;
  cpi?: string;
  profileId?: string;
}

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserProfile = async (supabaseUser: any) => {
    if (!supabaseUser) return null;

    // Buscar datos en la tabla profiles
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, nombre, matriculado, cpi")
      .eq("id", supabaseUser.id)
      .single();

    if (error) {
      console.error("Error cargando perfil:", error.message);
      return {
        id: supabaseUser.id,
        email: supabaseUser.email,
      };
    }

    // ✅ acá estaba el problema: el return no estaba cerrado
    return {
      id: supabaseUser.id, // id real de auth
      email: supabaseUser.email,
      profileId: profile?.id, // renombramos para no duplicar id
      ...profile,
    };
  };

  useEffect(() => {
    // Cargar sesión inicial
    supabase.auth.getSession().then(async ({ data }) => {
      const sessionUser = data.session?.user ?? null;
      const profile = sessionUser ? await loadUserProfile(sessionUser) : null;
      setUser(profile);
      setLoading(false);
    });

    // Escuchar cambios de sesión
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user ?? null;
      const profile = sessionUser ? await loadUserProfile(sessionUser) : null;
      setUser(profile);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
