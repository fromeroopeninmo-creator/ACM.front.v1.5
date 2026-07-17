"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "#lib/supabaseClient";
import type { Profile } from "@/types/acm.types";

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Evita que getSession() y el evento INITIAL_SESSION consulten profiles
   * simultáneamente para el mismo usuario.
   */
  const profileRequestRef = useRef<{
    userId: string;
    promise: Promise<Profile | null>;
  } | null>(null);

  const loadedUserIdRef = useRef<string | null>(null);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    loadedUserIdRef.current = null;
    profileRequestRef.current = null;
    setUser(null);
    window.location.replace("/auth/login");
  }, []);

  const loadUserProfile = useCallback(
    async (supabaseUser: any): Promise<Profile | null> => {
      if (!supabaseUser?.id) return null;

      const userId = String(supabaseUser.id);

      if (
        profileRequestRef.current?.userId === userId &&
        profileRequestRef.current.promise
      ) {
        return profileRequestRef.current.promise;
      }

      const request = (async (): Promise<Profile | null> => {
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select(
            "id, email, nombre, apellido, matriculado_nombre, cpi, inmobiliaria, role, empresa_id, telefono"
          )
          .eq("id", userId)
          .maybeSingle();

        if (profileErr && profileErr.code !== "PGRST116") {
          console.warn("⚠️ Error al buscar perfil:", profileErr.message);
        }

        if (profile) {
          return JSON.parse(JSON.stringify(profile)) as Profile;
        }

        /**
         * Compatibilidad con empresas históricas:
         * algunas quedaron vinculadas por user_id y otras por id_usuario.
         */
        const { data: empresaData, error: empresaError } = await supabase
          .from("empresas")
          .select(
            "id, nombre_comercial, razon_social, matriculado, cpi, telefono, logo_url, color, user_id, id_usuario"
          )
          .or(`user_id.eq.${userId},id_usuario.eq.${userId}`)
          .limit(1)
          .maybeSingle();

        if (empresaError && empresaError.code !== "PGRST116") {
          console.warn("⚠️ Error al buscar empresa:", empresaError.message);
        }

        const empresaLimpia = empresaData
          ? JSON.parse(JSON.stringify(empresaData))
          : null;

        if (empresaLimpia) {
          return {
            id: userId,
            email: supabaseUser.email,
            nombre: empresaLimpia.nombre_comercial,
            matriculado_nombre: empresaLimpia.matriculado,
            cpi: empresaLimpia.cpi,
            inmobiliaria: empresaLimpia.nombre_comercial,
            role: "empresa",
            telefono: empresaLimpia.telefono || undefined,
            empresa_id: empresaLimpia.id,
          } as Profile;
        }

        return {
          id: userId,
          email: supabaseUser.email,
          nombre: supabaseUser.user_metadata?.nombre,
          apellido: supabaseUser.user_metadata?.apellido,
          matriculado_nombre: supabaseUser.user_metadata?.matriculado_nombre,
          cpi: supabaseUser.user_metadata?.cpi,
          inmobiliaria: supabaseUser.user_metadata?.inmobiliaria,
          role:
            (supabaseUser.user_metadata?.role as Profile["role"]) || "empresa",
          empresa_id: null,
        } as Profile;
      })();

      profileRequestRef.current = { userId, promise: request };

      try {
        const result = await request;
        loadedUserIdRef.current = userId;
        return result;
      } finally {
        if (profileRequestRef.current?.promise === request) {
          profileRequestRef.current = null;
        }
      }
    },
    []
  );

  useEffect(() => {
    let mounted = true;

    const applySessionUser = async (
      sessionUser: any,
      forceReload = false
    ): Promise<void> => {
      if (!mounted) return;

      if (!sessionUser) {
        loadedUserIdRef.current = null;
        profileRequestRef.current = null;
        setUser(null);
        setLoading(false);
        return;
      }

      const userId = String(sessionUser.id);

      if (!forceReload && loadedUserIdRef.current === userId) {
        setLoading(false);
        return;
      }

      const profile = await loadUserProfile(sessionUser);

      if (mounted) {
        setUser(profile);
        setLoading(false);
      }
    };

    const init = async () => {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      await applySessionUser(session?.user ?? null);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      /**
       * INITIAL_SESSION suele repetirse con getSession().
       * applySessionUser lo deduplica por userId.
       *
       * TOKEN_REFRESHED no requiere volver a consultar profiles.
       */
      if (event === "TOKEN_REFRESHED") return;

      if (event === "SIGNED_OUT") {
        loadedUserIdRef.current = null;
        profileRequestRef.current = null;
        setUser(null);
        setLoading(false);
        return;
      }

      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void applySessionUser(session?.user ?? null, event === "USER_UPDATED");
        return;
      }

      if (event === "INITIAL_SESSION") {
        void applySessionUser(session?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

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
