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
  logoBase64?: string | null;
  primaryColor?: string;
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

  // Estado de logo y color
  const [logoBase64, setLogoBase64State] = useState<string | null>(null);
  const [primaryColor, setPrimaryColorState] = useState<string>("#0ea5e9");

  // --- cargar logo y color desde localStorage al iniciar ---
  useEffect(() => {
    const storedLogo = localStorage.getItem("logoBase64");
    const storedColor = localStorage.getItem("primaryColor");
    if (storedLogo) setLogoBase64State(storedLogo);
    if (storedColor) setPrimaryColorState(storedColor);
  }, []);

  // --- handlers de logo y color ---
  const setLogoBase64 = (logo: string | null) => {
    if (logo) {
      localStorage.setItem("logoBase64", logo);
    } else {
      localStorage.removeItem("logoBase64");
    }
    setLogoBase64State(logo);

    if (user) {
      supabase.from("profiles").update({ logoBase64: logo }).eq("id", user.id);
    }
  };

  const setPrimaryColor = (color: string) => {
    localStorage.setItem("primaryColor", color);
    setPrimaryColorState(color);

    if (user) {
      supabase.from("profiles").update({ primaryColor: color }).eq("id", user.id);
    }
  };

  // --- cargar perfil de usuario desde supabase ---
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
      console.warn("⚠ No se encontró perfil en profiles, usando auth.user mínimo");
      return {
        id: supabaseUser.id,
        email: supabaseUser.email,
      };
    }

    // persistir también logo y color localmente
    if (profile.logoBase64) {
      setLogoBase64State(profile.logoBase64);
      localStorage.setItem("logoBase64", profile.logoBase64);
    }
    if (profile.primaryColor) {
      setPrimaryColorState(profile.primaryColor);
      localStorage.setItem("primaryColor", profile.primaryColor);
    }

    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      profileId: profile.id,
      ...profile,
    };
  };

  // --- inicializar sesión ---
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

    // escuchar cambios en sesión
    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const sessionUser = session?.user ?? null;
        const profile = sessionUser ? await loadUserProfile(sessionUser) : null;
        setUser(profile);
      }
    );

    return () => {
      subscription?.subscription.unsubscribe();
    };
  }, []);

  // --- logout ---
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
