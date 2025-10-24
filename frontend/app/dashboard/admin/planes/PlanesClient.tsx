"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { listPlanes, deletePlan, type PlanRow, type Paged } from "#lib/adminPlanesApi";

function fmtNumber(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR").format(n);
}
function fmtMoney(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

export default function PlanesClient({ initial }: { initial: Paged<PlanRow> }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [page, setPage] = useState<number>(Number(sp.get("page") || "1"));
  const [pageSize, setPageSize] = useState<number>(Number(sp.get("pageSize") || initial.pageSize || 10));

  const [data, setData] = useState<Paged<PlanRow>>(initial);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<false | "create" | { mode: "edit"; plan: PlanRow }>(false);

  useEffect(() => {
    const usp = new URLSearchParams(sp.toString());
    usp.set("page", String(page));
    usp.set("pageSize", String(pageSize));
    router.replace(`${pathname}?${usp.toString()}`);
  }, [page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setErr(null);
      try {
        const q = sp.get("q") || undefined;
        const activo = (sp.get("activo") || undefined) as "" | "true" | "false" | undefined;
        const res = await listPlanes({ q, activo, page, pageSize });
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Error al cargar planes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [sp, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  return (
    <section className="rounded-2xl border p-0 overflow-hidden bg-white dark:bg-neutral-900">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="text-sm text-gray-600">
          {`Mostrando ${data.items.length} de ${data.total} • Página ${page} de ${totalPages}`}
        </div>
        <button
          onClick={() => setShowModal("create")}
          className="rounded-lg border px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700"
        >
          + Nuevo plan
        </button>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-neutral-900">
            <tr className="text-left">
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Cupo</th>
              <th className="px-3 py-2">Duración</th>
              <th className="px-3 py-2">Precio</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {err ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-red-700">{err}</td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">Cargando…</td>
              </tr>
            ) : data.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">Sin resultados.</td>
              </tr>
            ) : (
              data.items.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2">{p.nombre}</td>
                  <td className="px-3 py-2">{fmtNumber(p.max_asesores)}</td>
                  <td className="px-3 py-2">{p.duracion_dias ? `${p.duracion_dias} días` : "—"}</td>
                  <td className="px-3 py-2">{fmtMoney(p.precio)}</td>
                  <td className="px-3 py-2">
                    <span className={p.activo ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700" : "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"}>
                      {p.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowModal({ mode: "edit", plan: p })}
                        className="text-blue-600 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={async () => {
                          const ok = confirm(`¿Eliminar el plan "${p.nombre}"?`);
                          if (!ok) return;
                          try {
                            await deletePlan(p.id);
                            const q = sp.get("q") || undefined;
                            const activo = (sp.get("activo") || undefined) as "" | "true" | "false" | undefined;
                            const res = await listPlanes({ q, activo, page, pageSize });
                            setData(res);
                          } catch (e: any) {
                            alert(e?.message || "No se pudo eliminar el plan.");
                          }
                        }}
                        className="text-red-600 hover:underline"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between p-3 border-t">
        <div />
        <div className="flex items-center gap-2">
          <button
            className="rounded-xl border px-3 py-1 text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            Anterior
          </button>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-xl border px-2 py-1 text-sm"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>{n} / pág</option>
            ))}
          </select>
          <button
            className="rounded-xl border px-3 py-1 text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Modal se puede agregar acá si aún no lo extrajiste */}
    </section>
  );
}
