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

    // Intentamos cargar perfil desde la tabla
    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "id, email, nombre, apellido, telefono, direccion, localidad, provincia, matriculado_nombre, cpi"
      )
      .eq("id", supabaseUser.id)
      .single();

    if (error || !profile) {
      console.warn("⚠ No se encontró perfil en profiles, usando solo auth.user");
      return {
        id: supabaseUser.id,
        email: supabaseUser.email,
      };
    }

    // Sacamos id/email para evitar duplicados
    const { id: _profileId, email: _profileEmail, ...profileWithoutIdAndEmail } =
      profile;

    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      profileId: _profileId,
      ...profileWithoutIdAndEmail,
    };
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data.session?.user ?? null;
        const profile = sessionUser ? await loadUserProfile(sessionUser) : null;
        setUser(profile);
      } catch (err) {
        console.error("❌ Error inicial cargando usuario:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();

    // Escuchar cambios de sesión
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        const sessionUser = session?.user ?? null;
        const profile = sessionUser ? await loadUserProfile(sessionUser) : null;
        setUser(profile);
      } catch (err) {
        console.error("❌ Error escuchando cambios de sesión:", err);
        setUser(null);
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
