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
  logoBase64: string | null;
  setLogoBase64: (logo: string | null) => void;
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Estado para logo y color
  const [logoBase64, setLogoBase64State] = useState<string | null>(null);
  const [primaryColor, setPrimaryColorState] = useState<string>("#0ea5e9"); // valor por defecto

  // Cargar logo y color desde localStorage al inicio
  useEffect(() => {
    const storedLogo = localStorage.getItem("logoBase64");
    const storedColor = localStorage.getItem("primaryColor");
    if (storedLogo) setLogoBase64State(storedLogo);
    if (storedColor) setPrimaryColorState(storedColor);
  }, []);

  // Handlers que además actualizan localStorage
  const setLogoBase64 = (logo: string | null) => {
    if (logo) {
      localStorage.setItem("logoBase64", logo);
    } else {
      localStorage.removeItem("logoBase64");
    }
    setLogoBase64State(logo);
  };

  const setPrimaryColor = (color: string) => {
    localStorage.setItem("primaryColor", color);
    setPrimaryColorState(color);
  };

  // 🔑 Logout centralizado
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const loadUserProfile = async (supabaseUser: any) => {
    if (!supabaseUser) return null;

    // Cargamos perfil desde la tabla profiles
    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "id, email, nombre, apellido, telefono, direccion, localidad, provincia, matriculado_nombre, cpi, inmobiliaria"
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

    // Normalizamos el perfil → evitamos duplicar id/email
    const { id: _profileId, email: _profileEmail, ...rest } = profile;

    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      profileId: _profileId,
      ...rest,
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
    <AuthContext.Provider
      value={{
        user,
        loading,
        logoBase64,
        setLogoBase64,
        primaryColor,
        setPrimaryColor,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext) as AuthContextType;
