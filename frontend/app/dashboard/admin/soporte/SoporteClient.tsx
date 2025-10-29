"use client";

import { useMemo, useState } from "react";
import {
  toggleSoporte,
  upsertSoporte,
  type SoporteItem,
} from "#lib/adminSoporteApi";

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

type Props = {
  initialItems: SoporteItem[];
};

export default function SoporteClient({ initialItems }: Props) {
  const [items, setItems] = useState<SoporteItem[]>(initialItems || []);
  const [loadingRow, setLoadingRow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form alta
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  // Filtros
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<"" | "activos" | "inactivos">("");

  const activos = useMemo(() => items.filter(i => i.activo).length, [items]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return items.filter((i) => {
      const passText =
        !text ||
        (i.nombre || "").toLowerCase().includes(text) ||
        i.email.toLowerCase().includes(text);
      const passEstado =
        estado === ""
          ? true
          : estado === "activos"
          ? !!i.activo
          : !i.activo;
      return passText && passEstado;
    });
  }, [items, q, estado]);

  const handleToggle = async (row: SoporteItem, next: boolean) => {
    setError(null);
    setLoadingRow(row.id);
    const prev = items;
    setItems(prev.map(r => (r.id === row.id ? { ...r, activo: next } : r)));
    try {
      await toggleSoporte({ id: row.id, activo: next });
      // TODO: auditoría /api/admin/auditoria
    } catch (e: any) {
      setError(e?.message || "No se pudo cambiar el estado.");
      setItems(prev); // rollback
    } finally {
      setLoadingRow(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Ingresá un email válido.");
      return;
    }

    setCreating(true);
    try {
      await upsertSoporte({
        email: trimmedEmail,
        nombre: nombre.trim() || undefined,
        apellido: apellido.trim() || undefined,
        password: password.trim() || undefined, // ⬅️ ahora el tipo lo acepta
      });

      setItems((prev) => {
        const exists = prev.find((x) => x.email.toLowerCase() === trimmedEmail);
        if (exists) {
          return prev.map((x) =>
            x.email.toLowerCase() === trimmedEmail
              ? { ...x, nombre: nombre || x.nombre, activo: true }
              : x
          );
        }
        const now = new Date().toISOString();
        const maxId = prev.reduce((m, r) => Math.max(m, r.id || 0), 0);
        const newRow: SoporteItem = {
          id: maxId + 1, // visual; el id real se refleja al recargar
          email: trimmedEmail,
          nombre: nombre || null,
          activo: true,
          created_at: now,
        };
        return [newRow, ...prev];
      });

      setEmail("");
      setNombre("");
      setApellido("");
      setPassword("");
    } catch (e: any) {
      setError(e?.message || "No se pudo crear/actualizar el agente.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="space-y-4">
      {/* Resumen + Filtros */}
      <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900 space-y-3">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          <b>{items.length}</b> agentes — <b>{activos}</b> activos
        </div>

        <form
          className="grid grid-cols-1 md:grid-cols-4 gap-3"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Buscar</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              placeholder="nombre o email"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as any)}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
            >
              <option value="">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setQ("");
                setEstado("");
              }}
              className="rounded-xl border px-4 py-2 text-sm bg-gray-50 hover:bg-gray-100"
            >
              Limpiar
            </button>
          </div>
        </form>
      </div>

      {/* Alta Nuevo Agente */}
      <form
        id="nuevo-agente"
        onSubmit={handleCreate}
        className="rounded-2xl border p-4 bg-white dark:bg-neutral-900 space-y-3"
      >
        <h2 className="text-base font-semibold">Alta Nuevo Agente</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Email *</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              placeholder="agente@tuempresa.com"
              type="email"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              placeholder="Nombre"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Apellido</label>
            <input
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              placeholder="Apellido"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Contraseña (opcional)</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              placeholder="Mínimo 6 caracteres"
              type="password"
              minLength={6}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? "Guardando…" : "Agregar"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </form>

      {/* Tabla */}
      <div className="rounded-2xl border p-0 overflow-hidden bg-white dark:bg-neutral-900">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-neutral-900">
              <tr className="text-left">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Alta</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    No hay agentes de soporte aún.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={`${s.id}-${s.email}`} className="border-t">
                    <td className="px-3 py-2">{s.id}</td>
                    <td className="px-3 py-2">{s.nombre || "—"}</td>
                    <td className="px-3 py-2">{s.email}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          s.activo
                            ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700"
                            : "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"
                        }
                      >
                        {s.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-3 py-2">{fmtDate(s.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <a
                          href={`/dashboard/soporte/logs?soporteId=${encodeURIComponent(
                            String(s.id)
                          )}`}
                          className="text-blue-600 hover:underline"
                          title="Ver registros de acciones"
                        >
                          Ver registros
                        </a>

                        <button
                          className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                          disabled={loadingRow === s.id}
                          onClick={() => handleToggle(s, !s.activo)}
                          title={s.activo ? "Desactivar" : "Activar"}
                        >
                          {loadingRow === s.id ? "Procesando…" : s.activo ? "Desactivar" : "Activar"}
                        </button>

                        {/* Placeholders seguros */}
                        <button
                          className="rounded-lg border px-2 py-1 text-xs disabled:opacity-50"
                          disabled
                          title="Editar perfil (próximo paso)"
                        >
                          Editar perfil
                        </button>
                        <button
                          className="rounded-lg border px-2 py-1 text-xs text-red-600 disabled:opacity-50"
                          disabled
                          title="Eliminar (próximo paso)"
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
      </div>
    </section>
  );
}
