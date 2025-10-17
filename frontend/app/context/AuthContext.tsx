"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import type { Profile } from "@/types/acm.types"; // <-- Unificamos el tipo Profile

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // =====================================================
  // 🔒 Logout seguro
  // =====================================================
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.replace("/auth/login");
  };

  // =====================================================
  // 📦 Cargar perfil extendido desde Supabase
  // =====================================================
  const loadUserProfile = async (supabaseUser: any): Promise<Profile | null> => {
    if (!supabaseUser) return null;

    // 🧩 1️⃣ Buscar si es una empresa
    const { data: empresaData, error: empresaError } = await supabase
      .from("empresas")
      .select(
        "id, nombre_comercial, razon_social, matriculado, cpi, telefono, logo_url, color, user_id"
      )
      .eq("user_id", supabaseUser.id)
      .maybeSingle();

    if (empresaError && empresaError.code !== "PGRST116") {
      console.warn("⚠️ Error al buscar empresa:", empresaError.message);
    }

    // 🔹 Aplanar datos y limpiar posibles proxies (previene alias 'a.')
    const empresaLimpia = empresaData
      ? JSON.parse(JSON.stringify(empresaData))
      : null;

    if (empresaLimpia) {
      return {
        id: supabaseUser.id,
        email: supabaseUser.email,
        nombre: empresaLimpia.nombre_comercial,
        matriculado_nombre: empresaLimpia.matriculado,
        cpi: empresaLimpia.cpi,
        inmobiliaria: empresaLimpia.nombre_comercial,
        role: "empresa",
        telefono: (empresaLimpia as any)?.telefono || undefined, // <-- ahora válido en Profile
        empresa_id: empresaLimpia.id,
      };
    }

    // 🧩 2️⃣ Buscar si tiene perfil en tabla profiles (asesor, admin, soporte)
    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "id, email, nombre, apellido, matriculado_nombre, cpi, inmobiliaria, role, empresa_id, telefono"
      )
      .eq("id", supabaseUser.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.warn("⚠️ Error al buscar perfil:", error.message);
    }

    // 🔹 Limpiar proxies si existen
    const perfilLimpio = profile ? JSON.parse(JSON.stringify(profile)) : null;

    if (perfilLimpio) return perfilLimpio as Profile;

    // 🧩 3️⃣ Fallback: usar metadata (admins / soporte)
    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      nombre: supabaseUser.user_metadata?.nombre,
      apellido: supabaseUser.user_metadata?.apellido,
      matriculado_nombre: supabaseUser.user_metadata?.matriculado_nombre,
      cpi: supabaseUser.user_metadata?.cpi,
      inmobiliaria: supabaseUser.user_metadata?.inmobiliaria,
      role: (supabaseUser.user_metadata?.role as Profile["role"]) || "empresa",
      empresa_id: null,
    };
  };

  // =====================================================
  // ⚙️ Inicializar sesión y escuchar cambios
  // =====================================================
  useEffect(() => {
    const init = async () => {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const sessionUser = session?.user ?? null;
      const profile = sessionUser ? await loadUserProfile(sessionUser) : null;
      setUser(profile);
      setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
      } else {
        loadUserProfile(session.user).then(setUser);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // =====================================================
  // 🧩 Provider
  // =====================================================
  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
};
