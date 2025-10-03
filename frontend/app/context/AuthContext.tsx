"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
  profileId?: string;
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
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("❌ Error al cerrar sesión:", err);
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  const loadUserProfile = async (supabaseUser: any) => {
    if (!supabaseUser) return null;

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select(
          "id, email, nombre, apellido, telefono, direccion, localidad, provincia, matriculado_nombre, cpi, inmobiliaria"
        )
        .eq("id", supabaseUser.id)
        .single();

      if (error || !profile) {
        return {
          id: supabaseUser.id,
          email: supabaseUser.email,
        };
      }

      const { id: _profileId, email: _profileEmail, ...profileData } = profile;

      return {
        id: supabaseUser.id,
        email: supabaseUser.email,
        profileId: _profileId,
        ...profileData,
      };
    } catch (err) {
      console.error("❌ Error cargando perfil:", err);
      return {
        id: supabaseUser.id,
        email: supabaseUser.email,
      };
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const sessionUser = data.session?.user ?? null;

        if (!sessionUser) {
          // 👉 No hay sesión, salimos rápido
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        const profile = await loadUserProfile(sessionUser);
        if (mounted) setUser(profile);
      } catch (err) {
        console.error("❌ Error inicial cargando usuario:", err);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          if (!session?.user) {
            if (mounted) {
              setUser(null);
              setLoading(false);
            }
            return;
          }
          setLoading(true);
          const profile = await loadUserProfile(session.user);
          if (mounted) setUser(profile);
        } catch (err) {
          console.error("❌ Error escuchando cambios de sesión:", err);
          if (mounted) setUser(null);
        } finally {
          if (mounted) setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext) as AuthContextType;
