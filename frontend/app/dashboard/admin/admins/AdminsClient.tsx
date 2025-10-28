// frontend/app/dashboard/admin/admins/AdminsClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type Paged,
  type AdminRow,
  listAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  resetAdminPassword,
} from "#lib/adminUsersApi";

type RoleAdminUI = "super_admin" | "super_admin_root" | "soporte";

function fmtDateISO(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(d);
}

export default function AdminsClient({
  initial,
  allowedCreateRoles,
  canCreateRoot,
  openCreateDefault,
}: {
  initial: Paged<AdminRow>;
  /** Opcional: limitar qué roles puede crear este usuario (UI). Por defecto: los tres */
  allowedCreateRoles?: RoleAdminUI[];
  /** Opcional: si false, oculta/inhabilita la opción Root en el selector */
  canCreateRoot?: boolean;
  /** Opcional: abrir el modal de creación al montar el componente */
  openCreateDefault?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const ALLOWED: RoleAdminUI[] =
    allowedCreateRoles && allowedCreateRoles.length > 0
      ? allowedCreateRoles
      : ["super_admin", "super_admin_root", "soporte"];

  // ===== Modal Create =====
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [c, setC] = useState<{
    email: string;
    nombre: string;
    apellido: string;
    role: RoleAdminUI;
    sendInvite: boolean;
  }>({
    email: "",
    nombre: "",
    apellido: "",
    role: (ALLOWED.includes("super_admin") ? "super_admin" : ALLOWED[0]) as RoleAdminUI,
    sendInvite: true,
  });

  useEffect(() => {
    // abrir por query ?new=1 o por prop openCreateDefault
    if (params.get("new") === "1" || openCreateDefault) setCreateOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearNewParam = () => {
    const usp = new URLSearchParams(params.toString());
    usp.delete("new");
    router.replace(`${pathname}?${usp.toString()}`);
  };

  // ===== Modal Edit =====
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);

  const [edit, setEdit] = useState<{
    id: string;
    email: string;
    nombre: string;
    apellido: string;
    role: RoleAdminUI;
  } | null>(null);

  // ===== Data/Paginación =====
  const [data, setData] = useState<Paged<AdminRow>>(initial);
  const page = data.page;
  const pageSize = data.pageSize;
  const total = data.total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const makeHref = (nextPage: number) => {
    const usp = new URLSearchParams(params.toString());
    usp.set("page", String(nextPage));
    usp.set("pageSize", String(pageSize));
    return `${pathname}?${usp.toString()}`;
  };

  // ===== Refresh client-side cuando cambie query (UX fluido)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const q = (params.get("q") || "").trim();
      const fRole = (params.get("role") || "") as "" | "super_admin" | "super_admin_root";
      const p = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
      const ps = [10, 20, 50].includes(parseInt(params.get("pageSize") || "", 10))
        ? parseInt(params.get("pageSize")!, 10)
        : 10;
      const sortBy = (params.get("sortBy") || "created_at") as "nombre" | "email" | "role" | "created_at";
      const sortDir = (params.get("sortDir") || "desc") as "asc" | "desc";

      try {
        const fresh = await listAdmins({
          q: q || undefined,
          role: fRole || undefined,
          page: p,
          pageSize: ps,
          sortBy,
          sortDir,
        });
        if (mounted) setData(fresh);
      } catch {
        // si falla, nos quedamos con initial/data actual
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // ========= Reset password helper =========
  async function doResetPassword(row: AdminRow) {
    if (!row?.id) return;

    const action = window.prompt(
      `Reset para ${row.email || "sin email"}:\n` +
        `Escribí:\n` +
        `- "link" → generar link de recuperación (recomendado)\n` +
        `- o una contraseña nueva → para fijarla directamente (solo ROOT)\n\n` +
        `Dejar vacío para cancelar.`
    );
    if (action === null) return;
    const choice = (action || "").trim();

    try {
      setResetting(row.id);
      if (!choice) return;

      if (choice.toLowerCase() === "link") {
        const resp = await resetAdminPassword(row.id, {});
        if ("mode" in resp && resp.mode === "recovery_link") {
          const msg =
            `Link de recuperación generado para ${resp.email}:\n\n` +
            `${resp.action_link || "(SDK no devolvió URL; revisar correo de magic link)"}\n\n` +
            `${resp.message}`;
          alert(msg);
        } else {
          alert("Listo.");
        }
      } else {
        const newPassword = choice;
        if (newPassword.length < 8) {
          alert("La contraseña debe tener al menos 8 caracteres.");
          return;
        }
        const resp = await resetAdminPassword(row.id, { newPassword });
        if ("mode" in resp && resp.mode === "direct") {
          alert("Contraseña actualizada.");
        } else {
          alert("Listo.");
        }
      }
    } catch (e: any) {
      alert(e?.message || "No se pudo resetear la contraseña.");
    } finally {
      setResetting(null);
    }
  }

  const roleBadge = (role: string | null | undefined) => {
    const r = (role || "") as RoleAdminUI;
    const cls =
      r === "super_admin_root"
        ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-purple-100 text-purple-700"
        : r === "super_admin"
        ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-blue-100 text-blue-700"
        : "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700";
    const label = r === "super_admin_root" ? "Root" : r === "super_admin" ? "Admin" : "Soporte";
    return <span className={cls}>{label}</span>;
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
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Rol</th>
                <th className="px-3 py-2">Creado</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                    Sin administradores.
                  </td>
                </tr>
              ) : (
                data.items.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">
                      {(row.nombre || row.apellido) ? `${row.nombre || ""} ${row.apellido || ""}`.trim() : "—"}
                    </td>
                    <td className="px-3 py-2">{row.email || "—"}</td>
                    <td className="px-3 py-2">{roleBadge(row.role as any)}</td>
                    <td className="px-3 py-2">{fmtDateISO(row.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="text-blue-600 hover:underline"
                          onClick={() => {
                            setEdit({
                              id: row.id,
                              email: row.email || "",
                              nombre: row.nombre || "",
                              apellido: row.apellido || "",
                              role: (row.role as RoleAdminUI) || "super_admin",
                            });
                            setEditOpen(true);
                          }}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className="text-amber-700 hover:underline disabled:opacity-50"
                          disabled={!!resetting}
                          onClick={() => doResetPassword(row)}
                          title="Generar link o fijar nueva contraseña"
                        >
                          {resetting === row.id ? "Reseteando…" : "Reset pass"}
                        </button>

                        <button
                          type="button"
                          className="text-red-600 hover:underline disabled:opacity-50"
                          disabled={deleting === row.id}
                          onClick={async () => {
                            if (!confirm(`¿Eliminar al admin ${row.email || row.id}?`)) return;
                            try {
                              setDeleting(row.id);
                              await deleteAdmin(row.id);
                              router.refresh();
                            } catch (e: any) {
                              alert(e?.message || "Error al eliminar.");
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
          {`Mostrando ${data.items.length} de ${total} • Página ${page} de ${totalPages}`}
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
            <h3 className="text-lg font-semibold mb-3">Nuevo admin</h3>

            <div className="space-y-3">
              <label className="block">
                <span className="text-sm text-gray-600">Email *</span>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={c.email}
                  onChange={(e) => setC({ ...c, email: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-gray-600">Nombre</span>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={c.nombre}
                    onChange={(e) => setC({ ...c, nombre: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-gray-600">Apellido</span>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={c.apellido}
                    onChange={(e) => setC({ ...c, apellido: e.target.value })}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm text-gray-600">Rol *</span>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={c.role}
                  onChange={(e) => setC({ ...c, role: e.target.value as RoleAdminUI })}
                >
                  {ALLOWED.includes("super_admin") && <option value="super_admin">Admin</option>}
                  {ALLOWED.includes("super_admin_root") && (
                    <option value="super_admin_root" disabled={canCreateRoot === false}>
                      Root
                    </option>
                  )}
                  {ALLOWED.includes("soporte") && <option value="soporte">Soporte</option>}
                </select>
              </label>

              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={c.sendInvite}
                  onChange={(e) => setC({ ...c, sendInvite: e.target.checked })}
                />
                <span className="text-sm text-gray-700">Enviar link de invitación</span>
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
                  if (!c.email.trim()) {
                    alert("El email es obligatorio.");
                    return;
                  }
                  try {
                    setCreating(true);
                    const resp = await createAdmin({
                      email: c.email.trim(),
                      nombre: c.nombre.trim() || undefined,
                      apellido: c.apellido.trim() || undefined,
                      role: c.role, // ahora puede ser soporte también
                      sendInvite: c.sendInvite,
                    });
                    setCreateOpen(false);
                    clearNewParam();
                    if ("invite_link" in resp && resp.invite_link) {
                      alert(`Usuario creado. Link de invitación:\n\n${resp.invite_link}`);
                    }
                    router.refresh();
                  } catch (e: any) {
                    alert(e?.message || "Error al crear admin.");
                  } finally {
                    setCreating(false);
                  }
                }}
                disabled={creating}
              >
                {creating ? "Creando…" : "Crear admin"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal edición */}
      {editOpen && edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow">
            <h3 className="text-lg font-semibold mb-3">Editar admin</h3>

            <div className="space-y-3">
              <label className="block">
                <span className="text-sm text-gray-600">Email</span>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={edit.email}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-gray-600">Nombre</span>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={edit.nombre}
                    onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
                />
                </label>

                <label className="block">
                  <span className="text-sm text-gray-600">Apellido</span>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={edit.apellido}
                    onChange={(e) => setEdit({ ...edit, apellido: e.target.value })}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm text-gray-600">Rol</span>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={edit.role}
                  onChange={(e) => setEdit({ ...edit, role: e.target.value as RoleAdminUI })}
                >
                  {ALLOWED.includes("super_admin") && <option value="super_admin">Admin</option>}
                  {ALLOWED.includes("super_admin_root") && (
                    <option value="super_admin_root" disabled={canCreateRoot === false}>
                      Root
                    </option>
                  )}
                  {ALLOWED.includes("soporte") && <option value="soporte">Soporte</option>}
                </select>
              </label>
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
                    await updateAdmin(edit.id, {
                      email: edit.email || undefined,
                      nombre: edit.nombre || undefined,
                      apellido: edit.apellido || undefined,
                      role: edit.role || undefined,
                    } as any); // el tipo del API acepta los tres roles tras el paso 2
                    setEditOpen(false);
                    setEdit(null);
                    router.refresh();
                  } catch (e: any) {
                    alert(e?.message || "Error al guardar cambios.");
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
