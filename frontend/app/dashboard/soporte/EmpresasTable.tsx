// app/dashboard/soporte/EmpresasTable.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  listEmpresas,
  type Paged,
  type EmpresaListItem,
} from "#lib/soporteApi";

const DEFAULT_PAGE_SIZE = 10;

type Props = {
  initialData: Paged<EmpresaListItem>;
};

function fmtDateOnly(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString();
}
function fmtNumber(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR").format(n);
}

export default function EmpresasTable({ initialData }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // URL state
  const [page, setPage] = useState<number>(
    Number(params.get("page") || "1")
  );
  const [pageSize, setPageSize] = useState<number>(
    Number(params.get("pageSize") || DEFAULT_PAGE_SIZE)
  );
  const [estado, setEstado] = useState<"todos" | "activos" | "inactivos">(
    (params.get("estado") as any) || "todos"
  );
  const [search, setSearch] = useState<string>(params.get("search") || "");
  const [provincia, setProvincia] = useState<string>(params.get("provincia") || "");

  // Data
  const [data, setData] = useState<Paged<EmpresaListItem> | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync URL when filters change
  useEffect(() => {
    const usp = new URLSearchParams();
    usp.set("page", String(page));
    usp.set("pageSize", String(pageSize));
    if (estado && estado !== "todos") usp.set("estado", estado);
    if (search) usp.set("search", search);
    if (provincia) usp.set("provincia", provincia);
    router.replace(`${pathname}?${usp.toString()}`);
  }, [page, pageSize, estado, search, provincia, pathname, router]);

  // Fetch
  useEffect(() => {
    let cancelled = false;
    async function fetchPage() {
      try {
        setLoading(true);
        setError(null);

        const res = await listEmpresas({
          page,
          pageSize,
          estado,
          search: search || undefined,
          provincia: provincia || undefined,
        });

        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Error al cargar empresas.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPage();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, estado, search, provincia]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Normalización de campos desde BD/backend (snake_case) → UI
  const rows = useMemo(() => {
    const items = data?.items || [];
    return items.map((e) => {
      const cupoBase = (e.maxAsesoresBase ?? e.max_asesores) ?? 0;          // plan base
      const cupoOv   = (e.maxAsesoresOverride ?? e.max_asesores_override) ?? 0; // override
      const asesores = (e.asesoresCount ?? e.asesores_activos) ?? 0;        // métrica
      const informes30 = (e.informes30d ?? e.informes_30d) ?? 0;            // métrica
      const plan = e.planNombre ?? e.plan_nombre ?? "—";
      return {
        id: e.id,
        razon_social: e.razon_social,
        cuit: e.cuit || "—",
        provincia: e.provincia || "—",
        plan,
        cupo: cupoOv > 0 ? `${cupoBase} → ${cupoOv}` : `${cupoBase}`,
        asesores,
        informes30,
        created_at: e.createdAt ?? e.created_at ?? null,
      };
    });
  }, [data]);

  // 👉 Ruta de detalle según el contexto (Admin vs Soporte)
  const detailBase =
    pathname.startsWith("/dashboard/admin")
      ? "/dashboard/admin/empresas"
      : "/dashboard/soporte";

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-2 md:items-end">
        <div className="flex-1">
          <label className="block text-sm text-gray-600 mb-1">Buscar</label>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Razón social, CUIT, ciudad…"
            className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Provincia</label>
          <input
            value={provincia}
            onChange={(e) => {
              setProvincia(e.target.value);
              setPage(1);
            }}
            placeholder="Ej: Córdoba"
            className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Estado</label>
          <select
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value as any);
              setPage(1);
            }}
            className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
          >
            <option value="todos">Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Filas</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
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
              <th className="px-3 py-2">Razón social</th>
              <th className="px-3 py-2">CUIT</th>
              <th className="px-3 py-2">Provincia</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Cupo (base → override)</th>
              <th className="px-3 py-2">Asesores</th>
              <th className="px-3 py-2">Informes (30d)</th>
              <th className="px-3 py-2">Alta</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-red-700">
                  Error al cargar empresas: {error}
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                  Cargando…
                </td>
              </tr>
            ) : (rows?.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                  Sin resultados.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.razon_social}</td>
                  <td className="px-3 py-2">{r.cuit}</td>
                  <td className="px-3 py-2">{r.provincia}</td>
                  <td className="px-3 py-2">{r.plan}</td>
                  <td className="px-3 py-2">{r.cupo}</td>
                  <td className="px-3 py-2">{fmtNumber(r.asesores)}</td>
                  <td className="px-3 py-2">{fmtNumber(r.informes30)}</td>
                  <td className="px-3 py-2">{fmtDateOnly(r.created_at)}</td>
                  <td className="px-3 py-2">
                    <a
                      href={`${detailBase}/${r.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Ver detalle
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {`Mostrando ${rows?.length ?? 0} de ${total} • Página ${page} de ${totalPages}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="rounded-xl border px-3 py-1 text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            Anterior
          </button>
          <button
            className="rounded-xl border px-3 py-1 text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
