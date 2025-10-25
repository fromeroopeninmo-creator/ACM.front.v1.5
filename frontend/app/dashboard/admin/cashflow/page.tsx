// frontend/app/dashboard/admin/cashflow/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import CashflowClient from "./CashflowClient";

export const dynamic = "force-dynamic";

/* ===================== Helpers ===================== */
function pad2(n: number) { return String(n).padStart(2, "0"); }
function currentMonthRange(): { desde: string; hasta: string; label: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const last  = new Date(Date.UTC(y, m + 1, 0));
  const desde = `${first.getUTCFullYear()}-${pad2(first.getUTCMonth()+1)}-${pad2(first.getUTCDate())}`;
  const hasta = `${last.getUTCFullYear()}-${pad2(last.getUTCMonth()+1)}-${pad2(last.getUTCDate())}`;
  const label = `${pad2(first.getUTCMonth()+1)}/${first.getUTCFullYear()}`;
  return { desde, hasta, label };
}
function fmtNumber(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR").format(n);
}
function fmtMoney(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}
function fmtDateISO(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(d);
}
function buildCookieHeader(): string {
  const jar = cookies();
  const all = jar.getAll();
  if (!all?.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}
function getBaseUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL;
  if (envUrl) return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  return "http://localhost:3000";
}

/* ===================== Tipos mínimos ===================== */
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

/* =================================================== */
/*                      PAGE (SSR)                     */
/* =================================================== */
export default async function AdminCashflowPage() {
  /* ---------- 1) Guard de sesión + rol ---------- */
  const supa = supabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supa
    .from("profiles").select("id, role").eq("id", user.id).maybeSingle();

  const role = profile?.role || (user.user_metadata as any)?.role || null;
  const isAdmin = role === "super_admin" || role === "super_admin_root";
  if (!isAdmin) {
    switch (role) {
      case "soporte": redirect("/dashboard/soporte");
      case "empresa": redirect("/dashboard/empresa");
      case "asesor" : redirect("/dashboard/asesor");
      default: redirect("/");
    }
  }

  /* ---------- 2) Rango + cookie + base ---------- */
  const { desde, hasta, label } = currentMonthRange();
  const cookieHeader = buildCookieHeader();
  const base = getBaseUrl();

  // =========================================================
  // ⚠ Solución definitiva anti-Digest:
  // No hacemos fetch SSR. Dejamos TODO al cliente.
  // =========================================================
  const USE_CLIENT_ONLY = true;

  /* ---------- 3) (Desactivado) SSR fetch de KPIs ---------- */
  let kpis: CashflowKpisResponse | null = null;
  let errorMsg: string | null = null;

  if (!USE_CLIENT_ONLY) {
    try {
      const url = `${base}/api/admin/cashflow/kpis?desde=${desde}&hasta=${hasta}`;
      const headers: Record<string, string> = {};
      if (cookieHeader) headers.cookie = cookieHeader;

      const res = await fetch(url, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`GET ${url} → ${res.status} ${res.statusText} ${body}`.trim());
      }
      kpis = (await res.json()) as CashflowKpisResponse;
    } catch (e: any) {
      errorMsg = e?.message || "Error al cargar KPIs de Cashflow.";
    }
  }

  /* ---------- 4) Datos iniciales para tablas (placeholder, sin tocar endpoints hijos aún) ---------- */
  const movs = { items: [] as any[], page: 1, pageSize: 20, total: 0 };
  const subs = { items: [] as any[], page: 1, pageSize: 20, total: 0 };

  /* ---------- 5) Render ---------- */
  return (
    <main className="p-4 md:p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl md:text-2xl font-semibold">Cashflow / Pagos</h1>
        <p className="text-sm text-gray-500">
          KPIs y movimientos del período <strong>{label}</strong>.
        </p>
      </header>

      {USE_CLIENT_ONLY ? (
        // ================= Cliente (fetch en el browser) =================
        <CashflowClient />
      ) : (
        // ================= Render SSR ORIGINAL (con KPIs SSR) =================
        <>
          {errorMsg ? (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              {errorMsg}
            </section>
          ) : (
            <>
              {/* =================== KPIs =================== */}
              <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
                  <div className="text-xs text-gray-500">MRR (neto)</div>
                  <div className="text-2xl font-semibold mt-1">{fmtMoney(kpis?.mrr_neto ?? 0)}</div>
                  <div className="text-xs text-gray-400 mt-1">Rango: {kpis?.rango?.desde} → {kpis?.rango?.hasta}</div>
                </div>
                <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
                  <div className="text-xs text-gray-500">Ingresos (neto) en el período</div>
                  <div className="text-2xl font-semibold mt-1">{fmtMoney(kpis?.ingresos_neto_total ?? 0)}</div>
                  <div className="text-xs text-gray-400 mt-1">Visual con IVA: {fmtMoney(kpis ? kpis.ingresos_con_iva : 0)}</div>
                </div>
                <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
                  <div className="text-xs text-gray-500">ARPU (neto)</div>
                  <div className="text-2xl font-semibold mt-1">{fmtMoney(kpis?.arpu_neto ?? 0)}</div>
                  <div className="text-xs text-gray-400 mt-1">Empresas activas: {fmtNumber(kpis?.empresas_activas ?? 0)}</div>
                </div>
                <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
                  <div className="text-xs text-gray-500">Cambios (mes)</div>
                  <div className="text-2xl font-semibold mt-1">{fmtNumber((kpis?.upgrades ?? 0) + (kpis?.downgrades ?? 0))}</div>
                  <div className="text-xs text-gray-400 mt-1">Up: {fmtNumber(kpis?.upgrades ?? 0)} · Down: {fmtNumber(kpis?.downgrades ?? 0)}</div>
                </div>
              </section>

              {/* ================ Movimientos ================= */}
              <section className="rounded-2xl border bg-white dark:bg-neutral-900">
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="text-base font-semibold">Movimientos (primeros 20)</h2>
                  <a href="#" className="text-sm text-blue-600 hover:underline" onClick={(e) => e.preventDefault()} aria-disabled title="En la siguiente iteración sumamos filtros y paginación interactiva">
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
                      {movs.items.length === 0 ? (
                        <tr>
                          <td className="px-4 py-4 text-gray-500" colSpan={8}>Sin movimientos en el período.</td>
                        </tr>
                      ) : (
                        movs.items.map((m: any) => (
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
                  Mostrando {fmtNumber(movs.items.length)} de {fmtNumber(movs.total)} movimientos (página {fmtNumber(movs.page)}).
                </div>
              </section>

              {/* ================ Suscripciones ================ */}
              <section className="rounded-2xl border bg-white dark:bg-neutral-900">
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="text-base font-semibold">Suscripciones (primeras 20)</h2>
                  <a href="#" className="text-sm text-blue-600 hover:underline" onClick={(e) => e.preventDefault()} aria-disabled title="En la siguiente iteración sumamos filtros y paginación interactiva">
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
                      {subs.items.length === 0 ? (
                        <tr>
                          <td className="px-4 py-4 text-gray-500" colSpan={9}>Sin suscripciones en el período.</td>
                        </tr>
                      ) : (
                        subs.items.map((s: any) => (
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
                              {s.cupo_excedido > 0 ? (<span className="text-red-600 font-medium">{fmtNumber(s.cupo_excedido)}</span>) : ("—")}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 text-xs text-gray-500 border-t">
                  Mostrando {fmtNumber(subs.items.length)} de {fmtNumber(subs.total)} suscripciones (página {fmtNumber(subs.page)}).
                </div>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
