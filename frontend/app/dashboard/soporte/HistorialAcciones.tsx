// frontend/app/dashboard/soporte/HistorialAcciones.tsx
"use client";

import { useMemo, useState } from "react";

type AccionItem = {
  soporte?: string | null;
  descripcion: string;
  timestamp: string; // ISO
};

type Props = {
  acciones: AccionItem[];
  pageSizeDefault?: number;
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

export default function HistorialAcciones({
  acciones,
  pageSizeDefault = 10,
}: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeDefault);
  const [q, setQ] = useState("");

  // Ordenar por fecha desc y filtrar por texto simple (soporte o descripción)
  const filtered = useMemo(() => {
    const base = [...(acciones || [])].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    if (!q.trim()) return base;
    const term = q.toLowerCase();
    return base.filter(
      (x) =>
        (x.soporte || "").toLowerCase().includes(term) ||
        (x.descripcion || "").toLowerCase().includes(term)
    );
  }, [acciones, q]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Ajustar página si cambian filtros/tamaño
  if (page > totalPages) {
    setPage(totalPages);
  }

  const start = (page - 1) * pageSize;
  const current = filtered.slice(start, start + pageSize);
  const isEmpty = total === 0;

  return (
    <div className="space-y-3">
      {/* Controles */}
      <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar por soporte o descripción…"
          className="w-full md:max-w-md rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Filas</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-xl border px-2 py-1 text-sm bg-white dark:bg-neutral-950"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-auto rounded-2xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-neutral-900">
            <tr className="text-left">
              <th className="px-3 py-2">Soporte</th>
              <th className="px-3 py-2">Descripción</th>
              <th className="px-3 py-2">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {isEmpty ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-gray-500">
                  Sin acciones registradas.
                </td>
              </tr>
            ) : (
              current.map((ac, idx) => (
                <tr key={`${ac.timestamp}-${idx}`} className="border-t">
                  <td className="px-3 py-2">{ac.soporte || "—"}</td>
                  <td className="px-3 py-2">{ac.descripcion}</td>
                  <td className="px-3 py-2">{fmtDate(ac.timestamp)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {`Mostrando ${current.length} de ${total} • Página ${page} de ${totalPages}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="rounded-xl border px-3 py-1 text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Anterior
          </button>
          <button
            className="rounded-xl border px-3 py-1 text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
