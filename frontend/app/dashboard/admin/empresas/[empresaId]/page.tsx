import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import { getEmpresaDetalle, type EmpresaDetalle } from "#lib/soporteApi";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { empresaId: string };
};

function buildCookieHeader(): string {
  const jar = cookies();
  const all = jar.getAll();
  if (!all?.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

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
  // 1) Guard: sesión + rol
  const supa = supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // role en profiles; fallback a user_metadata.role
  const { data: profile } = await supa
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role || (user.user_metadata as any)?.role || null;
  const isAdmin = role === "super_admin" || role === "super_admin_root";

  if (!isAdmin) {
    // redirigir según rol real
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

  // 2) Fetch SSR del detalle
  const cookieHeader = buildCookieHeader();

  let detalle: EmpresaDetalle | null = null;
  let errorMsg: string | null = null;
  try {
    // Reutilizamos /api/soporte/empresas/[empresaId], que autoriza admin/root
    detalle = await getEmpresaDetalle(params.empresaId, {
      headers: { cookie: cookieHeader },
    });
  } catch (e: any) {
    errorMsg = e?.message || "Error al cargar el detalle de la empresa.";
  }

  // 3) Render
  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Detalle de empresa (Admin)</h1>
          <p className="text-sm text-gray-500">
            Vista de solo lectura. Luego sumamos acciones administrativas (ABM, auditoría).
          </p>
        </div>
        <a
          href="/dashboard/admin/empresas"
          className="text-sm px-3 py-2 rounded-xl border hover:bg-gray-50 dark:hover:bg-neutral-800"
        >
          ← Volver
        </a>
      </header>

      {errorMsg ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {errorMsg}
        </section>
      ) : !detalle ? (
        <section className="rounded-2xl border p-4">Cargando…</section>
      ) : (
        <>
          {/* Resumen principal */}
          <section className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
            <div className="flex items-start gap-4">
              {/* Logo */}
              <div className="w-16 h-16 rounded-xl border flex items-center justify-center overflow-hidden bg-white dark:bg-neutral-950">
                {detalle.empresa.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={detalle.empresa.logo_url}
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
                  {detalle.empresa.razon_social}
                </h2>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  <div>CUIT: {detalle.empresa.cuit || "—"}</div>
                  <div>
                    {[
                      detalle.empresa.direccion,
                      detalle.empresa.localidad,
                      detalle.empresa.provincia,
                    ]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </div>
                  <div>Condición fiscal: {detalle.empresa.condicion_fiscal || "—"}</div>
                  <div>Teléfono: {detalle.empresa.telefono || "—"}</div>
                </div>
              </div>

              {/* Color corporativo */}
              <div className="shrink-0">
                <div className="text-xs text-gray-500 mb-1">Color corporativo</div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-md border"
                    style={{
                      backgroundColor: detalle.empresa.color || "#e5e7eb",
                    }}
                    title={detalle.empresa.color || "—"}
                  />
                  <code className="text-xs">
                    {detalle.empresa.color || "—"}
                  </code>
                </div>
              </div>
            </div>

            {/* Plan + override + métricas */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500">Plan</div>
                <div className="font-medium">
                  {detalle.empresa.plan?.nombre || "—"}
                </div>
                <dl className="mt-2 text-sm space-y-1">
                  <div className="flex justify-between">
                    <dt>Cupo base</dt>
                    <dd>{fmtNumber(detalle.empresa.plan?.max_asesores)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Duración</dt>
                    <dd>
                      {detalle.empresa.plan?.duracion_dias
                        ? `${detalle.empresa.plan?.duracion_dias} días`
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Precio neto</dt>
                    <dd>{fmtMoney(detalle.empresa.plan?.precio ?? null)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500">Override</div>
                <dl className="mt-1 text-sm space-y-1">
                  <div className="flex justify-between">
                    <dt>Cupo override</dt>
                    <dd>{fmtNumber(detalle.empresa.override?.max_asesores_override)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Vigencia</dt>
                    <dd>
                      {fmtDateOnly(detalle.empresa.override?.fecha_inicio)} —{" "}
                      {fmtDateOnly(detalle.empresa.override?.fecha_fin)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Estado</dt>
                    <dd>
                      {detalle.empresa.override?.activo ? "Activo" : "—"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500">Métricas</div>
                <dl className="mt-1 text-sm space-y-1">
                  <div className="flex justify-between">
                    <dt>Asesores</dt>
                    <dd>{fmtNumber(detalle.metrics.asesores_count)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Informes (30 días)</dt>
                    <dd>{fmtNumber(detalle.metrics.informes_30d)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Última actividad</dt>
                    <dd>{fmtDate(detalle.metrics.ultima_actividad_at)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          {/* Listas (solo lectura) */}
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
                    {detalle.asesores.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                          Sin asesores.
                        </td>
                      </tr>
                    ) : (
                      detalle.asesores.map((a) => (
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
                          <td className="px-3 py-2">
                            {fmtDateOnly(a.fecha_creacion || null)}
                          </td>
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
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.informes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                          Sin informes recientes.
                        </td>
                      </tr>
                    ) : (
                      detalle.informes.map((inf) => (
                        <tr key={inf.id} className="border-t">
                          <td className="px-3 py-2">{inf.titulo || "Informe VAI"}</td>
                          <td className="px-3 py-2">{inf.estado}</td>
                          <td className="px-3 py-2">
                            {fmtDateOnly(inf.fecha_creacion)}
                          </td>
                          <td className="px-3 py-2">
                            <a
                              href={`/dashboard/empresa/informes/${inf.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              Ver
                            </a>
                          </td>
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
                    {detalle.acciones_soporte.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-gray-500">
                          Sin acciones registradas.
                        </td>
                      </tr>
                    ) : (
                      detalle.acciones_soporte.map((ac, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{ac.soporte || "—"}</td>
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
        </>
      )}
    </main>
  );
}
