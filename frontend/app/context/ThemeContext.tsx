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
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { user } = useAuth();

  // ✅ 1️⃣ Al montar, leemos localStorage inmediatamente
  useEffect(() => {
    try {
      const storedColor = localStorage.getItem("vai_primaryColor");
      const storedLogo = localStorage.getItem("vai_logoUrl");

      if (storedColor) setPrimaryColor(storedColor);
      if (storedLogo) setLogoUrl(storedLogo);
    } catch (err) {
      console.warn("No se pudo leer localStorage del tema:", err);
    }
  }, []); // ← se ejecuta una sola vez al inicio

  // ✅ 2️⃣ Luego sincronizamos con Supabase y escuchamos realtime
  useEffect(() => {
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

    loadCompanyTheme();

    // 🧩 Listener realtime
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

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
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
