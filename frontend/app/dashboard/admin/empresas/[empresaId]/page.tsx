import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import { getEmpresaDetalle, type EmpresaDetalle } from "#lib/soporteApi";
import AcuerdoComercialAdminCard from "./AcuerdoComercialAdminCard";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { empresaId: string };
  searchParams?: {
    modal?: string;
  };
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

function fmtModoIVA(v?: string | null) {
  switch (v) {
    case "sumar_al_neto":
      return "Sumar al neto";
    case "incluido_en_precio":
      return "Incluido en precio";
    case "no_aplica":
      return "No aplica";
    default:
      return "—";
  }
}

function badgeClass(active?: boolean | null) {
  return active
    ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700"
    : "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700";
}

function statusBadgeClass(kind: "ok" | "warn" | "danger" | "neutral") {
  switch (kind) {
    case "ok":
      return "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700";
    case "warn":
      return "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700";
    case "danger":
      return "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-red-100 text-red-700";
    default:
      return "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-700";
  }
}

function buildModalHref(modal: string) {
  return `?modal=${encodeURIComponent(modal)}`;
}

export default async function AdminEmpresaDetallePage({
  params,
  searchParams,
}: PageProps) {
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

  const cookieHeader = buildCookieHeader();

  let detalle: EmpresaDetalle | null = null;
  let errorMsg: string | null = null;
  try {
    detalle = await getEmpresaDetalle(params.empresaId, {
      headers: { cookie: cookieHeader },
    });
  } catch (e: any) {
    errorMsg = e?.message || "Error al cargar el detalle de la empresa.";
  }

  const plan =
    (detalle as any)?.plan ??
    (detalle as any)?.empresa?.plan ??
    null;

  const override =
    (detalle as any)?.override ??
    (detalle as any)?.empresa?.override ??
    null;

  const acuerdo =
    (detalle as any)?.acuerdoComercial ??
    (detalle as any)?.acuerdo_comercial ??
    null;

  const estado = (detalle as any)?.estado ?? null;

  const suspendida =
    typeof estado?.empresa_suspendida === "boolean"
      ? estado.empresa_suspendida
      : !!((detalle as any)?.empresa?.suspendida);

  const suspendidaMotivo =
    estado?.suspension_motivo ??
    (detalle as any)?.empresa?.suspension_motivo ??
    null;

  const suspendidaAt =
    estado?.suspendida_at ??
    (detalle as any)?.empresa?.suspendida_at ??
    null;

  const cicloInicio =
    plan?.fechaInicio ??
    override?.fecha_inicio ??
    null;

  const cicloFin =
    plan?.fechaFin ??
    override?.fecha_fin ??
    null;

  const now = new Date();
  const finDate =
    cicloFin && !Number.isNaN(new Date(cicloFin).getTime())
      ? new Date(cicloFin)
      : null;

  const planOperativoActivo =
    typeof estado?.plan_operativo_activo === "boolean"
      ? estado.plan_operativo_activo
      : !!plan;

  const estadoPlanRaw =
    estado?.estado_plan ??
    (planOperativoActivo
      ? finDate && finDate.getTime() < now.getTime()
        ? "vencido"
        : "vigente"
      : "sin_plan");

  const estadoPlanLabel =
    estadoPlanRaw === "sin_plan"
      ? "Sin plan"
      : estadoPlanRaw === "vencido"
      ? "Vencido"
      : "Vigente";

  const estadoPlanKind =
    estadoPlanRaw === "vigente"
      ? "ok"
      : estadoPlanRaw === "vencido"
      ? "danger"
      : "warn";

  const planVencido = estadoPlanRaw === "vencido";
  const esTrial = !!plan?.es_trial;
  const tieneAcuerdoActivo = !!acuerdo?.activo;

  const modal = searchParams?.modal ?? null;
  const acuerdoModalOpen = modal === "acuerdo";
  const planModalOpen = modal === "plan";

  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Detalle de empresa (Admin)</h1>
          <p className="text-sm text-gray-500">
            Vista administrativa con resumen comercial, acuerdo comercial e historial operativo.
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
          <section className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500 mb-1">Estado empresa</div>
                <div className="flex flex-wrap gap-2">
                  <span className={statusBadgeClass(suspendida ? "danger" : "ok")}>
                    {suspendida ? "Suspendida" : "Activa"}
                  </span>
                  {suspendida && suspendidaMotivo ? (
                    <span className={statusBadgeClass("warn")}>
                      {suspendidaMotivo}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  {suspendidaAt ? `Desde: ${fmtDate(suspendidaAt)}` : "—"}
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500 mb-1">Estado plan</div>
                <div className="flex flex-wrap gap-2">
                  <span className={statusBadgeClass(estadoPlanKind as any)}>
                    {estadoPlanLabel}
                  </span>
                  {esTrial ? (
                    <span className={statusBadgeClass("warn")}>Trial</span>
                  ) : (
                    <span className={statusBadgeClass("neutral")}>Pago / comercial</span>
                  )}
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Vence: {fmtDateOnly(cicloFin)}
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500 mb-1">Acuerdo comercial</div>
                <div className="flex flex-wrap gap-2">
                  <span className={statusBadgeClass(tieneAcuerdoActivo ? "ok" : "neutral")}>
                    {tieneAcuerdoActivo ? "Activo" : "Sin acuerdo"}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Vigencia: {fmtDateOnly(acuerdo?.fechaInicio ?? acuerdo?.fecha_inicio)} — {fmtDateOnly(acuerdo?.fechaFin ?? acuerdo?.fecha_fin)}
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500 mb-1">Plan operativo actual</div>
                <div className="font-medium">{plan?.nombre || "—"}</div>
                <div className="mt-2 text-sm text-gray-600">
                  Cupo final: {fmtNumber(plan?.maxAsesoresFinal ?? plan?.max_asesores_final ?? plan?.maxAsesores ?? plan?.max_asesores ?? null)}
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500 mb-1">Última actividad</div>
                <div className="font-medium">{fmtDate((detalle as any).metrics?.ultima_actividad_at)}</div>
                <div className="mt-2 text-sm text-gray-600">
                  Informes 30 días: {fmtNumber((detalle as any).metrics?.informes_30d)}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl border flex items-center justify-center overflow-hidden bg-white dark:bg-neutral-950">
                {(detalle as any).empresa.logoUrl || (detalle as any).empresa.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={(detalle as any).empresa.logoUrl || (detalle as any).empresa.logo_url}
                    alt="Logo empresa"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-gray-400">Sin logo</span>
                )}
              </div>

              <div className="flex-1">
                <h2 className="text-lg font-semibold">
                  {(detalle as any).empresa.nombre || (detalle as any).empresa.razon_social}
                </h2>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  <div>CUIT: {(detalle as any).empresa.cuit || "—"}</div>
                  <div>
                    {[
                      (detalle as any).empresa.direccion,
                      (detalle as any).empresa.localidad,
                      (detalle as any).empresa.provincia,
                    ]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </div>
                  <div>Condición fiscal: {(detalle as any).empresa.condicion_fiscal || "—"}</div>
                  <div>Teléfono: {(detalle as any).empresa.telefono || "—"}</div>
                </div>
              </div>

              <div className="shrink-0">
                <div className="text-xs text-gray-500 mb-1">Color corporativo</div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-md border"
                    style={{
                      backgroundColor: (detalle as any).empresa.color || "#e5e7eb",
                    }}
                    title={(detalle as any).empresa.color || "—"}
                  />
                  <code className="text-xs">
                    {(detalle as any).empresa.color || "—"}
                  </code>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500">Plan</div>
                <div className="font-medium">
                  {plan?.nombre || "—"}
                </div>
                <dl className="mt-2 text-sm space-y-1">
                  <div className="flex justify-between gap-3">
                    <dt>Trial</dt>
                    <dd>{plan?.es_trial ? "Sí" : "No"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Ciclo</dt>
                    <dd>
                      {fmtDateOnly(cicloInicio)} — {fmtDateOnly(cicloFin)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Cupo base</dt>
                    <dd>{fmtNumber(plan?.maxAsesores ?? plan?.max_asesores)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Cupo final</dt>
                    <dd>{fmtNumber(plan?.maxAsesoresFinal ?? plan?.max_asesores_final ?? plan?.maxAsesores ?? plan?.max_asesores)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Duración</dt>
                    <dd>
                      {plan?.duracionDias || plan?.duracion_dias
                        ? `${plan?.duracionDias ?? plan?.duracion_dias} días`
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Precio base neto</dt>
                    <dd>{fmtMoney(plan?.precioBaseNeto ?? plan?.precio_base_neto ?? plan?.precio ?? null)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Precio neto final</dt>
                    <dd>{fmtMoney(plan?.precioNetoFinal ?? plan?.precio_neto_final ?? null)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Total final</dt>
                    <dd>{fmtMoney(plan?.precioTotalFinal ?? plan?.precio_total_final ?? null)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>IVA</dt>
                    <dd>{fmtModoIVA(plan?.ivaModo ?? plan?.iva_modo)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>IVA %</dt>
                    <dd>{(plan?.ivaPct ?? plan?.iva_pct) != null ? `${plan?.ivaPct ?? plan?.iva_pct}%` : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>IVA importe</dt>
                    <dd>{fmtMoney(plan?.ivaImporte ?? plan?.iva_importe ?? null)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Extra por asesor</dt>
                    <dd>
                      {fmtMoney(
                        plan?.precioExtraPorAsesorFinal ??
                          plan?.precio_extra_por_asesor_final ??
                          plan?.precioExtraPorAsesorPlan ??
                          plan?.precio_extra_por_asesor_plan ??
                          null
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Origen pricing</dt>
                    <dd className="text-right break-all">{plan?.pricingSource ?? plan?.pricing_source || "—"}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500">Override</div>
                <dl className="mt-1 text-sm space-y-1">
                  <div className="flex justify-between gap-3">
                    <dt>Cupo override</dt>
                    <dd>{fmtNumber(override?.max_asesores_override ?? override?.maxAsesoresOverride)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Vigencia</dt>
                    <dd>
                      {fmtDateOnly(override?.fecha_inicio ?? override?.fechaInicio)} —{" "}
                      {fmtDateOnly(override?.fecha_fin ?? override?.fechaFin)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Estado</dt>
                    <dd>{override?.activo ? "Activo" : "—"}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500">Métricas</div>
                <dl className="mt-1 text-sm space-y-1">
                  <div className="flex justify-between gap-3">
                    <dt>Asesores</dt>
                    <dd>{fmtNumber((detalle as any).metrics?.asesores_count)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Informes (30 días)</dt>
                    <dd>{fmtNumber((detalle as any).metrics?.informes_30d)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Última actividad</dt>
                    <dd>{fmtDate((detalle as any).metrics?.ultima_actividad_at)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border p-4 space-y-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Plan actual</div>
                  <div className="font-medium">{plan?.nombre || "—"}</div>
                  <div className="mt-1 text-sm text-gray-600">
                    Cupo final: {fmtNumber(plan?.maxAsesoresFinal ?? plan?.max_asesores_final ?? plan?.maxAsesores ?? plan?.max_asesores ?? null)}
                  </div>
                  <div className="mt-3">
                    <a
                      href={buildModalHref("plan")}
                      className="inline-flex items-center rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800"
                    >
                      Cambiar Plan
                    </a>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Esta acción va a quedar separada del acuerdo comercial. En el próximo ajuste movemos el selector de plan fuera de la card del acuerdo.
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-gray-500">Acuerdo Comercial</div>
                    <span className={badgeClass(!!acuerdo?.activo)}>
                      {acuerdo?.activo ? "Activo" : "Sin acuerdo"}
                    </span>
                  </div>

                  {!acuerdo ? (
                    <div className="mt-3 text-sm text-gray-500">
                      Esta empresa no tiene un acuerdo comercial activo.
                    </div>
                  ) : (
                    <dl className="mt-2 text-sm space-y-1">
                      <div className="flex justify-between gap-3">
                        <dt>Plan acuerdo</dt>
                        <dd className="text-right break-all">{acuerdo.plan_id || acuerdo.planId || "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Tipo</dt>
                        <dd className="text-right break-all">{acuerdo.tipo || "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Precio base neto</dt>
                        <dd>{fmtMoney(acuerdo.precioBaseNeto ?? acuerdo.precio_base_neto ?? null)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Precio neto final</dt>
                        <dd>{fmtMoney(acuerdo.precioNetoFinal ?? acuerdo.precio_neto_final ?? null)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Total final</dt>
                        <dd>{fmtMoney(acuerdo.precioTotalFinal ?? acuerdo.precio_total_final ?? null)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Modo IVA</dt>
                        <dd>{fmtModoIVA(acuerdo.modoIva ?? acuerdo.modo_iva)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>IVA %</dt>
                        <dd>{(acuerdo.ivaPct ?? acuerdo.iva_pct) != null ? `${acuerdo.ivaPct ?? acuerdo.iva_pct}%` : "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>IVA importe</dt>
                        <dd>{fmtMoney(acuerdo.ivaImporte ?? acuerdo.iva_importe ?? null)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Cupo plan</dt>
                        <dd>{fmtNumber(acuerdo.maxAsesoresPlan ?? acuerdo.max_asesores_plan ?? null)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Cupo final</dt>
                        <dd>{fmtNumber(acuerdo.maxAsesoresFinal ?? acuerdo.max_asesores_final ?? null)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Extra por asesor</dt>
                        <dd>{fmtMoney(acuerdo.precioExtraPorAsesorFinal ?? acuerdo.precio_extra_por_asesor_final ?? null)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Origen pricing</dt>
                        <dd className="text-right break-all">{acuerdo.pricingSource ?? acuerdo.pricing_source || "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Vigencia</dt>
                        <dd>
                          {fmtDateOnly(acuerdo.fechaInicio ?? acuerdo.fecha_inicio)} — {fmtDateOnly(acuerdo.fechaFin ?? acuerdo.fecha_fin)}
                        </dd>
                      </div>
                    </dl>
                  )}

                  <div className="mt-4">
                    <a
                      href={buildModalHref("acuerdo")}
                      className="inline-flex items-center rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800"
                    >
                      {acuerdo?.activo ? "Editar Acuerdo Comercial" : "Crear Acuerdo Comercial"}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

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
                    {(detalle as any).asesores.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                          Sin asesores.
                        </td>
                      </tr>
                    ) : (
                      (detalle as any).asesores.map((a: any) => (
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
                    {(detalle as any).informes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                          Sin informes recientes.
                        </td>
                      </tr>
                    ) : (
                      (detalle as any).informes.map((inf: any) => (
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
                    {(detalle as any).ultimasAccionesSoporte.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-gray-500">
                          Sin acciones registradas.
                        </td>
                      </tr>
                    ) : (
                      (detalle as any).ultimasAccionesSoporte.map((ac: any, idx: number) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{ac.soporteId || "—"}</td>
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

          {acuerdoModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <a
                href={`/dashboard/admin/empresas/${encodeURIComponent(params.empresaId)}`}
                aria-label="Cerrar modal"
                className="absolute inset-0 bg-black/50"
              />
              <div className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-auto rounded-2xl border bg-white shadow-2xl dark:bg-neutral-950">
                <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white px-4 py-3 dark:bg-neutral-950">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {acuerdo?.activo ? "Editar Acuerdo Comercial" : "Crear Acuerdo Comercial"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Configurá precio, IVA, vigencia y demás parámetros comerciales.
                    </p>
                  </div>
                  <a
                    href={`/dashboard/admin/empresas/${encodeURIComponent(params.empresaId)}`}
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800"
                  >
                    Cerrar
                  </a>
                </div>
                <div className="p-4">
                  <AcuerdoComercialAdminCard
                    empresaId={params.empresaId}
                    acuerdoActual={acuerdo}
                  />
                </div>
              </div>
            </div>
          )}

          {planModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <a
                href={`/dashboard/admin/empresas/${encodeURIComponent(params.empresaId)}`}
                aria-label="Cerrar modal"
                className="absolute inset-0 bg-black/50"
              />
              <div className="relative z-10 w-full max-w-3xl rounded-2xl border bg-white shadow-2xl dark:bg-neutral-950">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                  <div>
                    <h3 className="text-lg font-semibold">Cambiar Plan</h3>
                    <p className="text-sm text-gray-500">
                      Esta acción queda separada del acuerdo comercial. En el próximo ajuste movemos el selector de plan a un componente independiente.
                    </p>
                  </div>
                  <a
                    href={`/dashboard/admin/empresas/${encodeURIComponent(params.empresaId)}`}
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800"
                  >
                    Cerrar
                  </a>
                </div>
                <div className="p-4">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    El layout ya quedó preparado para separar “Cambiar Plan” de “Acuerdo Comercial”.
                    Para que el selector de plan deje de aparecer dentro del acuerdo y pase a esta ventana,
                    el siguiente archivo a corregir es <strong>AcuerdoComercialAdminCard.tsx</strong>.
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border p-3">
                      <div className="text-xs text-gray-500 mb-1">Plan actual</div>
                      <div className="font-medium">{plan?.nombre || "—"}</div>
                    </div>
                    <div className="rounded-xl border p-3">
                      <div className="text-xs text-gray-500 mb-1">Cupo final</div>
                      <div className="font-medium">
                        {fmtNumber(plan?.maxAsesoresFinal ?? plan?.max_asesores_final ?? plan?.maxAsesores ?? plan?.max_asesores ?? null)}
                      </div>
                    </div>
                    <div className="rounded-xl border p-3">
                      <div className="text-xs text-gray-500 mb-1">Ciclo actual</div>
                      <div className="font-medium">
                        {fmtDateOnly(cicloInicio)} — {fmtDateOnly(cicloFin)}
                      </div>
                    </div>
                    <div className="rounded-xl border p-3">
                      <div className="text-xs text-gray-500 mb-1">Estado</div>
                      <div className="font-medium">
                        {estadoPlanLabel}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
