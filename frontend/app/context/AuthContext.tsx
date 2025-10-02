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
  logoBase64?: string;
  primaryColor?: string;
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

  // Estado para logo y color (persisten en localStorage)
  const [logoBase64, setLogoBase64State] = useState<string | null>(null);
  const [primaryColor, setPrimaryColorState] = useState<string>("#0ea5e9");

  // Cargar logo/color desde localStorage
  useEffect(() => {
    const storedLogo = localStorage.getItem("logoBase64");
    const storedColor = localStorage.getItem("primaryColor");
    if (storedLogo) setLogoBase64State(storedLogo);
    if (storedColor) setPrimaryColorState(storedColor);
  }, []);

  // Handlers que además guardan en localStorage
  const setLogoBase64 = (logo: string | null) => {
    if (logo) localStorage.setItem("logoBase64", logo);
    else localStorage.removeItem("logoBase64");
    setLogoBase64State(logo);
  };

  const setPrimaryColor = (color: string) => {
    localStorage.setItem("primaryColor", color);
    setPrimaryColorState(color);
  };

  // 🔹 Cargar perfil de supabase
  const loadUserProfile = async (supabaseUser: any) => {
    if (!supabaseUser) return null;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "id, email, nombre, apellido, telefono, direccion, localidad, provincia, matriculado_nombre, cpi, inmobiliaria, logoBase64, primaryColor"
      )
      .eq("id", supabaseUser.id)
      .single();

    if (error || !profile) {
      console.warn("⚠ No se encontró perfil en profiles, usando auth.user");
      return { id: supabaseUser.id, email: supabaseUser.email };
    }

    const { id: _profileId, email: _profileEmail, ...rest } = profile;

    // Mezclamos con logo/color de localStorage en caso de que no estén en la DB
    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      profileId: _profileId,
      ...rest,
      logoBase64: rest.logoBase64 || localStorage.getItem("logoBase64"),
      primaryColor: rest.primaryColor || localStorage.getItem("primaryColor") || "#0ea5e9",
    };
  };

  // 🔹 Inicialización de sesión
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
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

    // Suscribirse a cambios de sesión
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await loadUserProfile(session.user);
        setUser(profile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 🔹 Cerrar sesión
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

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
