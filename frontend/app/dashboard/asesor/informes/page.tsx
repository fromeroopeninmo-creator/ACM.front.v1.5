"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Informe = {
  id: string;
  titulo: string | null;
  estado: "borrador" | "final";
  created_at?: string | null;
  updated_at?: string | null;
  direccion?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  precio_estimado?: number | null;
  imagen_principal_url?: string | null;
};

export default function AsesorInformesPage() {
  const router = useRouter();

  // Data
  const [items, setItems] = useState<Informe[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Filtros
  const [q, setQ] = useState(""); // búsqueda texto
  const [estado, setEstado] = useState<"" | "borrador" | "final">("");
  const [fromDate, setFromDate] = useState<string>(""); // YYYY-MM-DD
  const [toDate, setToDate] = useState<string>("");     // YYYY-MM-DD

  // Acciones en curso
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchInformes = async () => {
    setLoading(true);
    setErr(null);
    try {
      // MUY IMPORTANTE: para Asesor usamos scope=asesor (solo sus informes)
      const res = await fetch("/api/informes/list?scope=asesor", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Error cargando informes");
      }
      const j = await res.json();
      setItems(j?.informes || j?.items || []);
    } catch (e: any) {
      setErr(e.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInformes();
  }, []);

  // Filtro y orden en cliente (al estilo Empresa)
  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    const fromTs = fromDate ? new Date(fromDate + "T00:00:00").getTime() : null;
    const toTs = toDate ? new Date(toDate + "T23:59:59").getTime() : null;

    return (items || [])
      .filter((inf) => {
        // Estado
        if (estado && inf.estado !== estado) return false;

        // Fecha
        const created = inf.created_at ? new Date(inf.created_at).getTime() : null;
        if (fromTs && created && created < fromTs) return false;
        if (toTs && created && created > toTs) return false;

        // Texto (título/dirección/localidad/provincia)
        if (text) {
          const hay =
            (inf.titulo || "").toLowerCase().includes(text) ||
            (inf.direccion || "").toLowerCase().includes(text) ||
            (inf.localidad || "").toLowerCase().includes(text) ||
            (inf.provincia || "").toLowerCase().includes(text);
          if (!hay) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bt - at; // más nuevo primero
      });
  }, [items, q, estado, fromDate, toDate]);

  const onDelete = async (id: string) => {
    if (!id) return;
    const ok = confirm("¿Eliminar este informe? Esta acción no se puede deshacer.");
    if (!ok) return;

    try {
      setDeletingId(id);
      // Endpoint esperado en el backend:
      // app/api/informes/delete/route.ts (método DELETE, valida permisos y borra filas + archivos)
      const res = await fetch(`/api/informes/delete?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "No se pudo eliminar");
      }
      // Refrescar listado
      await fetchInformes();
    } catch (e: any) {
      alert(e?.message || "Error eliminando");
    } finally {
      setDeletingId(null);
    }
  };

  const fmtDate = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso ?? "—";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + CTA */}
      <section className="bg-white shadow-sm rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-xl md:text-2xl font-bold">Mis Informes</h1>
        <Link
          href="/vai/acmforms"
          className="px-6 py-3 text-white font-semibold rounded-lg shadow transition text-center bg-blue-600 hover:bg-blue-700"
        >
          ➕ Nuevo Informe
        </Link>
      </section>

      {/* Filtros (como en Empresa) */}
      <section className="bg-white shadow-sm rounded-xl p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Buscar</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Título, dirección, localidad, provincia"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as any)}
              className="w-full border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="borrador">Borrador</option>
              <option value="final">Final</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Desde</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Hasta</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Tabla */}
      <section className="bg-white shadow-sm rounded-xl p-6">
        {loading ? (
          <p className="text-gray-500">Cargando...</p>
        ) : err ? (
          <p className="text-red-600">❌ {err}</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-600">No se encontraron informes con los filtros actuales.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded-lg">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Título</th>
                  <th className="p-3 text-left">Dirección</th>
                  <th className="p-3 text-left">Estado</th>
                  <th className="p-3 text-left">Creado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inf) => (
                  <tr key={inf.id} className="border-t">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {inf.imagen_principal_url ? (
                          <img
                            src={inf.imagen_principal_url}
                            alt=""
                            className="w-10 h-10 rounded object-cover border"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100 border grid place-items-center text-xs text-gray-400">
                            —
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{inf.titulo || "—"}</div>
                          {typeof inf.precio_estimado === "number" && (
                            <div className="text-xs text-gray-500">
                              Estimado: {Intl.NumberFormat().format(inf.precio_estimado)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="p-3">
                      {(inf.direccion || "—") +
                        (inf.localidad ? `, ${inf.localidad}` : "") +
                        (inf.provincia ? `, ${inf.provincia}` : "")}
                    </td>

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

                    <td className="p-3">{fmtDate(inf.created_at)}</td>

                    <td className="p-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Link
                          href={`/vai/acmforms?id=${encodeURIComponent(inf.id)}`}
                          className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                          title="Ver / Editar"
                        >
                          Ver/Editar
                        </Link>

                        <button
                          onClick={() => onDelete(inf.id)}
                          disabled={deletingId === inf.id}
                          className="px-3 py-1 text-sm rounded bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 disabled:opacity-60"
                          title="Eliminar"
                        >
                          {deletingId === inf.id ? "Eliminando..." : "Eliminar"}
                        </button>
                      </div>
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
