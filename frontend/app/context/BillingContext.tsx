"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type BillingEstadoResponse = {
  acceso?: {
    permitido?: boolean;
    origen?: string | null;
    motivo?: string | null;
  } | null;
  estado?: {
    suspendida?: boolean;
    suspendida_motivo?: string | null;
    suspendida_at?: string | null;
    plan_vencido?: boolean;
    en_periodo_gracia?: boolean;
  } | null;
  plan?: {
    id?: string;
    nombre?: string;
    es_trial?: boolean;
    incluye_valuador?: boolean;
    incluye_tracker?: boolean;
  } | null;
  error?: string;
};

type BillingContextValue = {
  enabled: boolean;
  role: string | null;
  billing: BillingEstadoResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refreshBilling: () => Promise<void>;
};

const BillingContext = createContext<BillingContextValue | undefined>(undefined);

const REVALIDATE_INTERVAL_MS = 5 * 60 * 1000;

export function BillingProvider({
  children,
  enabled,
  role,
  userId,
}: {
  children: React.ReactNode;
  enabled: boolean;
  role: string | null;
  userId: string | null;
}) {
  const [billing, setBilling] = useState<BillingEstadoResponse | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const requestInFlightRef = useRef<Promise<void> | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchBilling = useCallback(async () => {
    if (!enabled || !userId) {
      if (mountedRef.current) {
        setBilling(null);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        hasLoadedRef.current = false;
      }
      return;
    }

    if (requestInFlightRef.current) {
      return requestInFlightRef.current;
    }

    const request = (async () => {
      const isInitialLoad = !hasLoadedRef.current;

      if (mountedRef.current) {
        if (isInitialLoad) setLoading(true);
        else setRefreshing(true);
      }

      try {
        const response = await fetch("/api/billing/estado", {
          method: "GET",
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as
          | BillingEstadoResponse
          | null;

        if (!response.ok) {
          throw new Error(
            payload?.error || `No se pudo validar el acceso (${response.status}).`
          );
        }

        if (!payload) {
          throw new Error("La validación de acceso devolvió una respuesta inválida.");
        }

        if (payload.error) {
          throw new Error(payload.error);
        }

        if (mountedRef.current) {
          setBilling(payload);
          setError(null);
          hasLoadedRef.current = true;
        }
      } catch (caughtError) {
        console.error("Error verificando Billing:", caughtError);

        if (mountedRef.current) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "No se pudo validar el estado de la cuenta."
          );
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
        requestInFlightRef.current = null;
      }
    })();

    requestInFlightRef.current = request;
    return request;
  }, [enabled, userId]);

  // Nueva sesión o cambio de usuario: descartar el estado anterior y validar una vez.
  useEffect(() => {
    setBilling(null);
    setError(null);
    hasLoadedRef.current = false;
    requestInFlightRef.current = null;

    if (!enabled || !userId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    void fetchBilling();
  }, [enabled, fetchBilling, userId]);

  // Revalidación periódica silenciosa. No desmonta las páginas ni muestra loader.
  useEffect(() => {
    if (!enabled || !userId) return;

    const intervalId = window.setInterval(() => {
      void fetchBilling();
    }, REVALIDATE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [enabled, fetchBilling, userId]);

  // Al volver a la pestaña, comprobar si Admin suspendió o habilitó la cuenta.
  useEffect(() => {
    if (!enabled || !userId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchBilling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, fetchBilling, userId]);

  const value = useMemo<BillingContextValue>(
    () => ({
      enabled,
      role,
      billing,
      loading,
      refreshing,
      error,
      refreshBilling: fetchBilling,
    }),
    [billing, enabled, error, fetchBilling, loading, refreshing, role]
  );

  return (
    <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
  );
}

export function useBilling(): BillingContextValue {
  const context = useContext(BillingContext);

  if (!context) {
    throw new Error("useBilling debe utilizarse dentro de BillingProvider.");
  }

  return context;
}
