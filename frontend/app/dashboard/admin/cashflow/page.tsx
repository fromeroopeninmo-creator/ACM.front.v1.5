// frontend/app/dashboard/admin/cashflow/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";

export const dynamic = "force-dynamic";

type CashflowKpisResponse = {
  rango: { desde: string; hasta: string };
  mrr_neto: number;
  ingresos_neto_total: number;
  ingresos_con_iva: number;
  arpu_neto: number;
  empresas_activas: number;
  churn_empresas: number;
  upgrades: number;
  downgrades: number;
};

type MovimientoItem = {
  id: string | null;
  fecha: string;
  empresa_id: string;
  empresa_nombre: string;
  tipo: "subscription" | "extra_asesor" | "ajuste";
  concepto: string | null;
  pasarela: string;
  moneda: string;
  monto_neto: number;
  iva_21: number;
  total_con_iva: number;
  estado: "pending" | "paid" | "failed" | "refunded";
  referencia_pasarela: string | null;
  metadata: Record<string, any>;
};

type MovimientosResponse = {
  items: MovimientoItem[];
  page: number;
  pageSize: number;
  total: number;
};

type SuscripcionItem = {
  empresa_id: string;
  empresa_nombre: string;
  plan_id: string;
  plan_nombre: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activo: boolean;
  max_asesores_plan: number;
  max_asesores_override: number | null;
  asesores_utilizados: number;
  cupo_excedido: number;
};

type SuscripcionesResponse = {
  items: SuscripcionItem[];
  page: number;
  pageSize: number;
  total: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function currentMonthRange(): { desde: string; hasta: string; label: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(y, m + 1, 0));
  const desde = `${first.getUTCFullYear()}-${pad2(first.getUTCMonth() + 1)}-${pad2(first.getUTCDate())}`;
  const hasta = `${last.getUTCFullYear()}-${pad2(last.getUTCMonth() + 1)}-${pad2(last.getUTCDate())}`;
  const label = `${pad2(first.getUTCMonth() + 1)}/${first.getUTCFullYear()}`;
  return { desde, hasta, label };
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
function fmtDateISO(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
  }).format(d);
}

export default async function AdminCashflowPage() {
  // 1) Guard de sesión + rol
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

  // 2) SSR fetch (KPIs + primer page de movimientos y suscripciones) usando rutas relativas
  const { desde, hasta, label } = currentMonthRange();

  let kpis: CashflowKpisResponse | null = null;
  let movs: MovimientosResponse | null = null;
  let subs: SuscripcionesResponse | null = null;
  let errorMsg: string | null = null;

  try {
    const [resK, resM, resS] = await Promise.all([
      fetch(`/api/admin/cashflow/kpis?desde=${desde}&hasta=${hasta}`, {
        method: "GET",
        cache: "no-store",
      }),
      fetch(
        `/api/admin/cashflow/movimientos?desde=${desde}&hasta=${hasta}&page=1&pageSize=20`,
        { method: "GET", cache: "no-store" }
      ),
      fetch(
        `/api/admin/cashflow/suscripciones?desde=${desde}&hasta=${hasta}&estado=todos&page=1&pageSize=20`,
        { method: "GET", cache: "no-store" }
      ),
    ]);

    if (!resK.ok) throw new Error(`GET /cashflow/kpis → ${resK.status}`);
    if (!resM.ok) throw new Error(`GET /cashflow/movimientos → ${resM.status}`);
    if (!resS.ok) throw new Error(`GET /cashflow/suscripciones → ${resS.status}`);

    kpis = (await resK.json()) as CashflowKpisResponse;
    movs = (await resM.json()) as MovimientosResponse;
    subs = (await resS.json()) as SuscripcionesResponse;
  } catch (e: any) {
    errorMsg = e?.message || "Error al cargar datos de Cashflow.";
  }

  return (
    <main className="p-4 md:p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl md:text-2xl font-semibold">Cashflow / Pagos</h1>
        <p className="text-sm text-gray-500">
          KPIs y movimientos del período <strong>{label}</strong>.
        </p>
      </header>

      {errorMsg ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {errorMsg}
        </section>
      ) : (
        <>
          {/* KPIs */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
              <div className="text-xs text-gray-500">MRR (neto)</div>
              <div className="text-2xl font-semibold mt-1">
                {fmtMoney(kpis?.mrr_neto ?? 0)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Rango: {kpis?.rango?.desde} → {kpis?.rango?.hasta}
              </div>
            </div>
            <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
              <div className="text-xs text-gray-500">Ingresos (neto) en el período</div>
              <div className="text-2xl font-semibold mt-1">
                {fmtMoney(kpis?.ingresos_neto_total ?? 0)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Visual con IVA: {fmtMoney(kpis ? kpis.ingresos_con_iva : 0)}
              </div>
            </div>
            <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
              <div className="text-xs text-gray-500">ARPU (neto)</div>
              <div className="text-2xl font-semibold mt-1">
                {fmtMoney(kpis?.arpu_neto ?? 0)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Empresas activas: {fmtNumber(kpis?.empresas_activas ?? 0)}
              </div>
            </div>
            <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
              <div className="text-xs text-gray-500">Cambios (mes)</div>
              <div className="text-2xl font-semibold mt-1">
                {fmtNumber((kpis?.upgrades ?? 0) + (kpis?.downgrades ?? 0))}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Up: {fmtNumber(kpis?.upgrades ?? 0)} · Down: {fmtNumber(kpis?.downgrades ?? 0)}
              </div>
            </div>
          </section>

          {/* Tabla Movimientos */}
          <section className="rounded-2xl border bg-white dark:bg-neutral-900">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-base font-semibold">Movimientos (primeros 20)</h2>
              <a
                href="#"
                className="text-sm text-blue-600 hover:underline"
                onClick={(e) => e.preventDefault()}
                aria-disabled
                title="En la siguiente iteración sumamos filtros y paginación interactiva"
              >
                Próximamente: filtros & paginación
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Concepto</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Neto</th>
                    <th className="px-4 py-3 text-right">IVA 21%</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(movs?.items ?? []).length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-gray-500" colSpan={8}>
                        Sin movimientos en el período.
                      </td>
                    </tr>
                  ) : (
                    movs!.items.map((m) => (
                      <tr key={(m.id || `${m.empresa_id}-${m.fecha}-${m.tipo}`)} className="border-b last:border-0">
                        <td className="px-4 py-3">{fmtDateISO(m.fecha)}</td>
                        <td className="px-4 py-3">{m.empresa_nombre || "—"}</td>
                        <td className="px-4 py-3 capitalize">{m.tipo}</td>
                        <td className="px-4 py-3">{m.concepto || "—"}</td>
                        <td className="px-4 py-3 uppercase text-xs">{m.estado}</td>
                        <td className="px-4 py-3 text-right">{fmtMoney(m.monto_neto)}</td>
                        <td className="px-4 py-3 text-right">{fmtMoney(m.iva_21)}</td>
                        <td className="px-4 py-3 text-right">{fmtMoney(m.total_con_iva)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 text-xs text-gray-500 border-t">
              Mostrando {fmtNumber(movs?.items.length ?? 0)} de {fmtNumber(movs?.total ?? 0)} movimientos
              (página {fmtNumber(movs?.page ?? 1)}).
            </div>
          </section>

          {/* Tabla Suscripciones */}
          <section className="rounded-2xl border bg-white dark:bg-neutral-900">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-base font-semibold">Suscripciones (primeras 20)</h2>
              <a
                href="#"
                className="text-sm text-blue-600 hover:underline"
                onClick={(e) => e.preventDefault()}
                aria-disabled
                title="En la siguiente iteración sumamos filtros y paginación interactiva"
              >
                Próximamente: filtros & paginación
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Inicio</th>
                    <th className="px-4 py-3">Fin</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Cupo plan</th>
                    <th className="px-4 py-3 text-right">Override</th>
                    <th className="px-4 py-3 text-right">Usados</th>
                    <th className="px-4 py-3 text-right">Exceso</th>
                  </tr>
                </thead>
                <tbody>
                  {(subs?.items ?? []).length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-gray-500" colSpan={9}>
                        Sin suscripciones en el período.
                      </td>
                    </tr>
                  ) : (
                    subs!.items.map((s) => (
                      <tr key={`${s.empresa_id}-${s.plan_id}-${s.fecha_inicio || "null"}`} className="border-b last:border-0">
                        <td className="px-4 py-3">{s.empresa_nombre}</td>
                        <td className="px-4 py-3">{s.plan_nombre}</td>
                        <td className="px-4 py-3">{fmtDateISO(s.fecha_inicio)}</td>
                        <td className="px-4 py-3">{fmtDateISO(s.fecha_fin)}</td>
                        <td className="px-4 py-3">
                          {s.activo ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-xs">activo</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-xs">inactivo</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">{fmtNumber(s.max_asesores_plan)}</td>
                        <td className="px-4 py-3 text-right">{fmtNumber(s.max_asesores_override ?? 0)}</td>
                        <td className="px-4 py-3 text-right">{fmtNumber(s.asesores_utilizados)}</td>
                        <td className="px-4 py-3 text-right">
                          {s.cupo_excedido > 0 ? (
                            <span className="text-red-600 font-medium">{fmtNumber(s.cupo_excedido)}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 text-xs text-gray-500 border-t">
              Mostrando {fmtNumber(subs?.items.length ?? 0)} de {fmtNumber(subs?.total ?? 0)} suscripciones
              (página {fmtNumber(subs?.page ?? 1)}).
            </div>
          </section>
        </>
      )}
    </main>
  );
}
