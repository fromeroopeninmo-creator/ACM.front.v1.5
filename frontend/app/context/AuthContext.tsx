"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import type { Profile } from "@/types/acm.types"; // <-- Unificamos el tipo Profile

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEVICE_STORAGE_KEY = "vai_device_id";

// Helper para obtener / generar un device_id estable por navegador
function getOrCreateDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!id) {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        id = crypto.randomUUID();
      } else {
        id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      }
      window.localStorage.setItem(DEVICE_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Llama al endpoint /api/auth/device en modo “heartbeat” (claim = false). */
async function checkDeviceActive(deviceId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId, claim: false }),
    });

    if (!res.ok) {
      // Si el backend falla o tira 401/500, NO rompemos la sesión
      return true;
    }

    const data = await res.json().catch(() => null);
    if (!data || typeof data.active !== "boolean") return true;
    return data.active;
  } catch {
    // Si no podemos hablar con la API, asumimos activo
    return true;
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Para el control de 1 sola sesión por usuario
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertShownRef = useRef(false);

  // =====================================================
  // 🔒 Logout seguro
  // =====================================================
  const logout = async () => {
    try {
      // Cortamos heartbeat primero para evitar loops
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      alertShownRef.current = false;

      await supabase.auth.signOut();
      setUser(null);
      window.location.replace("/auth/login");
    } catch {
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
        "id, email, nombre, apellido, matriculado_nombre, cpi, inmobiliaria, role, empresa_id, telefono"
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

    const empresaLimpia = empresaData ? JSON.parse(JSON.stringify(empresaData)) : null;

    if (empresaLimpia) {
      // ▶️ Inferimos "empresa" sólo si NO hay perfil
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
      };
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
      const sessionUser = session?.user ?? null;
      if (!sessionUser) {
        setUser(null);
        // Si no hay user, apagamos heartbeat y reseteamos el mensaje
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
        alertShownRef.current = false;
      } else {
        loadUserProfile(sessionUser).then(setUser);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, []);

  // =====================================================
  // 🔁 Heartbeat para ENFORZAR 1 solo dispositivo activo
  //    (usa /api/auth/device; NO corre si no hay sesión)
  // =====================================================
  useEffect(() => {
    // Si no hay usuario autenticado → nada que hacer
    if (!user) {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      alertShownRef.current = false;
      return;
    }

    const deviceId = getOrCreateDeviceId();
    if (!deviceId) {
      // Si por alguna razón no podemos generar deviceId, no rompemos nada
      return;
    }

    // Limpia cualquier intervalo previo
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    const runCheck = async () => {
      const stillActive = await checkDeviceActive(deviceId);
      if (!stillActive) {
        // Solo mostramos el mensaje UNA vez
        if (!alertShownRef.current) {
          alertShownRef.current = true;
          alert("Tu sesión se cerró porque iniciaste sesión en otro dispositivo.");
        }
        await supabase.auth.signOut();
        setUser(null);
        // Redirigimos directo al login
        window.location.replace("/auth/login");
      }
    };

    // Primer chequeo inmediato
    runCheck();

    // Luego, cada 15 segundos
    const intervalId = setInterval(runCheck, 15000);
    heartbeatRef.current = intervalId as any;

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [user]);

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
