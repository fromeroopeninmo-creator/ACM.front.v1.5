"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "./AuthContext";

interface ThemeContextType {
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  logoUrl?: string | null;
  setLogoUrl: (url: string | null) => void;
  hydrated: boolean;
  reloadTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  let user: any = null;
  try {
    user = useAuth()?.user || null;
  } catch {}

  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // =====================================================
  // 1️⃣ Cargar desde localStorage al montar
  // =====================================================
  useEffect(() => {
    const color = localStorage.getItem("vai_primaryColor");
    const logo = localStorage.getItem("vai_logoUrl");
    if (color) setPrimaryColor(color);
    if (logo) setLogoUrl(logo);
    setHydrated(true);
  }, []);

  // =====================================================
  // 2️⃣ Función principal de carga desde DB (por user_id)
  // =====================================================
  const loadCompanyTheme = async () => {
    if (!user) return;

    const empresaId =
      user.role === "empresa"
        ? user.id
        : user.empresa_id || user.user_metadata?.empresa_id;

    if (!empresaId) return;

    const { data, error } = await supabase
      .from("empresas")
      .select("color, logo_url")
      .eq("user_id", empresaId) // ✅ unificado: siempre por user_id
      .maybeSingle();

    if (error || !data) return;

    if (data.color) {
      setPrimaryColor(data.color);
      localStorage.setItem("vai_primaryColor", data.color);
    }

    if (data.logo_url) {
      setLogoUrl(data.logo_url);
      localStorage.setItem("vai_logoUrl", data.logo_url);
    }
  };

  // 🔁 Forzar recarga manual del tema (desde Cuenta o Header)
  const reloadTheme = async () => {
    await loadCompanyTheme();
  };

  // =====================================================
  // 3️⃣ Escuchar actualizaciones manuales (evento global)
  // =====================================================
  useEffect(() => {
    const handleThemeUpdate = (e: CustomEvent) => {
      if (e.detail?.color) {
        setPrimaryColor(e.detail.color);
        localStorage.setItem("vai_primaryColor", e.detail.color);
      }
      if (e.detail?.logoUrl) {
        setLogoUrl(e.detail.logoUrl);
        localStorage.setItem("vai_logoUrl", e.detail.logoUrl);
      }
    };

    window.addEventListener("themeUpdated", handleThemeUpdate as EventListener);
    return () => {
      window.removeEventListener("themeUpdated", handleThemeUpdate as EventListener);
    };
  }, []);

  // =====================================================
  // 4️⃣ Listener realtime (empresa/asesor → herencia de color/logo)
  // =====================================================
  useEffect(() => {
    loadCompanyTheme();
    if (!user) return;

    const empresaId =
      user.role === "empresa"
        ? user.id
        : user.empresa_id || user.user_metadata?.empresa_id;
    if (!empresaId) return;

    const channel = supabase
      .channel("empresa_theme_realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "empresas",
          filter: `user_id=eq.${empresaId}`, // ✅ corregido a user_id
        },
        (payload) => {
          const updated = payload.new;
          if (!updated) return;

          if (updated.color) {
            setPrimaryColor(updated.color);
            localStorage.setItem("vai_primaryColor", updated.color);
          }
          if (updated.logo_url) {
            setLogoUrl(updated.logo_url);
            localStorage.setItem("vai_logoUrl", updated.logo_url);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // =====================================================
  // 5️⃣ Aplicar color al DOM
  // =====================================================
  useEffect(() => {
    document.documentElement.style.setProperty("--primary-color", primaryColor);
  }, [primaryColor]);

  // =====================================================
  // 6️⃣ Hidratar correctamente (sin flash)
  // =====================================================
  if (!hydrated) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-400">
        Cargando tema...
      </div>
    );
  }

  // =====================================================
  // 7️⃣ Proveer contexto global
  // =====================================================
  return (
    <ThemeContext.Provider
      value={{
        primaryColor,
        setPrimaryColor,
        logoUrl,
        setLogoUrl,
        hydrated,
        reloadTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// =====================================================
// 🔹 Hook de uso del contexto
// =====================================================
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme debe usarse dentro de un ThemeProvider");
  }
  return context;
}
