"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import NewAsesorForm from "./NewAsesorForm"; // si lo movés a /components, ajustá el import

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  activo: boolean;
  fecha_creacion: string;
  empresa_id: string;
}

export default function AsesoresPage() {
  const { user } = useAuth();
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEmpresaId, setLoadingEmpresaId] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const role = user?.role || "empresa";

  // ===========================
  // Resolver empresaId (robusto)
  // ===========================
  useEffect(() => {
    const resolveEmpresaId = async () => {
      try {
        if (!user) {
          setEmpresaId(null);
          return;
        }

        // 1) Si AuthContext ya trae empresa_id (para empresa) úsalo.
        if (user.empresa_id) {
          setEmpresaId(user.empresa_id);
          return;
        }

        // 2) Fallback: traer empresa por user_id (esto corre si hubiera algún perfil legacy)
        const { data, error } = await supabase
          .from("empresas")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.warn("No se pudo resolver empresa_id por user_id:", error.message);
          setEmpresaId(null);
          return;
        }

        setEmpresaId(data?.id ?? null);
      } finally {
        setLoadingEmpresaId(false);
      }
    };

    setLoadingEmpresaId(true);
    resolveEmpresaId();
  }, [user]);

  // ===========================
  // Cargar asesores
  // ===========================
  const fetchAsesores = async (empId: string) => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("asesores")
      .select("id, nombre, apellido, email, telefono, activo, fecha_creacion, empresa_id")
      .eq("empresa_id", empId)
      .order("fecha_creacion", { ascending: false });

    if (error) {
      console.error("Error cargando asesores:", error);
      setError("Error al cargar los asesores.");
    } else {
      setAsesores(data || []);
    }

    setLoading(false);
  };

  // Re-cargar cuando cambie empresaId
  useEffect(() => {
    if (!empresaId) return;
    fetchAsesores(empresaId);
    // suscripción realtime opcional (si querés):
    const channel = supabase
      .channel("empresa-asesores-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "asesores", filter: `empresa_id=eq.${empresaId}` },
        () => fetchAsesores(empresaId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  // ===========================
  // Acciones
  // ===========================
  const toggleActivo = async (id: string, current: boolean) => {
    await supabase.from("asesores").update({ activo: !current }).eq("id", id);
    if (empresaId) fetchAsesores(empresaId);
  };

  const eliminarAsesor = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este asesor?")) return;
    await supabase.from("asesores").delete().eq("id", id);
    if (empresaId) fetchAsesores(empresaId);
  };

  // ===========================
  // Guards y render
  // ===========================
  const noAutorizado = useMemo(
    () => !user || (role !== "empresa" && role !== "super_admin" && role !== "super_admin_root"),
    [user, role]
  );

  if (noAutorizado) {
    return (
      <div className="p-6 text-center text-gray-500">
        No autorizado.
      </div>
    );
  }

  if (loadingEmpresaId) {
    return (
      <div className="p-6 text-center text-gray-500">
        Resolviendo empresa...
      </div>
    );
  }

  if (!empresaId) {
    return (
      <div className="p-6 text-center text-gray-500">
        No se pudo determinar la empresa actual.
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Gestión de Asesores</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          {showForm ? "Cancelar" : "Nuevo Asesor"}
        </button>
      </div>

      {showForm && (
        <div className="mb-8">
          <NewAsesorForm
            empresaId={empresaId}
            onCreated={() => fetchAsesores(empresaId)}
          />
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200 rounded-lg">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Nombre</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Teléfono</th>
                <th className="p-3 text-left">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {asesores.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-3">
                    {a.nombre} {a.apellido}
                  </td>
                  <td className="p-3">{a.email}</td>
                  <td className="p-3">{a.telefono || "—"}</td>
                  <td className="p-3">
                    <button
                      onClick={() => toggleActivo(a.id, a.activo)}
                      className={`px-3 py-1 text-sm rounded-full ${
                        a.activo
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {a.activo ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => eliminarAsesor(a.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {asesores.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-500">
                    No hay asesores cargados aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
