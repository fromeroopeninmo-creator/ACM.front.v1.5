"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";

type BillingEstado = {
  estado?: {
    empresaId?: string;
    tienePlan?: boolean;
    esTrial?: boolean;
    tipoPlan?: "core" | "combo" | "tracker_only" | "trial" | null;
    incluyeValuador?: boolean;
    incluyeTracker?: boolean;
    suspendida?: boolean;
    planVencido?: boolean;
    enPeriodoGracia?: boolean;
    diasRestantes?: number | null;
    diasGraciaRestantes?: number | null;

    // shape nuevo backend
    plan_vencido?: boolean;
    en_periodo_gracia?: boolean;
    dias_desde_vencimiento?: number | null;
    requiere_seleccion_plan?: boolean;
    requiere_pago?: boolean;
    requiere_pago_inicial_acuerdo?: boolean;
    suspendida_motivo?: string | null;
    tipo_cobertura_actual?: string | null;
  } | null;
  plan: {
    id: string;
    nombre: string;
    precioNeto?: number | null;
    totalConIVA?: number | null;
    tipo_plan?: string | null;
    incluye_valuador?: boolean | null;
    incluye_tracker?: boolean | null;
    es_trial?: boolean | null;
  } | null;
  ciclo: {
    inicio: string | null;
    fin: string | null;
    proximoCobro: string | null;
  } | null;
  suscripcion?: {
    estado:
      | "activa"
      | "suspendida"
      | "cancelada"
      | "pendiente";
    externoCustomerId: string | null;
    externoSubscriptionId: string | null;
  } | null;
  pricing?: {
    precio_total_final?: number | null;
    precio_neto_final?: number | null;
    pricing_source?: string | null;
  } | null;
  acuerdoComercial?: {
    activo?: boolean;
    id?: string | null;
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
    precio_total_final?: number | null;
    precio_neto_final?: number | null;
    max_asesores_final?: number | null;
  } | null;
  proximoPlan?: { id: string; nombre: string | null } | null;
  cambioProgramadoPara?: string | null;
};

/** Resuelve empresas.id para el usuario actual (dueño directo o perfil ligado) */
async function resolveEmpresaIdForUser(userId: string): Promise<string | null> {
  const { data: emp } = await supabase
    .from("empresas")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (emp?.id) return emp.id as string;

  const { data: prof } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", userId)
    .maybeSingle();

  return (prof?.empresa_id as string) ?? null;
}

function fmtMoney(value?: number | string | null) {
  if (value == null) return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!isFinite(n)) return "—";
  if (n === 0) return "$ 0";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDateOnly(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("es-AR");
}

function isAdministrativeSuspension(motivo?: string | null) {
  if (!motivo) return false;
  const m = motivo.toLowerCase();

  return (
    m.includes("administrativa") ||
    m.includes("uso indebido") ||
    m.includes("revisión") ||
    m.includes("revision") ||
    m.includes("soporte") ||
    m.includes("manual")
  );
}

export default function PlanStatusBanner() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [billingEstado, setBillingEstado] = useState<BillingEstado | null>(null);
  const [loading, setLoading] = useState(true);

  const planNombre = billingEstado?.plan?.nombre ?? null;
  const fechaFinIso =
    billingEstado?.ciclo?.fin ??
    billingEstado?.ciclo?.proximoCobro ??
    null;

  const fechaFin = useMemo(() => {
    if (!fechaFinIso) return null;
    const d = new Date(fechaFinIso);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [fechaFinIso]);

  const estado = billingEstado?.estado ?? null;
  const acuerdoActivo = !!billingEstado?.acuerdoComercial?.activo;

  const esTrial =
    !!billingEstado?.plan?.es_trial ||
    billingEstado?.plan?.tipo_plan === "trial" ||
    estado?.tipoPlan === "trial" ||
    estado?.tipo_cobertura_actual === "trial" ||
    planNombre === "Trial";

  const incluyeTracker =
    !!billingEstado?.plan?.incluye_tracker ||
    !!estado?.incluyeTracker ||
    esTrial;

  const requiereSeleccionPlan = !!estado?.requiere_seleccion_plan;
  const requierePagoInicialAcuerdo =
    !!estado?.requiere_pago_inicial_acuerdo;
  const requierePago = !!estado?.requiere_pago;

  const estaSuspendida = !!estado?.suspendida;
  const motivoSuspension = estado?.suspendida_motivo ?? null;
  const suspensionAdministrativa =
    isAdministrativeSuspension(motivoSuspension);

  const planVencido =
    !!estado?.planVencido || !!estado?.plan_vencido;

  const enGracia =
    !!estado?.enPeriodoGracia || !!estado?.en_periodo_gracia;

  const diasRestantes = useMemo(() => {
    if (typeof estado?.diasRestantes === "number") {
      return estado.diasRestantes;
    }

    if (
      typeof estado?.dias_desde_vencimiento === "number" &&
      planVencido
    ) {
      return -Math.abs(estado.dias_desde_vencimiento);
    }

    if (fechaFin) {
      const hoy = new Date();
      return Math.ceil(
        (fechaFin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    return null;
  }, [estado?.diasRestantes, estado?.dias_desde_vencimiento, fechaFin, planVencido]);

  const hoursLeftWithinGrace = useMemo(() => {
    if (!planVencido || !enGracia) return null;

    const diasDesdeVencimiento =
      typeof estado?.dias_desde_vencimiento === "number"
        ? Math.max(0, estado.dias_desde_vencimiento)
        : diasRestantes !== null && diasRestantes < 0
        ? Math.abs(diasRestantes)
        : 0;

    const h = 48 - diasDesdeVencimiento * 24;
    return Math.max(0, h);
  }, [diasRestantes, enGracia, estado?.dias_desde_vencimiento, planVencido]);

  const debeSuspender =
    requiereSeleccionPlan ||
    estaSuspendida ||
    (planVencido && !enGracia);

  const estaEnSuspendido =
    pathname?.includes("/dashboard/empresa/suspendido") ?? false;

  const estaEnPlanes =
    pathname?.includes("/dashboard/empresa/planes") ?? false;

  useEffect(() => {
    const fetchEstado = async () => {
      if (!user?.id) return;

      try {
        const empresaId =
          (user as any)?.empresa_id || (await resolveEmpresaIdForUser(user.id));

        const qs = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : "";
        const res = await fetch(`/api/billing/estado${qs}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          setLoading(false);
          return;
        }

        const data: BillingEstado = await res.json();
        setBillingEstado(data);

        const flags = data?.estado ?? null;

        const nextPlanVencido =
          !!flags?.planVencido || !!flags?.plan_vencido;

        const nextEnGracia =
          !!flags?.enPeriodoGracia || !!flags?.en_periodo_gracia;

        const nextDebeSuspender =
          !!flags?.requiere_seleccion_plan ||
          !!flags?.suspendida ||
          (nextPlanVencido && !nextEnGracia);

        const path = window.location.pathname;
        const enSuspendido = path.includes("/dashboard/empresa/suspendido");
        const enPlanes = path.includes("/dashboard/empresa/planes");

        /**
         * Importante:
         * Si la cuenta está suspendida pero el usuario está en /planes,
         * NO lo mandamos a /suspendido, porque justamente necesita poder pagar
         * o seleccionar plan.
         */
        if (nextDebeSuspender) {
          if (!enSuspendido && !enPlanes) {
            router.replace("/dashboard/empresa/suspendido");
            return;
          }
        } else if (enSuspendido) {
          router.replace("/dashboard/empresa");
          return;
        }
      } catch (err) {
        console.error("Error obteniendo estado de billing:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEstado();

    const t = setInterval(fetchEstado, 60000);
    return () => clearInterval(t);
  }, [user, router]);

  if (process.env.NODE_ENV === "development") {
    console.warn("🚧 Bypass de verificación de plan activo habilitado (solo en desarrollo)");
    return null;
  }

  if (loading) return null;

  if (!billingEstado?.estado && !billingEstado?.plan) return null;

  const importe =
    billingEstado?.pricing?.precio_total_final ??
    billingEstado?.acuerdoComercial?.precio_total_final ??
    billingEstado?.pricing?.precio_neto_final ??
    billingEstado?.acuerdoComercial?.precio_neto_final ??
    billingEstado?.plan?.totalConIVA ??
    billingEstado?.plan?.precioNeto ??
    null;

  const irAPlanes = () => {
    router.push("/dashboard/empresa/planes");
  };

  if (suspensionAdministrativa) {
    return (
      <div className="p-3 text-sm text-white bg-red-800 text-center font-medium">
        ⚠️ Tu cuenta se encuentra en revisión administrativa.
        {motivoSuspension ? (
          <>
            {" "}
            Motivo: <strong>{motivoSuspension}</strong>.
          </>
        ) : null}{" "}
        Si necesitás asistencia, comunicate con administración.
      </div>
    );
  }

  if (acuerdoActivo && requierePagoInicialAcuerdo) {
    return (
      <div className="p-3 text-sm text-white bg-red-700 text-center font-medium">
        ⚠️ Tu empresa posee un acuerdo comercial vigente, pero el ciclo mensual
        está pendiente de regularización.
        {importe != null ? (
          <>
            {" "}
            Importe: <strong>{fmtMoney(importe)}</strong>.
          </>
        ) : null}{" "}
        {fechaFinIso ? (
          <>
            Vencimiento: <strong>{fmtDateOnly(fechaFinIso)}</strong>.
          </>
        ) : null}{" "}
        {!estaEnPlanes ? (
          <button
            type="button"
            onClick={irAPlanes}
            className="underline hover:text-blue-100 ml-1"
          >
            Regularizar pago
          </button>
        ) : null}
      </div>
    );
  }

  if (requiereSeleccionPlan || (esTrial && planVencido && !enGracia)) {
    return (
      <div className="p-3 text-sm text-white bg-red-700 text-center font-medium">
        ⚠️ Tu período de prueba finalizó. Para continuar utilizando la app,
        debés seleccionar y pagar un plan.{" "}
        {!estaEnPlanes ? (
          <button
            type="button"
            onClick={irAPlanes}
            className="underline hover:text-blue-100 ml-1"
          >
            Seleccionar plan
          </button>
        ) : null}
      </div>
    );
  }

  if (requierePago || (planNombre && !esTrial && planVencido && !enGracia)) {
    return (
      <div className="p-3 text-sm text-white bg-red-700 text-center font-medium">
        ⚠️ Tu suscripción <strong>{planNombre}</strong> se encuentra vencida.
        Para restablecer el acceso, regularizá el pago del ciclo actual.{" "}
        {!estaEnPlanes ? (
          <button
            type="button"
            onClick={irAPlanes}
            className="underline hover:text-blue-100 ml-1"
          >
            Ir a pagar
          </button>
        ) : null}
      </div>
    );
  }

  if (esTrial && diasRestantes !== null && diasRestantes >= 0) {
    return (
      <div
        className={`p-3 text-sm text-white font-medium text-center ${
          diasRestantes <= 2 ? "bg-red-600" : "bg-yellow-500"
        }`}
      >
        🕒 Tu plan <strong>{planNombre ?? "Trial"}</strong> vence en{" "}
        <strong>
          {diasRestantes} día{diasRestantes !== 1 ? "s" : ""}
        </strong>{" "}
        ({fechaFin?.toLocaleDateString("es-AR")}).{" "}
        {!estaEnPlanes ? (
          <button
            type="button"
            onClick={irAPlanes}
            className="underline hover:text-blue-100 ml-1"
          >
            Actualizá tu plan
          </button>
        ) : null}
      </div>
    );
  }

  if (
    planNombre &&
    !esTrial &&
    planVencido &&
    enGracia
  ) {
    return (
      <div className="p-3 text-sm text-white bg-red-700 text-center font-medium">
        ⚠️ Tu plan <strong>{planNombre}</strong> se encuentra vencido. Por favor
        regularizá tu pago dentro de las próximas{" "}
        <strong>{hoursLeftWithinGrace ?? 0} horas</strong> para evitar la suspensión
        del servicio.{" "}
        {!estaEnPlanes ? (
          <button
            type="button"
            onClick={irAPlanes}
            className="underline hover:text-blue-100 ml-1"
          >
            Ir al portal de pago
          </button>
        ) : null}
      </div>
    );
  }

  if (acuerdoActivo && planNombre) {
    return (
      <div className="p-3 text-sm text-white bg-blue-700 text-center font-medium">
        🤝 Acuerdo comercial vigente — Plan actual:{" "}
        <strong>{planNombre}</strong>
        {importe != null ? (
          <>
            {" "}
            — Importe mensual: <strong>{fmtMoney(importe)}</strong>
          </>
        ) : null}
        {fechaFinIso ? (
          <>
            {" "}
            — Vigente hasta {fmtDateOnly(fechaFinIso)}
          </>
        ) : null}
        .
      </div>
    );
  }

  if (planNombre && !esTrial && diasRestantes !== null && diasRestantes >= 0) {
    return (
      <div className="p-3 text-sm text-white bg-blue-600 text-center font-medium">
        <div>
          💼 Plan actual: <strong>{planNombre}</strong> — Vigente hasta{" "}
          {fechaFin?.toLocaleDateString("es-AR")}.
        </div>

        {incluyeTracker === false && (
          <div className="mt-1 text-xs sm:text-sm">
            📊 Para usar <strong>Business Tracker</strong> y{" "}
            <strong>Business Analytics</strong> necesitás un plan{" "}
            <strong>Full</strong> o <strong>Business Tracker</strong>.{" "}
            {!estaEnPlanes ? (
              <button
                type="button"
                onClick={irAPlanes}
                className="underline font-semibold hover:text-blue-100 ml-1"
              >
                Ver planes disponibles
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  if (estaSuspendida && motivoSuspension) {
    return (
      <div className="p-3 text-sm text-white bg-red-700 text-center font-medium">
        ⚠️ Cuenta suspendida: <strong>{motivoSuspension}</strong>.{" "}
        {!estaEnPlanes && !estaEnSuspendido ? (
          <button
            type="button"
            onClick={irAPlanes}
            className="underline hover:text-blue-100 ml-1"
          >
            Ver estado del plan
          </button>
        ) : null}
      </div>
    );
  }

  return null;
}
