"use client";

import { useEffect, useState } from "react";

type Informe = {
  id: string;
  titulo: string | null;
  estado: "borrador" | "final";
  created_at?: string | null;
  asesor_email?: string | null;
  direccion?: string | null;
  localidad?: string | null;
  provincia?: string | null;
};

export default function EmpresaInformesPage() {
  const [items, setItems] = useState<Informe[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchInformes = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/informes/list?scope=empresa", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Error cargando informes");
      }
      const j = await res.json();
      setItems(j?.informes || []);
    } catch (e: any) {
      setErr(e.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInformes();
  }, []);

  return (
    <div className="space-y-6">
      <section className="bg-white shadow-sm rounded-xl p-6">
        <h1 className="text-xl md:text-2xl font-bold">Informes de la Empresa</h1>
        <p className="text-gray-600">
          Listado de informes creados por tu empresa y sus asesores.
        </p>
      </section>

      <section className="bg-white shadow-sm rounded-xl p-6">
        {loading ? (
          <p className="text-gray-500">Cargando...</p>
        ) : err ? (
          <p className="text-red-600">❌ {err}</p>
        ) : items.length === 0 ? (
          <p className="text-gray-600">No hay informes aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded-lg">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Título</th>
                  <th className="p-3 text-left">Propiedad</th>
                  <th className="p-3 text-left">Asesor</th>
                  <th className="p-3 text-left">Estado</th>
                  <th className="p-3 text-left">Creado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((inf) => (
                  <tr key={inf.id} className="border-t">
                    <td className="p-3">{inf.titulo || "—"}</td>
                    <td className="p-3">
                      {inf.direccion || "—"}
                      {inf.localidad ? `, ${inf.localidad}` : ""}
                      {inf.provincia ? `, ${inf.provincia}` : ""}
                    </td>
                    <td className="p-3">{inf.asesor_email || "—"}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          inf.estado === "final"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {inf.estado}
                      </span>
                    </td>
                    <td className="p-3">
                      {inf.created_at
                        ? new Date(inf.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <button className="px-3 py-1 text-sm rounded bg-gray-100 text-gray-800 hover:bg-gray-200">
                        Ver/Editar (próx.)
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
