"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Paged, PlanRow } from "#lib/adminPlanesApi";
import { createPlan, updatePlan, deletePlan } from "#lib/adminPlanesApi";

function fmtMoney(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}
function fmtNumber(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR").format(n);
}

export default function PlanesClient({ initial }: { initial: Paged<PlanRow> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // ---- Create modal ----
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [c, setC] = useState<{
    nombre: string;
    precio: string;
    duracion_dias: string;
    max_asesores: string;
    precio_extra_por_asesor: string;
    activo: boolean;
  }>({
    nombre: "",
    precio: "",
    duracion_dias: "",
    max_asesores: "",
    precio_extra_por_asesor: "",
    activo: true,
  });

  // abrir por ?new=1
  useEffect(() => {
    if (params.get("new") === "1") {
      setCreateOpen(true);
    }
  }, [params]);

  const clearNewParam = () => {
    const usp = new URLSearchParams(params.toString());
    usp.delete("new");
    router.replace(`${pathname}?${usp.toString()}`);
  };

  // ---- Edit modal ----
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [edit, setEdit] = useState<{
    id: string;
    nombre: string;
    precio: string;
    duracion_dias: string;
    max_asesores: string;
    precio_extra_por_asesor: string;
  } | null>(null);

  const page = initial.page;
  const pageSize = initial.pageSize;
  const total = initial.total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const makeHref = (nextPage: number) => {
    const usp = new URLSearchParams(params.toString());
    usp.set("page", String(nextPage));
    usp.set("pageSize", String(pageSize));
    return `${pathname}?${usp.toString()}`;
  };

  return (
    <>
      {/* Tabla */}
      <section className="rounded-2xl border p-0 overflow-hidden bg-white dark:bg-neutral-900">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-neutral-900">
              <tr className="text-left">
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Precio</th>
                <th className="px-3 py-2">Duración</th>
                <th className="px-3 py-2">Max. asesores</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {initial.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    Sin resultados.
                  </td>
                </tr>
              ) : (
                initial.items.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">{row.nombre}</td>
                    <td className="px-3 py-2">{fmtMoney(row.precio)}</td>
                    <td className="px-3 py-2">
                      {row.duracion_dias ? `${row.duracion_dias} días` : "—"}
                    </td>
                    <td className="px-3 py-2">{fmtNumber(row.max_asesores)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          row.activo
                            ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700"
                            : "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"
                        }
                      >
                        {row.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="text-blue-600 hover:underline"
                          onClick={() => {
                            setEdit({
                              id: row.id,
                              nombre: row.nombre ?? "",
                              precio: row.precio != null ? String(row.precio) : "",
                              duracion_dias:
                                row.duracion_dias != null ? String(row.duracion_dias) : "",
                              max_asesores:
                                row.max_asesores != null ? String(row.max_asesores) : "",
                              precio_extra_por_asesor:
                                (row as any).precio_extra_por_asesor != null
                                  ? String((row as any).precio_extra_por_asesor)
                                  : "",
                            });
                            setEditOpen(true);
                          }}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className="text-red-600 hover:underline disabled:opacity-50"
                          disabled={deleting === row.id}
                          onClick={async () => {
                            if (!confirm(`¿Eliminar el plan "${row.nombre}"?`)) return;
                            try {
                              setDeleting(row.id);
                              await deletePlan(row.id);
                              router.refresh();
                            } catch (e: any) {
                              alert(e?.message || "Error al eliminar el plan.");
                            } finally {
                              setDeleting(null);
                            }
                          }}
                        >
                          {deleting === row.id ? "Eliminando…" : "Eliminar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Paginación */}
      <section className="flex items-center justify-between mt-3">
        <p className="text-xs text-gray-500">
          {`Mostrando ${initial.items.length} de ${total} • Página ${page} de ${totalPages}`}
        </p>
        <div className="flex items-center gap-2">
          <a
            href={makeHref(Math.max(1, page - 1))}
            className={`rounded-xl border px-3 py-1 text-sm ${
              page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-gray-50"
            }`}
          >
            Anterior
          </a>
          <a
            href={makeHref(Math.min(totalPages, page + 1))}
            className={`rounded-xl border px-3 py-1 text-sm ${
              page >= totalPages ? "pointer-events-none opacity-50" : "hover:bg-gray-50"
            }`}
          >
            Siguiente
          </a>
        </div>
      </section>

      {/* Modal creación */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow">
            <h3 className="text-lg font-semibold mb-3">Nuevo plan</h3>

            <div className="space-y-3">
              <label className="block">
                <span className="text-sm text-gray-600">Nombre *</span>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={c.nombre}
                  onChange={(e) => setC({ ...c, nombre: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-gray-600">Precio (ARS)</span>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    inputMode="numeric"
                    value={c.precio}
                    onChange={(e) => setC({ ...c, precio: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-gray-600">Duración (días)</span>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    inputMode="numeric"
                    value={c.duracion_dias}
                    onChange={(e) => setC({ ...c, duracion_dias: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-gray-600">Max. asesores</span>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    inputMode="numeric"
                    value={c.max_asesores}
                    onChange={(e) => setC({ ...c, max_asesores: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-gray-600">Precio extra/asesor</span>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    inputMode="numeric"
                    value={c.precio_extra_por_asesor}
                    onChange={(e) =>
                      setC({ ...c, precio_extra_por_asesor: e.target.value })
                    }
                  />
                </label>
              </div>

              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={c.activo}
                  onChange={(e) => setC({ ...c, activo: e.target.checked })}
                />
                <span className="text-sm text-gray-700">Activo</span>
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => {
                  setCreateOpen(false);
                  clearNewParam();
                }}
                disabled={creating}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={async () => {
                  if (!c.nombre.trim()) {
                    alert("El nombre es obligatorio.");
                    return;
                  }
                  try {
                    setCreating(true);
                    await createPlan(
                      {
                        nombre: c.nombre.trim(),
                        precio: c.precio !== "" ? Number(c.precio) : null,
                        duracion_dias:
                          c.duracion_dias !== "" ? Number(c.duracion_dias) : null,
                        max_asesores:
                          c.max_asesores !== "" ? Number(c.max_asesores) : 0,
                        // si tu schema no lo tiene, el endpoint lo ignora
                        precio_extra_por_asesor:
                          c.precio_extra_por_asesor !== ""
                            ? Number(c.precio_extra_por_asesor)
                            : null,

                        activo: c.activo,
                      },
                      {}
                    );
                    setCreateOpen(false);
                    clearNewParam();
                    router.refresh();
                  } catch (e: any) {
                    alert(e?.message || "Error al crear el plan.");
                  } finally {
                    setCreating(false);
                  }
                }}
                disabled={creating}
              >
                {creating ? "Creando…" : "Crear plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal edición */}
      {editOpen && edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow">
            <h3 className="text-lg font-semibold mb-3">Editar plan</h3>

            <div className="space-y-3">
              <label className="block">
                <span className="text-sm text-gray-600">Nombre</span>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={edit.nombre}
                  onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-gray-600">Precio (ARS)</span>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    inputMode="numeric"
                    value={edit.precio}
                    onChange={(e) => setEdit({ ...edit, precio: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-gray-600">Duración (días)</span>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    inputMode="numeric"
                    value={edit.duracion_dias}
                    onChange={(e) =>
                      setEdit({ ...edit, duracion_dias: e.target.value })
                    }
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-gray-600">Max. asesores</span>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    inputMode="numeric"
                    value={edit.max_asesores}
                    onChange={(e) =>
                      setEdit({ ...edit, max_asesores: e.target.value })
                    }
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-gray-600">Precio extra/asesor</span>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    inputMode="numeric"
                    value={edit.precio_extra_por_asesor}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        precio_extra_por_asesor: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => {
                  setEditOpen(false);
                  setEdit(null);
                }}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={async () => {
                  if (!edit) return;
                  try {
                    setSaving(true);
                    await updatePlan(edit.id, {
                      nombre: edit.nombre || undefined,
                      precio: edit.precio !== "" ? Number(edit.precio) : undefined,
                      duracion_dias:
                        edit.duracion_dias !== ""
                          ? Number(edit.duracion_dias)
                          : undefined,
                      max_asesores:
                        edit.max_asesores !== ""
                          ? Number(edit.max_asesores)
                          : undefined,
                      // @ts-expect-error: si no existe en tu schema, el endpoint lo ignora
                      precio_extra_por_asesor:
                        edit.precio_extra_por_asesor !== ""
                          ? Number(edit.precio_extra_por_asesor)
                          : undefined,
                    });
                    setEditOpen(false);
                    setEdit(null);
                    router.refresh();
                  } catch (e: any) {
                    alert(e?.message || "Error al actualizar el plan.");
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
