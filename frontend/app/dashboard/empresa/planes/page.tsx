"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

const PLAN_IDS = {
  broker: "b68eba23-7352-4cf4-a20b-9a31d4a938cf",
  equipo: "d683cfa9-a7fc-46d6-948c-549b1cf81765",
  teamPro: "ab561d53-97d3-4247-a954-eb0419eb6cc6",
  enterprise: "33b41048-feaf-481d-bfff-f9eb46e96916",
} as const;

const COMMERCIAL_PLAN_IDS = Object.values(PLAN_IDS);
const ENTERPRISE_PLAN_ID = PLAN_IDS.enterprise;
const WHATSAPP_URL =
  "https://wa.me/5493513280798?text=Hola%2C%20quiero%20recibir%20una%20propuesta%20para%20el%20plan%20Enterprise%20de%20VAI%20Prop.";
const CONTACT_EMAIL = "info@vaiprop.com";

interface Plan {
  id: string;
  nombre: string;
  nombre_comercial?: string | null;
  max_asesores: number;
  precio?: number | string | null;
  duracion_dias?: number | null;
  incluye_valuador?: boolean | null;
  incluye_tracker?: boolean | null;
}

type BillingEstado = {
  plan?: {
    id?: string | null;
    nombre?: string | null;
    precioNetoFinal?: number | null;
    precioTotalFinal?: number | null;
    duracion_dias?: number | null;
    es_trial?: boolean | null;
  } | null;
  ciclo?: {
    inicio?: string | null;
    fin?: string | null;
    proximoCobro?: string | null;
  } | null;
  estado?: {
    suspendida?: boolean;
    plan_vencido?: boolean;
    requiere_seleccion_plan?: boolean;
    requiere_pago?: boolean;
    requiere_pago_inicial_acuerdo?: boolean;
  } | null;
  pricing?: {
    precio_neto_final?: number | null;
    precio_total_final?: number | null;
    modo_iva?: string | null;
    iva_pct?: number | null;
  } | null;
  cupos?: {
    max_asesores_final?: number | null;
  } | null;
  acuerdoComercial?: {
    activo: boolean;
    id?: string | null;
    plan_id?: string | null;
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
    precio_neto_final?: number | null;
    precio_total_final?: number | null;
    max_asesores_final?: number | null;
  } | null;
};

type PendingAction = {
  plan: Plan;
  kind: "change" | "agreement_locked";
};

function numberValue(value?: number | string | null): number {
  if (value == null) return 0;
  return typeof value === "string" ? Number(value) : value;
}

function fmtMoney(value?: number | string | null): string {
  const amount = numberValue(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Cordoba",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function daysRemaining(end?: string | null): number | null {
  if (!end) return null;
  const endMs = new Date(end).getTime();
  if (Number.isNaN(endMs)) return null;
  return Math.max(0, Math.ceil((endMs - Date.now()) / 86_400_000));
}

function planDescription(planId: string): string {
  switch (planId) {
    case PLAN_IDS.broker:
      return "Ideal para brokers independientes que trabajan con una única cuenta.";
    case PLAN_IDS.equipo:
      return "Para inmobiliarias y equipos pequeños que necesitan medir su operación.";
    case PLAN_IDS.teamPro:
      return "Pensado para equipos comerciales consolidados y en crecimiento.";
    case PLAN_IDS.enterprise:
      return "Condiciones, cupos e implementación personalizados mediante acuerdo comercial.";
    default:
      return "Acceso completo a VAI Prop.";
  }
}

function userAccessLabel(plan: Plan): string {
  if (plan.id === PLAN_IDS.broker) return "1 usuario total";
  if (plan.id === PLAN_IDS.equipo) return "Cuenta empresa + hasta 5 asesores";
  if (plan.id === PLAN_IDS.teamPro) return "Cuenta empresa + hasta 10 asesores";
  return "Cantidad de usuarios a medida";
}

const featureList = [
  "Valuación y tasación inmobiliaria",
  "Factibilidad constructiva y cálculo de PER",
  "Tracker, Analytics y rendimiento por asesor",
  "Agenda, propiedades, captaciones y cierres",
  "VAI Market Data y herramientas financieras",
];

export default function EmpresaPlanesPage() {
  const { user } = useAuth();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<BillingEstado | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  useEffect(() => {
    async function resolveEmpresa() {
      if (!user?.id) return;

      const { data: byUserId } = await supabase
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (byUserId?.id) {
        setEmpresaId(String(byUserId.id));
        return;
      }

      const { data: byLegacyId } = await supabase
        .from("empresas")
        .select("id")
        .eq("id_usuario", user.id)
        .maybeSingle();

      setEmpresaId(byLegacyId?.id ? String(byLegacyId.id) : null);
    }

    resolveEmpresa();
  }, [user?.id]);

  useEffect(() => {
    async function load() {
      if (!empresaId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [{ data: planRows, error: plansError }, billingResponse] =
          await Promise.all([
            supabase
              .from("planes")
              .select(
                "id, nombre, nombre_comercial, max_asesores, precio, duracion_dias, incluye_valuador, incluye_tracker"
              )
              .in("id", COMMERCIAL_PLAN_IDS),
            fetch(
              `/api/billing/estado?empresaId=${encodeURIComponent(empresaId)}`,
              { cache: "no-store" }
            ),
          ]);

        if (plansError) throw plansError;

        const json = await billingResponse.json().catch(() => null);
        if (!billingResponse.ok) {
          throw new Error(json?.error || "No se pudo cargar el estado de Billing.");
        }

        const order = new Map<string, number>([
          [PLAN_IDS.broker, 1],
          [PLAN_IDS.equipo, 2],
          [PLAN_IDS.teamPro, 3],
          [PLAN_IDS.enterprise, 4],
        ]);

        setPlans(
          ((planRows || []) as Plan[]).sort(
            (a, b) => (order.get(a.id) || 99) - (order.get(b.id) || 99)
          )
        );
        setBilling((json || null) as BillingEstado | null);
      } catch (error) {
        console.error(error);
        setMessage(
          error instanceof Error
            ? `❌ ${error.message}`
            : "❌ No se pudo cargar la información de planes."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [empresaId]);

  const agreementActive = Boolean(billing?.acuerdoComercial?.activo);
  const currentPlanId = billing?.plan?.id ?? null;
  const isTrial =
    billing?.plan?.es_trial === true ||
    (billing?.plan?.nombre || "").trim().toLowerCase() === "trial";
  const currentPlan = useMemo(
    () => plans.find((plan) => plan.id === currentPlanId) ?? null,
    [plans, currentPlanId]
  );
  const cycleEnd = billing?.ciclo?.fin ?? billing?.ciclo?.proximoCobro ?? null;
  const remaining = daysRemaining(cycleEnd);
  const cycleExpired = Boolean(billing?.estado?.plan_vencido);
  const currentNet =
    billing?.pricing?.precio_neto_final ??
    billing?.plan?.precioNetoFinal ??
    currentPlan?.precio ??
    null;
  const currentTotal =
    billing?.pricing?.precio_total_final ??
    billing?.plan?.precioTotalFinal ??
    (currentNet != null ? Math.round(numberValue(currentNet) * 1.21) : null);
  const currentMax =
    billing?.cupos?.max_asesores_final ?? currentPlan?.max_asesores ?? null;

  async function createCheckout(planId: string, immediateChange: boolean) {
    if (!empresaId) return;

    setProcessing(true);
    setMessage("Generando checkout seguro…");

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId,
          planId,
          changeMode: immediateChange ? "immediate" : "renewal",
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok || json?.error) {
        throw new Error(json?.error || "No se pudo generar el checkout.");
      }

      if (!json?.checkoutUrl) {
        throw new Error("Mercado Pago no devolvió un checkout válido.");
      }

      window.location.href = String(json.checkoutUrl);
    } catch (error) {
      setMessage(
        error instanceof Error ? `❌ ${error.message}` : "❌ Error inesperado."
      );
    } finally {
      setProcessing(false);
    }
  }

  function selectPlan(plan: Plan) {
    if (plan.id === ENTERPRISE_PLAN_ID && !agreementActive) {
      window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");
      return;
    }

    if (agreementActive && plan.id !== currentPlanId) {
      setPendingAction({ plan, kind: "agreement_locked" });
      return;
    }

    if (plan.id === currentPlanId) {
      createCheckout(plan.id, false);
      return;
    }

    setPendingAction({ plan, kind: "change" });
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-gray-500">
        Cargando planes…
      </div>
    );
  }

  return (
    <main className="space-y-6 p-4 md:p-6">
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-lg">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr] lg:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-400">
              Tu suscripción
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              {agreementActive
                ? "Tu acuerdo Enterprise"
                : (currentPlan || billing?.plan?.nombre)
                ? `Tu plan actual: ${currentPlan?.nombre || billing?.plan?.nombre}`
                : "Elegí el plan ideal para tu operación"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Todos los planes incluyen acceso completo a VAI Prop. Solo cambia la
              cantidad de asesores habilitados.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Info label="Plan" value={agreementActive ? "Enterprise" : currentPlan?.nombre || billing?.plan?.nombre || "Sin plan pago"} />
              <Info
                label="Cupo"
                value={
                  agreementActive
                    ? `${currentMax ?? "A medida"} asesores`
                    : currentPlanId === PLAN_IDS.broker
                    ? "1 usuario total"
                    : currentMax != null
                    ? `Hasta ${currentMax} asesores + cuenta empresa`
                    : "—"
                }
              />
              <Info label="Ciclo vigente desde" value={fmtDate(billing?.ciclo?.inicio)} />
              <Info label="Ciclo vigente hasta" value={fmtDate(cycleEnd)} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-slate-300">Importe mensual</div>
            <div className="mt-1 text-3xl font-bold text-amber-400">
              {fmtMoney(currentNet)}
            </div>
            <div className="text-sm text-slate-300">
              {billing?.pricing?.modo_iva === "no_aplica"
                ? "IVA no aplicable según condición vigente"
                : `Total con IVA: ${fmtMoney(currentTotal)}`}
            </div>

            <div className="mt-5 rounded-xl bg-black/20 p-3 text-sm text-slate-200">
              {cycleExpired
                ? "El ciclo se encuentra vencido. Podés regularizarlo ahora."
                : remaining != null
                ? `Tu ciclo conserva vigencia por ${remaining} día${remaining === 1 ? "" : "s"}.`
                : "La vigencia del ciclo se actualizará después de cada pago aprobado."}
            </div>

            {currentPlanId && !isTrial ? (
              <button
                type="button"
                disabled={processing}
                onClick={() => createCheckout(currentPlanId, false)}
                className="mt-4 w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
              >
                {processing
                  ? "Generando checkout…"
                  : cycleExpired
                  ? "Pagar nuevo ciclo"
                  : "Renovar plan actual"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          {message}
        </div>
      ) : null}

      {agreementActive ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-900">
          <h2 className="font-semibold">Acuerdo comercial vigente</h2>
          <p className="mt-1 text-sm leading-6">
            Esta cuenta tiene condiciones Enterprise personalizadas hasta el {" "}
            <strong>{fmtDate(billing?.acuerdoComercial?.fecha_fin)}</strong>. Para
            evitar una contratación cruzada, los demás planes quedan bloqueados
            mientras el acuerdo continúe activo.
          </p>
        </section>
      ) : null}

      <section>
        <div className="mb-5">
          <h2 className="text-2xl font-bold text-slate-900">Planes disponibles</h2>
          <p className="mt-1 text-sm text-slate-600">
            Todos los planes incluyen acceso completo a VAI Prop. Solo cambia la cantidad de usuarios habilitados.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-4">
          {plans.map((plan) => {
            const isEnterprise = plan.id === ENTERPRISE_PLAN_ID;
            const isCurrent = plan.id === currentPlanId;
            const net = numberValue(plan.precio);
            const total = Math.round(net * 1.21);
            const lockedByAgreement = agreementActive && !isCurrent;

            return (
              <article
                key={plan.id}
                className={`flex min-h-[520px] flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  isCurrent
                    ? "border-amber-400 ring-2 ring-amber-100"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{plan.nombre}</h3>
                    <p className="mt-1 text-sm text-slate-500">{planDescription(plan.id)}</p>
                  </div>
                  {isCurrent ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      Plan actual
                    </span>
                  ) : null}
                </div>

                <div className="mt-5">
                  {isEnterprise ? (
                    <>
                      <div className="text-3xl font-bold text-slate-900">Consultar</div>
                      <div className="mt-1 text-sm text-slate-500">Acuerdo comercial personalizado</div>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-slate-900">
                        {fmtMoney(net)}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        neto + IVA · Total {fmtMoney(total)}
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-5 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-800">
                  {userAccessLabel(plan)}
                </div>

                <ul className="mt-5 space-y-3 text-sm text-slate-700">
                  {featureList.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span className="mt-0.5 text-amber-500">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={processing}
                  onClick={() => selectPlan(plan)}
                  className={`mt-auto w-full rounded-xl px-4 py-3 text-sm font-semibold transition disabled:opacity-60 ${
                    isCurrent
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : lockedByAgreement
                      ? "bg-slate-200 text-slate-600 hover:bg-slate-300"
                      : isEnterprise
                      ? "border border-amber-500 bg-white text-amber-700 hover:bg-amber-50"
                      : "bg-amber-400 text-slate-950 hover:bg-amber-300"
                  }`}
                >
                  {isCurrent
                    ? cycleExpired
                      ? "Pagar nuevo ciclo"
                      : "Renovar plan"
                    : lockedByAgreement
                    ? "Consultar cambio"
                    : isEnterprise
                    ? "Solicitar propuesta"
                    : "Elegir plan"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {pendingAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            {pendingAction.kind === "agreement_locked" ? (
              <>
                <h2 className="text-xl font-bold text-slate-900">
                  Tenés un acuerdo Enterprise vigente
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Tu empresa cuenta con condiciones comerciales personalizadas y
                  no puede contratar {pendingAction.plan.nombre} mientras el acuerdo
                  continúe activo. Esto evita generar suscripciones cruzadas o perder
                  las condiciones negociadas.
                </p>
                <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
                  <div><strong>Plan:</strong> Enterprise</div>
                  <div><strong>Cupo:</strong> {currentMax ?? "A medida"} asesores</div>
                  <div><strong>Importe:</strong> {fmtMoney(currentTotal)}</div>
                  <div><strong>Vigencia:</strong> hasta {fmtDate(billing?.acuerdoComercial?.fecha_fin)}</div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPendingAction(null)}
                    className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Continuar con Enterprise
                  </button>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-800"
                  >
                    Contactar a VAI Prop
                  </a>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-slate-900">
                  Cambiar a {pendingAction.plan.nombre}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Tu plan actual conserva vigencia hasta el {fmtDate(cycleEnd)}. Si
                  continuás ahora, pagarás el valor mensual completo de {" "}
                  <strong>{pendingAction.plan.nombre}</strong> y el nuevo ciclo de 30
                  días comenzará cuando Mercado Pago confirme el pago.
                </p>
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  No se aplicará prorrateo, devolución ni traslado de días restantes.
                  El ciclo anterior finalizará al activarse el nuevo plan.
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => {
                      const planId = pendingAction.plan.id;
                      setPendingAction(null);
                      createCheckout(planId, true);
                    }}
                    className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                  >
                    Continuar al pago
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingAction(null)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        <strong>¿Necesitás ayuda?</strong> Escribinos a {" "}
        <a className="font-semibold text-blue-700 underline" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>{" "}
        o por {" "}
        <a className="font-semibold text-blue-700 underline" href={WHATSAPP_URL} target="_blank" rel="noreferrer">
          WhatsApp
        </a>.
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 font-semibold text-white">{value}</div>
    </div>
  );
}
