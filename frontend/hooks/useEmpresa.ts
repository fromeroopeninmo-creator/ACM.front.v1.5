"use client";

import useSWR from "swr";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

/**
 * 🔹 Hook unificado para obtener los datos de la empresa asociada al usuario actual.
 * Soporta roles: empresa, asesor, admin y soporte.
 * 
 * - Si es empresa → busca por user.id.
 * - Si es asesor → busca por asesor.empresa_id.
 * - Si es admin o soporte → retorna null (no hay empresa vinculada).
 */
export function useEmpresa() {
  const { user } = useAuth();

  // 🧠 Función fetcher central
  const fetchEmpresa = async () => {
    if (!user) return null;

    // Determinar empresa según el rol
    let empresaId: string | null = null;

    switch (user.role) {
      case "empresa":
        empresaId = user.id;
        break;
      case "asesor":
        empresaId = user.empresa_id;
        break;
      default:
        // admin / soporte → no tienen empresa asociada
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

  // 🔁 SWR hook con key única dependiente del usuario
  const { data, error, isLoading, mutate } = useSWR(
    user ? ["empresa", user.id] : null,
    fetchEmpresa,
    {
      revalidateOnFocus: true,
      shouldRetryOnError: true,
      dedupingInterval: 60000,
    }
  );

  return {
    empresa: data,
    isLoading,
    error,
    mutate, // 🔄 revalida todos los componentes que usen este hook
  };
}
