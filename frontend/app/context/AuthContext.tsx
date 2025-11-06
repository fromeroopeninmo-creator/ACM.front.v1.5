"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import type { Profile } from "@/types/acm.types";

// 🔐 ID de sesión de cliente (para single-session)
const SESSION_STORAGE_KEY = "vai_active_session_id";

function getOrCreateClientSessionId(): string {
  if (typeof window === "undefined") return "";
  let current = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!current) {
    current = crypto.randomUUID();
    window.localStorage.setItem(SESSION_STORAGE_KEY, current);
  }
  return current;
}

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // ID de sesión local de este dispositivo
  const [clientSessionId, setClientSessionId] = useState<string | null>(null);

  // =====================================================
  // 🔒 Logout seguro
  // =====================================================
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Error en signOut:", e);
    }
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.replace("/auth/login");
    }
  };

  // =====================================================
  // 📦 Cargar perfil extendido desde Supabase
  // =====================================================
  const loadUserProfile = async (supabaseUser: any): Promise<Profile | null> => {
    if (!supabaseUser) return null;

    // 1) PERFIL en `profiles`
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select(
        "id, email, nombre, apellido, matriculado_nombre, cpi, inmobiliaria, role, empresa_id, telefono, active_session_id"
      )
      .eq("id", supabaseUser.id)
      .maybeSingle();

    if (profileErr && profileErr.code !== "PGRST116") {
      console.warn("⚠️ Error al buscar perfil:", profileErr.message);
    }

    if (profile) {
      const perfilLimpio = JSON.parse(JSON.stringify(profile)) as Profile;
      return perfilLimpio;
    }

    // 2) SIN `profiles` → intentar inferir EMPRESA por ownership
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
        telefono: (empresaLimpia as any)?.telefono || undefined,
        empresa_id: empresaLimpia.id,
      } as Profile;
    }

    // 3) Fallback: metadata (admins / soporte creados sin profile)
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
  // ⚙️ Inicializar sesión y escuchar cambios básicos
  // =====================================================
  useEffect(() => {
    const init = async () => {
      setLoading(true);

      // Aseguramos ID de sesión local
      const clientId = getOrCreateClientSessionId();
      setClientSessionId(clientId);

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

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // =====================================================
  // 🔁 Single-session: sincronizar y escuchar cambios en profiles.active_session_id
  // =====================================================
  useEffect(() => {
    if (!user || !clientSessionId) return;

    let cancelled = false;

    // 1) Sincronizar estado al montar / cambio de usuario
    const syncActiveSession = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("active_session_id")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.warn("⚠️ Error leyendo active_session_id:", error.message);
          return;
        }

        const current = (data as any)?.active_session_id as string | null;

        // Si no hay ninguna sesión registrada, tomamos este dispositivo como el activo
        if (!current) {
          await supabase
            .from("profiles")
            .update({ active_session_id: clientSessionId })
            .eq("id", user.id);
          return;
        }

        // Si el active_session_id NO coincide con el de este dispositivo,
        // significa que alguien inició sesión en otro dispositivo más tarde.
        if (current && current !== clientSessionId) {
          if (cancelled) return;
          alert(
            "Tu sesión se cerró porque iniciaste sesión en otro dispositivo."
          );
          await supabase.auth.signOut();
          setUser(null);
          if (typeof window !== "undefined") {
            window.location.replace("/auth/login?reason=other_device");
          }
        }
      } catch (e) {
        console.warn("⚠️ Error syncActiveSession:", e);
      }
    };

    syncActiveSession();

    // 2) Suscripción Realtime a cambios en profiles (single-session en tiempo real)
    const channel = supabase
      .channel("profile_active_session_" + user.id)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload: any) => {
          const newActive = (payload.new as any)?.active_session_id as
            | string
            | null;

          if (!newActive) return;
          if (newActive === clientSessionId) return;

          // Otro dispositivo tomó control de la sesión
          alert(
            "Tu sesión se cerró porque iniciaste sesión en otro dispositivo."
          );
          supabase.auth.signOut().finally(() => {
            setUser(null);
            if (typeof window !== "undefined") {
              window.location.replace("/auth/login?reason=other_device");
            }
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, clientSessionId]);

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
