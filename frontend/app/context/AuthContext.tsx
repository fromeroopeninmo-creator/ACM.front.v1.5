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
  primaryColor?: string | null;
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

  const [logoBase64, setLogoBase64State] = useState<string | null>(null);
  const [primaryColor, setPrimaryColorState] = useState<string>("#0ea5e9");

  const setLogoBase64 = async (logo: string | null) => {
    try {
      if (user?.id) {
        await supabase
          .from("profiles")
          .update({ logoBase64: logo })
          .eq("id", user.id);
      }
      if (logo) localStorage.setItem("logoBase64", logo);
      else localStorage.removeItem("logoBase64");
      setLogoBase64State(logo);
    } catch (err) {
      console.error("❌ Error guardando logo:", err);
    }
  };

  const setPrimaryColor = async (color: string) => {
    try {
      if (user?.id) {
        await supabase
          .from("profiles")
          .update({ primaryColor: color })
          .eq("id", user.id);
      }
      localStorage.setItem("primaryColor", color);
      setPrimaryColorState(color);
    } catch (err) {
      console.error("❌ Error guardando color:", err);
    }
  };

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
      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "id, email, nombre, apellido, telefono, direccion, localidad, provincia, matriculado_nombre, cpi, inmobiliaria, logoBase64, primaryColor"
        )
        .eq("id", supabaseUser.id)
        .single();

      if (!profile) {
        return {
          id: supabaseUser.id,
          email: supabaseUser.email,
        };
      }

      // 🔧 Sacamos id y email para evitar duplicados
      const { id: _profileId, email: _profileEmail, ...profileData } = profile;

      // fallback localStorage
      const storedLogo = localStorage.getItem("logoBase64");
      const storedColor = localStorage.getItem("primaryColor");

      const logo = profile.logoBase64 ?? storedLogo ?? null;
      const color = profile.primaryColor ?? storedColor ?? "#0ea5e9";

      if (logo) setLogoBase64State(logo);
      if (color) setPrimaryColorState(color);

      return {
        id: supabaseUser.id,
        email: supabaseUser.email,
        profileId: _profileId,
        ...profileData,
        logoBase64: logo,
        primaryColor: color,
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
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const sessionUser = data.session?.user ?? null;
        const profile = sessionUser ? await loadUserProfile(sessionUser) : null;
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
          setLoading(true);
          const sessionUser = session?.user ?? null;
          const profile = sessionUser ? await loadUserProfile(sessionUser) : null;
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
