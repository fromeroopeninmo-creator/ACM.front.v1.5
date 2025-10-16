"use client";

import useSWR from "swr";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

type EmpresaRow = {
  id: string;
  user_id: string | null;
  nombre_comercial: string | null;
  razon_social: string | null;
  cuit: string | null;
  matriculado: string | null;
  cpi: string | null;
  telefono: string | null;
  direccion: string | null;
  localidad: string | null;
  provincia: string | null;
  condicion_fiscal: string | null;
  color: string | null;
  logo_url: string | null;
};

export function useEmpresa() {
  const { user } = useAuth();

  const fetchEmpresa = async (): Promise<EmpresaRow | null> => {
    if (!user) return null;

    let filterColumn: "user_id" | "id";
    let filterValue: string | null = null;

    // 🔐 Rol actual
    const role = user.role || "empresa";

    if (role === "empresa") {
      filterColumn = "user_id";
      filterValue = user.id; // auth uid
    } else if (role === "asesor") {
      // para asesor debemos tener empresa_id en el profile
      filterColumn = "id";
      filterValue = user.empresa_id ?? null;
    } else {
      return null;
    }

    if (!filterValue) return null;

    const { data, error } = await supabase
      .from("empresas")
      .select(
        "id, user_id, nombre_comercial, razon_social, cuit, matriculado, cpi, telefono, direccion, localidad, provincia, condicion_fiscal, color, logo_url"
      )
      .eq(filterColumn, filterValue)
      .maybeSingle(); // ✅ evita throw si no encuentra fila

    if (error) throw error;

    // 🧹 Sanear proxys/aliases
    return data ? (JSON.parse(JSON.stringify(data)) as EmpresaRow) : null;
  };

  // 🗝️ Key SWR incluye rol y la clave real de filtro para evitar mezclar caches
  const key =
    user && (user.role === "empresa" || user.role === "asesor")
      ? ["empresa", user.role, user.role === "empresa" ? user.id : user.empresa_id]
      : null;

  const { data, error, isLoading, mutate } = useSWR(key, fetchEmpresa, {
    revalidateOnFocus: false,
    shouldRetryOnError: true,
    dedupingInterval: 60_000,
  });

  return {
    empresa: data,
    isLoading,
    error,
    mutate,
  };
}
