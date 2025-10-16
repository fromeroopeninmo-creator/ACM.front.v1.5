"use client";

import useSWR from "swr";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

/**
 * Hook unificado para obtener los datos de la empresa asociada al usuario actual.
 * Soporta roles: empresa, asesor, admin y soporte.
 */
export function useEmpresa() {
  const { user } = useAuth();

  const fetchEmpresa = async () => {
    if (!user) return null;

    let empresaFilterKey: string | null = null;
    let filterColumn = "user_id";

    switch (user.role) {
      case "empresa":
        empresaFilterKey = user.id;
        filterColumn = "user_id";
        break;
      case "asesor":
        empresaFilterKey = user.empresa_id ?? null;
        filterColumn = "id";
        break;
      default:
        return null;
    }

    if (!empresaFilterKey) return null;

    const { data, error } = await supabase
      .from("empresas")
      .select(
        "id, user_id, nombre_comercial, razon_social, cuit, matriculado, cpi, telefono, direccion, localidad, provincia, condicion_fiscal, color, logo_url"
      )
      .eq(filterColumn, empresaFilterKey)
      .single();

    if (error) throw error;

    // 🧹 Limpieza total del proxy SWR / alias interno
    return data ? JSON.parse(JSON.stringify(data)) : null;
  };

  const { data, error, isLoading, mutate } = useSWR(
    user ? ["empresa", user.id] : null,
    fetchEmpresa,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: true,
      dedupingInterval: 60000,
    }
  );

  return {
    empresa: data,
    isLoading,
    error,
    mutate,
  };
}
