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
      .select(
        "id, email, nombre, apellido, telefono, direccion, localidad, provincia, matriculado_nombre, cpi"
      )
      .eq("id", supabaseUser.id)
      .single();

    if (error) {
      console.error("❌ Error cargando perfil:", error.message);
      return {
        id: supabaseUser.id,
        email: supabaseUser.email,
      };
    }

    // Quitamos id y email de la tabla para evitar duplicados
    const {
      id: _profileId,
      email: _profileEmail,
      ...profileData
    } = profile || {};

    return {
      id: supabaseUser.id, // siempre el de auth
      email: supabaseUser.email, // siempre el de auth
      profileId: _profileId, // id de la tabla profiles
      ...profileData, // resto de campos (nombre, apellido, etc.)
    };
  };

  useEffect(() => {
    // Cargar sesión inicial
    supabase.auth.getSession().then(async ({ data }) => {
      const sessionUser = data.session?.user ?? null;
      try {
        const profile = sessionUser ? await loadUserProfile(sessionUser) : null;
        setUser(profile);
      } catch (err) {
        console.error("❌ Error inicial cargando usuario:", err);
      } finally {
        setLoading(false);
      }
    });

    // Escuchar cambios de sesión
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user ?? null;
      try {
        const profile = sessionUser ? await loadUserProfile(sessionUser) : null;
        setUser(profile);
      } catch (err) {
        console.error("❌ Error escuchando cambios de sesión:", err);
      } finally {
        setLoading(false);
      }
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
