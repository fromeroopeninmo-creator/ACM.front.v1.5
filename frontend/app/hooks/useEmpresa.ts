"use client";

import useSWR from "swr";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

/**
 * Hook unificado para obtener los datos de la empresa asociada al usuario actual.
 * Roles: empresa, asesor, admin, soporte.
 *
 * - empresa  → busca por user.id
 * - asesor   → busca por user.empresa_id
 * - admin/soporte → retorna null (sin empresa vinculada)
 *
 * Uso:
 *   const { empresa, isLoading, mutate } = useEmpresa();
 *   // mutate() revalida todos los componentes que usen este hook.
 */
export function useEmpresa() {
  const { user } = useAuth();

  const fetchEmpresa = async () => {
    if (!user) return null;

    let empresaId: string | null = null;

    switch (user.role) {
      case "empresa":
        empresaId = user.id;
        break;
      case "asesor":
        // asegura null si viene undefined (TS-friendly)
        empresaId = user.empresa_id ?? null;
        break;
      default:
        // admin / soporte → sin empresa asociada
        return null;
    }

    if (!empresaId) return null;

    const { data, error } = await supabase
      .from("empresas")
      .select(
        "id, user_id, nombre_comercial, razon_social, cuit, matriculado, cpi, telefono, direccion, localidad, provincia, condicion_fiscal, color, logo_url"
      )
      .eq("id", empresaId)
      .single();

    if (error) throw error;
    return data;
  };

  const { data, error, isLoading, mutate } = useSWR(
    user ? ["empresa", user.id] : null,
    fetchEmpresa,
    {
      revalidateOnFocus: true,
      shouldRetryOnError: true,
      dedupingInterval: 60000, // 60s
    }
  );

  return {
    empresa: data,
    isLoading,
    error,
    mutate,
  };
}
