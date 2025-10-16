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
  reloadTheme: () => Promise<void>; // 🆕 Nueva función pública
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  let user: any = null;
  try {
    user = useAuth()?.user || null;
  } catch {
    // En prerender, AuthContext aún no está disponible
  }

  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // =====================================================
  // 1️⃣ Cargar valores iniciales desde localStorage
  // =====================================================
  useEffect(() => {
    try {
      const storedColor = localStorage.getItem("vai_primaryColor");
      const storedLogo = localStorage.getItem("vai_logoUrl");

      if (storedColor) setPrimaryColor(storedColor);
      if (storedLogo) setLogoUrl(storedLogo);
    } catch (err) {
      console.warn("No se pudo leer localStorage del tema:", err);
    }
    setHydrated(true);
  }, []);

  // =====================================================
  // 2️⃣ Función principal: carga datos de empresa/asesor
  // =====================================================
  const loadCompanyTheme = async () => {
    if (!user) return;

    if (user.role === "empresa" || user.role === "asesor") {
      const empresaId = user.role === "empresa" ? user.id : user.empresa_id;
      if (!empresaId) return;

      const { data, error } = await supabase
        .from("empresas")
        .select("color, logo_url")
        .eq("id", empresaId)
        .single();

      if (!error && data) {
        if (data.color) {
          setPrimaryColor(data.color);
          localStorage.setItem("vai_primaryColor", data.color);
        }
        if (data.logo_url) {
          setLogoUrl(data.logo_url);
          localStorage.setItem("vai_logoUrl", data.logo_url);
        }
      }
    }

    if (
      user.role === "super_admin_root" ||
      user.role === "super_admin" ||
      user.role === "soporte"
    ) {
      setPrimaryColor("#2563eb");
      setLogoUrl(null);
      localStorage.removeItem("vai_primaryColor");
      localStorage.removeItem("vai_logoUrl");
    }
  };

  // 🆕 3️⃣ Exponer función pública para forzar recarga manual
  const reloadTheme = async () => {
    await loadCompanyTheme();
  };

  // =====================================================
  // 4️⃣ Cargar tema inicial desde Supabase (una vez logueado)
  // =====================================================
  useEffect(() => {
    loadCompanyTheme();

    // Realtime listener
    let channel: ReturnType<typeof supabase.channel> | null = null;

    if (user && (user.role === "empresa" || user.role === "asesor")) {
      const empresaId = user.role === "empresa" ? user.id : user.empresa_id;

      channel = supabase
        .channel("empresa_theme_updates")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "empresas",
            filter: `id=eq.${empresaId}`,
          },
          (payload) => {
            const updated = payload.new;
            if (!updated) return;

            // 🔁 Actualización instantánea sin depender de Edge realtime delays
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
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  // =====================================================
  // 5️⃣ Aplicar color global al DOM (CSS variable)
  // =====================================================
  useEffect(() => {
    if (primaryColor) {
      document.documentElement.style.setProperty("--primary-color", primaryColor);
    }
  }, [primaryColor]);

  // =====================================================
  // 6️⃣ Evitar flash visual antes de hidratar
  // =====================================================
  if (!hydrated) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-400">
        Cargando tema...
      </div>
    );
  }

  // =====================================================
  // 7️⃣ Devolver provider
  // =====================================================
  return (
    <ThemeContext.Provider
      value={{
        primaryColor,
        setPrimaryColor,
        logoUrl,
        setLogoUrl,
        hydrated,
        reloadTheme, // ✅ nueva función pública expuesta
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme debe usarse dentro de un ThemeProvider");
  }
  return context;
}
