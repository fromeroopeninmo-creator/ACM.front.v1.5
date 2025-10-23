// frontend/app/dashboard/soporte/EmpresaTable.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  listEmpresas,
  type EmpresaListItem,
  type ListEmpresasParams,
  type Paged,
} from "#lib/soporteApi";

type Props = {
  initialData: Paged<EmpresaListItem>;
};

const DEFAULT_PAGE_SIZE = 10;

const fetcher = async (key: string) => {
  const url = new URL(
    key,
    typeof window !== "undefined" ? window.location.origin : "http://localhost"
  );
  const params: ListEmpresasParams = {
    page: Number(url.searchParams.get("page") || "1"),
    pageSize: Number(url.searchParams.get("pageSize") || DEFAULT_PAGE_SIZE),
    search: url.searchParams.get("search") || undefined,
    estado: (url.searchParams.get("estado") as any) || undefined,
    provincia: url.searchParams.get("provincia") || undefined,
  };
  return listEmpresas(params);
};

export default function EmpresaTable({ initialData }: Props) {
  const [page, setPage] = useState<number>(initialData.page || 1);
  const [pageSize, setPageSize] = useState<number>(
    initialData.pageSize || DEFAULT_PAGE_SIZE
  );
  const [search, setSearch] = useState<string>("");
  const [estado, setEstado] = useState<"todos" | "activo" | "suspendido">(
    "todos"
  );
  const [provincia, setProvincia] = useState<string>("");

  const swrKey = useMemo(() => {
    const u = new URL("/api/soporte/empresas", "http://local");
    u.searchParams.set("page", String(page || 1));
    u.searchParams.set("pageSize", String(pageSize || DEFAULT_PAGE_SIZE));
    if (search) u.searchParams.set("search", search);
    if (estado && estado !== "todos") u.searchParams.set("estado", estado);
    if (provincia) u.searchParams.set("provincia", provincia);
    return u.pathname + "?" + u.searchParams.toString();
  }, [page, pageSize, search, estado, provincia]);

  const { data, error, isValidating } = useSWR<Paged<EmpresaListItem>>(
    swrKey,
    fetcher,
    {
      keepPreviousData: true,
      fallbackData: initialData,
      revalidateOnFocus: false,
    }
  );

  // Reset de paginación al cambiar filtros/búsqueda
  useEffect(() => {
    setPage(1);
  }, [search, estado, provincia]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isEmpty = (data?.items?.length ?? 0) === 0;

  return (
    <div className="space-y-3">
      {/* Controles */}
      <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
        <div className="flex-1 flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por Razón Social o CUIT…"
            className="w-full md:max-w-md rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
          />
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as any)}
            className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
          >
            <option value="todos">Todos</option>
            <option value="activo">Activos</option>
            <option value="suspendido">Suspendidos</option>
          </select>
          <input
            value={provincia}
            onChange={(e) => setProvincia(e.target.value)}
            placeholder="Provincia"
            className="w-40 rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Filas</label>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
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
              <th className="px-3 py-2 font-medium">Empresa</th>
              <th className="px-3 py-2 font-medium">CUIT</th>
              <th className="px-3 py-2 font-medium">Provincia</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Cupo</th>
              <th className="px-3 py-2 font-medium">Asesores</th>
              <th className="px-3 py-2 font-medium">Informes</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Vence</th>
              <th className="px-3 py-2 font-medium">Última actividad</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-red-600">
                  Error: {(error as Error).message}
                </td>
              </tr>
            )}
            {!error && isEmpty && !isValidating && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                  No hay resultados para los filtros actuales.
                </td>
              </tr>
            )}
            {!error &&
              data?.items?.map((e) => {
                const cupoBase = e.maxAsesoresBase ?? 0;
                const cupoOv = e.maxAsesoresOverride ?? 0;
                const cupo = cupoOv > 0 ? `${cupoBase} → ${cupoOv}` : `${cupoBase}`;
                const asesores = e.asesoresCount ?? 0;
                const informes = e.informesCount ?? 0;
                const vence = e.fechaFin ? new Date(e.fechaFin).toLocaleDateString() : "—";
                const last = e.ultimaActividadAt
                  ? new Date(e.ultimaActividadAt).toLocaleString()
                  : "—";
                return (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2">{e.razon_social}</td>
                    <td className="px-3 py-2">{e.cuit}</td>
                    <td className="px-3 py-2">{e.provincia || "—"}</td>
                    <td className="px-3 py-2">{e.planNombre || "—"}</td>
                    <td className="px-3 py-2">{cupo}</td>
                    <td className="px-3 py-2">{asesores}</td>
                    <td className="px-3 py-2">{informes}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          e.estadoPlan === "activo"
                            ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700"
                            : "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"
                        }
                      >
                        {e.estadoPlan === "activo" ? "Activo" : "
