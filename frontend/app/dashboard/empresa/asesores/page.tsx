"use client";

import { useEffect, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import NewAsesorForm from "./NewAsesorForm"; // ✅ import del formulario

interface Asesor {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  activo: boolean;
  fecha_creacion: string;
}

export default function AsesoresPage() {
  const { user } = useAuth();
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchAsesores = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("asesores")
      .select("*")
      .eq("empresa_id", user.id)
      .order("fecha_creacion", { ascending: false });

    if (error) {
      console.error("Error cargando asesores:", error);
      setError("Error al cargar los asesores.");
    } else {
      setAsesores(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAsesores();
  }, [user]);

  const toggleActivo = async (id: string, current: boolean) => {
    await supabase.from("asesores").update({ activo: !current }).eq("id", id);
    fetchAsesores();
  };

  const eliminarAsesor = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este asesor?")) return;
    await supabase.from("asesores").delete().eq("id", id);
    fetchAsesores();
  };

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
          <NewAsesorForm empresaId={user?.id} onCreated={fetchAsesores} />
        </div>
      )}

      {loading ? (
        <p>Cargando...</p>
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
                  <td className="p-3">{a.telefono}</td>
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
