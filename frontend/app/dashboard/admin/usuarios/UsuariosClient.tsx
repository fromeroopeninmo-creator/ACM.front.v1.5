// frontend/app/dashboard/admin/usuarios/UsuariosClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  // asumimos que ya existen en tu adminUsersApi
  // listAdmins no se usa aquí porque viene SSR
  updateAdminIdentity,
} from "#lib/adminUsersApi";

type Role = "super_admin_root" | "super_admin" | "soporte" | "empresa" | "asesor";

async function postJSON(url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${url} → ${res.status} ${res.statusText} ${text}`.trim());
  }
  return res.json();
}

export default function UsuariosClient({
  initial,
  isRoot,
}: {
  initial: { items: any[] };
  isRoot: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(
    (initial?.items || []).map((u: any) => ({
      id: u.id,                      // user_id
      email: u.email ?? "",
      nombre: u.nombre ?? "",
      apellido: u.apellido ?? "",
      role: (u.role as Role) ?? "soporte",
    }))
  );

  const [busy, setBusy] = useState<string | null>(null);

  const saveRole = async (userId: string, role: Role) => {
    setBusy(userId);
    try {
      // endpoint existente:
      // POST /api/admin/usuarios/role  body: { user_id, role }
      await postJSON("/api/admin/usuarios/role", { user_id: userId, role });
      router.refresh();
    } catch (e: any) {
      alert(e?.message || "No se pudo actualizar el rol.");
    } finally {
      setBusy(null);
    }
  };

  const resetPassword = async (userId: string) => {
    setBusy(userId);
    try {
      // endpoint existente: POST /api/admin/admins/[id]/reset
      const data = await postJSON(`/api/admin/admins/${encodeURIComponent(userId)}/reset`, {});
      const link =
        data?.action_link ||
        data?.properties?.action_link ||
        data?.link ||
        null;
      if (link) {
        // Mostramos el link para copiar (podés reemplazar por un modal si querés)
        prompt("Action link generado (copiar y enviar al usuario):", link);
      } else {
        alert("Enlace de reseteo generado (ver logs).");
      }
    } catch (e: any) {
      alert(e?.message || "No se pudo generar el enlace de reseteo.");
    } finally {
      setBusy(null);
    }
  };

  const saveIdentity = async (userId: string, email: string, nombre: string, apellido: string) => {
    setBusy(userId);
    try {
      await updateAdminIdentity(userId, {
        email: email || undefined,
        nombre: nombre || undefined,
        apellido: apellido || undefined,
      });
      router.refresh();
    } catch (e: any) {
      alert(e?.message || "No se pudo actualizar la identidad.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-neutral-900">
            <tr className="text-left">
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Apellido</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                  Sin usuarios.
                </td>
              </tr>
            ) : (
              rows.map((u, idx) => (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded-md border px-2 py-1 bg-transparent"
                      value={u.nombre}
                      onChange={(e) => {
                        const copy = [...rows];
                        copy[idx] = { ...copy[idx], nombre: e.target.value };
                        setRows(copy);
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded-md border px-2 py-1 bg-transparent"
                      value={u.apellido}
                      onChange={(e) => {
                        const copy = [...rows];
                        copy[idx] = { ...copy[idx], apellido: e.target.value };
                        setRows(copy);
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="email"
                      className="w-full rounded-md border px-2 py-1 bg-transparent"
                      value={u.email}
                      onChange={(e) => {
                        const copy = [...rows];
                        copy[idx] = { ...copy[idx], email: e.target.value };
                        setRows(copy);
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded-md border px-2 py-1 bg-transparent"
                      value={u.role}
                      onChange={(e) => {
                        const next = e.target.value as Role;
                        const copy = [...rows];
                        copy[idx] = { ...copy[idx], role: next };
                        setRows(copy);
                      }}
                    >
                      {/* Si NO es root, ocultamos super_admin_root para no auto-elevar */}
                      {isRoot && <option value="super_admin_root">super_admin_root</option>}
                      <option value="super_admin">super_admin</option>
                      <option value="soporte">soporte</option>
                      {/* Podrías permitir bajar a 'empresa' / 'asesor' si querés */}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy === u.id}
                        className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                        onClick={() => saveRole(u.id, u.role)}
                        title="Guardar rol"
                      >
                        {busy === u.id ? "..." : "Guardar rol"}
                      </button>

                      <button
                        type="button"
                        disabled={busy === u.id}
                        className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                        onClick={() => saveIdentity(u.id, u.email, u.nombre, u.apellido)}
                        title="Guardar identidad"
                      >
                        {busy === u.id ? "..." : "Guardar identidad"}
                      </button>

                      <button
                        type="button"
                        disabled={busy === u.id}
                        className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                        onClick={() => resetPassword(u.id)}
                        title="Generar link de reseteo"
                      >
                        {busy === u.id ? "..." : "Reset password"}
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
  );
}
