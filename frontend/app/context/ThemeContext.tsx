"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "./AuthContext";
import { usePathname } from "next/navigation";

interface ThemeContextType {
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  logoUrl?: string | null;
  setLogoUrl: (url: string | null) => void;
  hydrated: boolean;
  reloadTheme: () => Promise<void>;
}

type EmpresaTheme = {
  id: string;
  color: string | null;
  logo_url: string | null;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  /**
   * ThemeProvider también se monta durante el prerender de rutas públicas.
   * En ese contexto puede no existir todavía un AuthProvider por encima.
   * Conservamos una lectura segura para no romper /auth, /_not-found y SEO.
   */
  let user: any = null;

  try {
    user = useAuth()?.user || null;
  } catch {
    user = null;
  }

  const pathname = usePathname();

  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [resolvedEmpresaId, setResolvedEmpresaId] = useState<string | null>(
    null
  );

  /**
   * Impide repetir la misma consulta cuando React vuelve a renderizar el
   * provider sin que haya cambiado el usuario o su empresa.
   */
  const loadedThemeKeyRef = useRef<string | null>(null);
  const themeRequestRef = useRef<{
    key: string;
    promise: Promise<EmpresaTheme | null>;
  } | null>(null);

  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/landing") ||
    pathname.startsWith("/valuacion-de-inmuebles") ||
    pathname.startsWith("/factibilidad-constructiva") ||
    pathname.startsWith("/tracker-de-actividades") ||
    pathname.startsWith("/tracker-de-negocios") ||
    pathname.startsWith("/metricas-de-tu-empresa") ||
    pathname.startsWith("/tutoriales") ||
    pathname.startsWith("/blog");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const color = localStorage.getItem("vai_primaryColor");
    const logo = localStorage.getItem("vai_logoUrl");

    if (color) setPrimaryColor(color);
    if (logo) setLogoUrl(logo);

    setHydrated(true);
  }, []);

  const applyTheme = useCallback((data: EmpresaTheme | null) => {
    if (!data) return;

    setResolvedEmpresaId(data.id);

    if (data.color) {
      setPrimaryColor(data.color);
      localStorage.setItem("vai_primaryColor", data.color);
    }

    if (data.logo_url) {
      setLogoUrl(data.logo_url);
      localStorage.setItem("vai_logoUrl", data.logo_url);
    } else {
      setLogoUrl(null);
      localStorage.removeItem("vai_logoUrl");
    }
  }, []);

  const loadCompanyTheme = useCallback(
    async (force = false): Promise<void> => {
      if (!user?.id) return;

      const role = String((user as any).role || "").toLowerCase();
      const profileEmpresaId = (user as any).empresa_id
        ? String((user as any).empresa_id)
        : null;

      const key = `${user.id}:${role}:${profileEmpresaId || ""}`;

      if (!force && loadedThemeKeyRef.current === key) return;

      if (themeRequestRef.current?.key === key) {
        const pending = await themeRequestRef.current.promise;
        applyTheme(pending);
        return;
      }

      const request = (async (): Promise<EmpresaTheme | null> => {
        if (role === "asesor" && profileEmpresaId) {
          const { data, error } = await supabase
            .from("empresas")
            .select("id, color, logo_url")
            .eq("id", profileEmpresaId)
            .maybeSingle();

          if (error) {
            console.warn("⚠️ Error al cargar tema de empresa:", error.message);
            return null;
          }

          return data as EmpresaTheme | null;
        }

        if (role === "empresa") {
          /**
           * Para empresas usamos ambas relaciones históricas.
           * También aprovechamos empresa_id cuando AuthContext ya lo resolvió.
           */
          let query = supabase
            .from("empresas")
            .select("id, color, logo_url")
            .limit(1);

          if (profileEmpresaId) {
            query = query.eq("id", profileEmpresaId);
          } else {
            query = query.or(
              `user_id.eq.${user.id},id_usuario.eq.${user.id}`
            );
          }

          const { data, error } = await query.maybeSingle();

          if (error) {
            console.warn("⚠️ Error al cargar tema de empresa:", error.message);
            return null;
          }

          return data as EmpresaTheme | null;
        }

        return null;
      })();

      themeRequestRef.current = { key, promise: request };

      try {
        const data = await request;
        applyTheme(data);
        loadedThemeKeyRef.current = key;
      } finally {
        if (themeRequestRef.current?.promise === request) {
          themeRequestRef.current = null;
        }
      }
    },
    [applyTheme, user]
  );

  const reloadTheme = useCallback(async () => {
    loadedThemeKeyRef.current = null;
    await loadCompanyTheme(true);
  }, [loadCompanyTheme]);

  useEffect(() => {
    void loadCompanyTheme();
  }, [loadCompanyTheme]);

  useEffect(() => {
    const handleThemeUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        color?: string;
        logoUrl?: string | null;
      }>;

      if (customEvent.detail?.color) {
        setPrimaryColor(customEvent.detail.color);
        localStorage.setItem(
          "vai_primaryColor",
          customEvent.detail.color
        );
      }

      if (Object.prototype.hasOwnProperty.call(customEvent.detail || {}, "logoUrl")) {
        const nextLogo = customEvent.detail?.logoUrl || null;
        setLogoUrl(nextLogo);

        if (nextLogo) {
          localStorage.setItem("vai_logoUrl", nextLogo);
        } else {
          localStorage.removeItem("vai_logoUrl");
        }
      }
    };

    window.addEventListener("themeUpdated", handleThemeUpdate);
    return () => window.removeEventListener("themeUpdated", handleThemeUpdate);
  }, []);

  useEffect(() => {
    if (!resolvedEmpresaId) return;

    const channel = supabase
      .channel(`empresa_theme_${resolvedEmpresaId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "empresas",
          filter: `id=eq.${resolvedEmpresaId}`,
        },
        (payload) => {
          const updated = payload.new as Partial<EmpresaTheme> | null;
          if (!updated) return;

          if (updated.color) {
            setPrimaryColor(updated.color);
            localStorage.setItem("vai_primaryColor", updated.color);
          }

          if (Object.prototype.hasOwnProperty.call(updated, "logo_url")) {
            const nextLogo = updated.logo_url || null;
            setLogoUrl(nextLogo);

            if (nextLogo) {
              localStorage.setItem("vai_logoUrl", nextLogo);
            } else {
              localStorage.removeItem("vai_logoUrl");
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [resolvedEmpresaId]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--primary-color",
      primaryColor
    );
  }, [primaryColor]);

  if (mounted && !hydrated && !isPublicRoute) {
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
        reloadTheme,
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
