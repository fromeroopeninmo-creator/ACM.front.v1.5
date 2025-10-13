"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "./AuthContext";

interface ThemeContextType {
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  logoUrl?: string | null;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [primaryColor, setPrimaryColor] = useState("#2563eb"); // Azul por defecto
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { user } = useAuth();

  // 🎨 Si el usuario pertenece a una empresa, cargar su color y logo automáticamente
  useEffect(() => {
    const loadCompanyTheme = async () => {
      if (!user) return;

      // Solo empresas y asesores heredan color/branding
      if (user.role === "empresa" || user.role === "asesor") {
        const empresaId = user.role === "empresa" ? user.id : user.empresa_id;
        if (!empresaId) return;

        const { data, error } = await supabase
          .from("empresas")
          .select("color, logo_url")
          .eq("id", empresaId)
          .single();

        if (!error && data) {
          if (data.color) setPrimaryColor(data.color);
          if (data.logo_url) setLogoUrl(data.logo_url);
        }
      }

      // SuperAdmins y soporte mantienen el color institucional
      if (user.role === "super_admin_root" || user.role === "super_admin" || user.role === "soporte") {
        setPrimaryColor("#2563eb");
        setLogoUrl(null);
      }
    };

    loadCompanyTheme();
  }, [user]);

  return (
    <ThemeContext.Provider value={{ primaryColor, setPrimaryColor, logoUrl }}>
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
