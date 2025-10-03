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

  const loadUserProfile = async (supabaseUser: any) => {
    if (!supabaseUser) return null;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "id, email, nombre, apellido, telefono, direccion, localidad, provincia, matriculado_nombre, cpi, inmobiliaria"
        )
        .eq("id", supabaseUser.id)
        .single();

      if (!profile) {
        return { id: supabaseUser.id, email: supabaseUser.email };
      }

      return { ...profile };
    } catch (err) {
      console.error("❌ Error cargando perfil:", err);
      return { id: supabaseUser.id, email: supabaseUser.email };
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("❌ Error al obtener sesión:", error.message);
        }

        const sessionUser = session?.user ?? null;
        const profile = sessionUser ? await loadUserProfile(sessionUser) : null;
        setUser(profile);
      } catch (err) {
        console.error("❌ Error init AuthContext:", err);
        setUser(null);
      } finally {
        // 👈 Siempre terminar el loading
        setLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        const sessionUser = session?.user ?? null;
        const profile = sessionUser ? await loadUserProfile(sessionUser) : null;
        setUser(profile);
      } catch (err) {
        console.error("❌ Error en onAuthStateChange:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext) as AuthContextType;
