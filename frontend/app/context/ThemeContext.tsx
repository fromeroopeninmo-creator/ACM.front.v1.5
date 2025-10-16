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
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  let user: any = null;
  try {
    user = useAuth()?.user || null;
  } catch {
    // durante el prerender puede no existir AuthContext todavía
  }

  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // 1️⃣ Cargar tema desde localStorage apenas se monta
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

  // 2️⃣ Sincronizar con Supabase según el rol
  useEffect(() => {
    const loadCompanyTheme = async () => {
      if (!user) return;

      let filterColumn = "";
      let filterValue = "";

      if (user.role === "empresa") {
        // Empresa: busca por su propio user_id
        filterColumn = "user_id";
        filterValue = user.id;
      } else if (user.role === "asesor") {
        // Asesor: busca por la empresa a la que pertenece
        filterColumn = "id";
        filterValue = user.empresa_id;
      }

      if (filterValue) {
        const { data, error } = await supabase
          .from("empresas")
          .select("color, logo_url")
          .eq(filterColumn, filterValue)
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

      // Roles globales (sin empresa asociada)
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

    loadCompanyTheme();

    // 3️⃣ Suscripción en tiempo real a cambios en la empresa correspondiente
    let channel: ReturnType<typeof supabase.channel> | null = null;

    if (user && (user.role === "empresa" || user.role === "asesor")) {
      const filterColumn =
        user.role === "empresa" ? "user_id" : "id";
      const filterValue =
        user.role === "empresa" ? user.id : user.empresa_id;

      if (filterValue) {
        channel = supabase
          .channel("empresa_theme_updates")
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "empresas",
              filter: `${filterColumn}=eq.${filterValue}`,
            },
            (payload) => {
              const updated = payload.new;
              if (updated?.color) {
                setPrimaryColor(updated.color);
                localStorage.setItem("vai_primaryColor", updated.color);
              }
              if (updated?.logo_url) {
                setLogoUrl(updated.logo_url);
                localStorage.setItem("vai_logoUrl", updated.logo_url);
              }
            }
          )
          .subscribe();
      }
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  // 4️⃣ Aplicar el color global al DOM dinámicamente
  useEffect(() => {
    if (primaryColor) {
      document.documentElement.style.setProperty("--primary-color", primaryColor);
    }
  }, [primaryColor]);

  // 5️⃣ Evita el flash azul inicial antes de hidratar
  if (!hydrated) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-400">
        Cargando tema...
      </div>
    );
  }

  return (
    <ThemeContext.Provider
      value={{
        primaryColor,
        setPrimaryColor,
        logoUrl,
        setLogoUrl,
        hydrated,
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
