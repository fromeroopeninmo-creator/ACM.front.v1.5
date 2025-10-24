// frontend/app/dashboard/admin/empresas/[empresaId]/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { empresaId: string };
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

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

function fmtMoney(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function AdminEmpresaDetallePage({ params }: PageProps) {
  // 1) Guard: sesión + rol admin
  const supa = supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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

  const empresaId = params?.empresaId;
  if (!empresaId) redirect("/dashboard/admin/empresas");

  // 2) Traer resumen/plan/KPIs desde la vista segura
  const { data: detalle, error: detErr } = await supa
    .from("v_empresas_detalle_soporte")
    .select(
      "empresa_id, empresa_nombre, cuit, plan_nombre, max_asesores, max_asesores_override, plan_activo, fecha_inicio, fecha_fin, asesores_totales, informes_totales"
    )
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (detErr) {
    throw new Error(detErr.message);
  }
  if (!detalle) {
    redirect("/dashboard/admin/empresas");
  }

  // 3) Datos adicionales desde empresas
  const { data: empresaRow } = await supa
    .from("empresas")
    .select(
      "logo_url, color, condicion_fiscal, telefono, direccion, localidad, provincia, razon_social"
    )
    .eq("id", empresaId)
    .maybeSingle();

  // 4) Asesores de la empresa
  const { data: asesores } = await supa
    .from("asesores")
    .select("id, nombre, apellido, email, activo, fecha_creacion")
    .eq("empresa_id", empresaId)
    .order("fecha_creacion", { ascending: false });

  // 5) Informes recientes de la empresa
  const { data: informes } = await supa
    .from("informes")
    .select("id, titulo, estado, fecha_creacion")
    .eq("empresa_id", empresaId)
    .order("fecha_creacion", { ascending: false })
    .limit(20);

  // 6) Acciones de soporte (worklog) recientes
  const { data: acciones } = await supa
    .from("acciones_soporte")
    .select("id, soporte_id, empresa_id, descripcion, timestamp")
    .eq("empresa_id", empresaId)
    .order("timestamp", { ascending: false })
    .limit(10);

  // 7) Render
  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Detalle de empresa (Admin)</h1>
          <p className="text-sm text-gray-500">
            Vista integral de datos, plan, asesores e informes.
          </p>
        </div>
        <a
          href="/dashboard/admin/empresas"
          className="text-sm px-3 py-2 rounded-xl border hover:bg-gray-50 dark:hover:bg-neutral-800"
        >
          ← Volver
        </a>
      </header>

      {/* Resumen principal */}
      <section className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="w-16 h-16 rounded-xl border flex items-center justify-center overflow-hidden bg-white dark:bg-neutral-950">
            {empresaRow?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={empresaRow.logo_url}
                alt="Logo empresa"
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-xs text-gray-400">Sin logo</span>
            )}
          </div>

          {/* Datos de cabecera */}
          <div className="flex-1">
            <h2 className="text-lg font-semibold">
              {empresaRow?.razon_social || detalle.empresa_nombre}
            </h2>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <div>CUIT: {detalle.cuit || "—"}</div>
              <div>
                {[
                  empresaRow?.direccion,
                  empresaRow?.localidad,
                  empresaRow?.provincia,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </div>
              <div>Condición fiscal: {empresaRow?.condicion_fiscal || "—"}</div>
              <div>Teléfono: {empresaRow?.telefono || "—"}</div>
            </div>
          </div>

          {/* Color corporativo */}
          <div className="shrink-0">
            <div className="text-xs text-gray-500 mb-1">Color corporativo</div>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-md border"
                style={{
                  backgroundColor: empresaRow?.color || "#e5e7eb",
                }}
                title={empresaRow?.color || "—"}
              />
              <code className="text-xs">{empresaRow?.color || "—"}</code>
            </div>
          </div>
        </div>

        {/* Plan + override + métricas */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500">Plan</div>
            <div className="font-medium">{detalle.plan_nombre || "—"}</div>
            <dl className="mt-2 text-sm space-y-1">
              <div className="flex justify-between">
                <dt>Cupo base</dt>
                <dd>{fmtNumber(detalle.max_asesores)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Duración</dt>
                <dd>—</dd>
              </div>
              <div className="flex justify-between">
                <dt>Precio neto</dt>
                <dd>{fmtMoney(null)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500">Override</div>
            <dl className="mt-1 text-sm space-y-1">
              <div className="flex justify-between">
                <dt>Cupo override</dt>
                <dd>{fmtNumber(detalle.max_asesores_override)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Vigencia</dt>
                <dd>
                  {fmtDateOnly(detalle.fecha_inicio)} — {fmtDateOnly(detalle.fecha_fin)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Estado</dt>
                <dd>{detalle.plan_activo ? "Activo" : "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500">Métricas</div>
            <dl className="mt-1 text-sm space-y-1">
              <div className="flex justify-between">
                <dt>Asesores</dt>
                <dd>{fmtNumber(detalle.asesores_totales)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Informes (30 días)</dt>
                <dd>{fmtNumber(detalle.informes_totales)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Última actividad</dt>
                <dd>—</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Listas */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
          <h3 className="font-medium mb-2">Asesores</h3>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-900">
                <tr className="text-left">
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Activo</th>
                  <th className="px-3 py-2">Alta</th>
                </tr>
              </thead>
              <tbody>
                {(asesores?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                      Sin asesores.
                    </td>
                  </tr>
                ) : (
                  asesores!.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="px-3 py-2">
                        {a.nombre} {a.apellido || ""}
                      </td>
                      <td className="px-3 py-2">{a.email}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            a.activo
                              ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700"
                              : "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"
                          }
                        >
                          {a.activo ? "Activo" : "Suspendido"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{fmtDateOnly(a.fecha_creacion)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
          <h3 className="font-medium mb-2">Informes recientes</h3>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-900">
                <tr className="text-left">
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {(informes?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-gray-500">
                      Sin informes recientes.
                    </td>
                  </tr>
                ) : (
                  informes!.map((inf) => (
                    <tr key={inf.id} className="border-t">
                      <td className="px-3 py-2">{inf.titulo || "Informe VAI"}</td>
                      <td className="px-3 py-2">{inf.estado}</td>
                      <td className="px-3 py-2">{fmtDateOnly(inf.fecha_creacion)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900 lg:col-span-2">
          <h3 className="font-medium mb-2">Historial de acciones (Soporte)</h3>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-900">
                <tr className="text-left">
                  <th className="px-3 py-2">Soporte</th>
                  <th className="px-3 py-2">Descripción</th>
                  <th className="px-3 py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {(acciones?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-gray-500">
                      Sin acciones registradas.
                    </td>
                  </tr>
                ) : (
                  acciones!.map((ac) => (
                    <tr key={ac.id} className="border-t">
                      <td className="px-3 py-2">{ac.soporte_id ?? "—"}</td>
                      <td className="px-3 py-2">{ac.descripcion}</td>
                      <td className="px-3 py-2">{fmtDate(ac.timestamp)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
