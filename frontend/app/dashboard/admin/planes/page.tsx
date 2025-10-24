// frontend/app/dashboard/admin/planes/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import {
  listPlanes,
  type Paged,
  type PlanRow,
  createPlan,
  updatePlan,
  deletePlan,
} from "#lib/adminPlanesApi";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  activo?: "" | "true" | "false";
  page?: string;
  pageSize?: string;
};

function buildCookieHeader(): string {
  const jar = cookies();
  const all = jar.getAll();
  if (!all?.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

function fmtNumber(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR").format(n);
}
function fmtMoney(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

export default async function AdminPlanesPage({ searchParams }: { searchParams: SearchParams }) {
  // 1) Guard de sesión + rol
  const supa = supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supa
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role || (user.user_metadata as any)?.role || null;
  const isAdmin = role === "super_admin" || role === "super_admin_root";

  if (!isAdmin) {
    switch (role) {
      case "soporte":
        redirect("/dashboard/soporte");
      case "empresa":
        redirect("/dashboard/empresa");
      case "asesor":
        redirect("/dashboard/asesor");
      default:
        redirect("/");
    }
  }

  // 2) Filtros + paginación
  const q = (searchParams.q || "").trim();
  const activo = (searchParams.activo || "") as "" | "true" | "false";
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const pageSize = [10, 20, 50].includes(parseInt(searchParams.pageSize || "", 10))
    ? parseInt(searchParams.pageSize!, 10)
    : 10;

  // 3) SSR fetch (primer página con cookie)
  const cookieHeader = buildCookieHeader();
  let initial: Paged<PlanRow>;
  try {
    initial = await listPlanes(
      { q: q || undefined, activo: activo || undefined, page, pageSize },
      { headers: { cookie: cookieHeader } }
    );
  } catch (e: any) {
    return (
      <main className="p-4 md:p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-semibold">Planes (Administración)</h1>
            <p className="text-sm text-gray-500">Error al cargar planes.</p>
          </div>
        </header>
        <section className="rounded-2xl border p-4 text-red-700 bg-red-50">{e?.message || String(e)}</section>
      </main>
    );
  }

  // 4) Render (client component para CRUD & navegación)
  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Planes (Administración)</h1>
          <p className="text-sm text-gray-500">Listado, filtros y ABM de planes.</p>
        </div>
      </header>

      {/* Filtros (GET) */}
      <section className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
        <form className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Buscar</label>
            <input
              name="q"
              defaultValue={q}
              placeholder="Nombre de plan"
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Estado</label>
            <select
              name="activo"
              defaultValue={activo}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
            >
              <option value="">Todos</option>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="rounded-xl border px-4 py-2 text-sm bg-gray-50 hover:bg-gray-100">
              Aplicar
            </button>
            <a href="/dashboard/admin/planes" className="rounded-xl border px-4 py-2 text-sm bg-white hover:bg-gray-50">
              Limpiar
            </a>
          </div>
        </form>
      </section>

      {/* Tabla + acciones (cliente) */}
      <PlanesClient initial={initial} />
    </main>
  );
}

// -------------------------
// Client-side CRUD component
// -------------------------
"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function PlanesClient({ initial }: { initial: Paged<PlanRow> }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // URL state
  const [page, setPage] = useState<number>(Number(sp.get("page") || "1"));
  const [pageSize, setPageSize] = useState<number>(Number(sp.get("pageSize") || initial.pageSize || 10));

  // Data state
  const [data, setData] = useState<Paged<PlanRow>>(initial);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState<false | "create" | { mode: "edit"; plan: PlanRow }>(false);

  // Sync URL on page/pageSize
  useEffect(() => {
    const usp = new URLSearchParams(sp.toString());
    usp.set("page", String(page));
    usp.set("pageSize", String(pageSize));
    router.replace(`${pathname}?${usp.toString()}`);
  }, [page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when page/pageSize/search filters change
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
    return () => {
      cancelled = true;
    };
  }, [sp, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  return (
    <section className="rounded-2xl border p-0 overflow-hidden bg-white dark:bg-neutral-900">
      {/* Acciones header */}
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

      {/* Tabla */}
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
                <td colSpan={6} className="px-3 py-6 text-center text-red-700">
                  {err}
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  Cargando…
                </td>
              </tr>
            ) : data.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  Sin resultados.
                </td>
              </tr>
            ) : (
              data.items.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2">{p.nombre}</td>
                  <td className="px-3 py-2">{fmtNumber(p.max_asesores)}</td>
                  <td className="px-3 py-2">{p.duracion_dias ? `${p.duracion_dias} días` : "—"}</td>
                  <td className="px-3 py-2">{fmtMoney(p.precio)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        p.activo
                          ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700"
                          : "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"
                      }
                    >
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
                            // refetch
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

      {/* Footer: paginación */}
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
              <option key={n} value={n}>
                {n} / pág
              </option>
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

      {/* Modal Crear/Editar */}
      {showModal && (
        <PlanModal
          mode={showModal === "create" ? "create" : "edit"}
          plan={showModal === "create" ? null : showModal.plan}
          onClose={() => setShowModal(false)}
          onSaved={async () => {
            const q = sp.get("q") || undefined;
            const activo = (sp.get("activo") || undefined) as "" | "true" | "false" | undefined;
            const res = await listPlanes({ q, activo, page, pageSize });
            setData(res);
          }}
        />
      )}
    </section>
  );
}

function PlanModal({
  mode,
  plan,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  plan: PlanRow | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [nombre, setNombre] = useState<string>(plan?.nombre || "");
  const [cupo, setCupo] = useState<string>(plan?.max_asesores != null ? String(plan.max_asesores) : "");
  const [duracion, setDuracion] = useState<string>(plan?.duracion_dias != null ? String(plan.duracion_dias) : "");
  const [precio, setPrecio] = useState<string>(plan?.precio != null ? String(plan.precio) : "");
  const [activo, setActivo] = useState<boolean>(plan?.activo ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    // Validaciones mínimas
    const max_asesores = parseInt(cupo || "0", 10);
    const duracion_dias = duracion ? parseInt(duracion, 10) : null;
    const precio_num = precio ? parseInt(precio, 10) : null;

    if (!nombre.trim()) return setErr("Ingresá un nombre de plan.");
    if (!Number.isFinite(max_asesores) || max_asesores <= 0) return setErr("Cupo inválido.");
    if (duracion && (!Number.isFinite(duracion_dias!) || (duracion_dias as number) <= 0))
      return setErr("Duración inválida.");

    try {
      setSaving(true);
      if (mode === "create") {
        await createPlan({
          nombre: nombre.trim(),
          max_asesores,
          duracion_dias,
          precio: precio_num,
          activo,
        });
      } else if (plan) {
        await updatePlan(plan.id, {
          nombre: nombre.trim(),
          max_asesores,
          duracion_dias,
          precio: precio_num,
          activo,
        });
      }
      await onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message || "No se pudo guardar el plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-3 z-[100]">
      <div className="w-full max-w-lg rounded-2xl border bg-white dark:bg-neutral-900 shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">{mode === "create" ? "Nuevo plan" : "Editar plan"}</h3>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-2">{err}</div>}

          <div>
            <label className="block text-sm text-gray-600 mb-1">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              placeholder="Ej: Inicial / Premium"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Cupo (asesores)</label>
              <input
                value={cupo}
                onChange={(e) => setCupo(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
                inputMode="numeric"
                placeholder="Ej: 5 / 20"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Duración (días)</label>
              <input
                value={duracion}
                onChange={(e) => setDuracion(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
                inputMode="numeric"
                placeholder="Ej: 30 / 365"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Precio (ARS)</label>
              <input
                value={precio}
                onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
                inputMode="numeric"
                placeholder="Ej: 12000"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="activo"
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
            />
            <label htmlFor="activo" className="text-sm">Activo</label>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-4 py-2 text-sm bg-white hover:bg-gray-50"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl border px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
