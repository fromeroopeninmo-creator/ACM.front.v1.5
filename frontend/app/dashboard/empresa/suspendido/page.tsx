"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

type BillingEstado = {
  plan?: {
    id?: string | null;
    nombre?: string | null;
    tipo_plan?: string | null;
    es_trial?: boolean | null;
  } | null;
  ciclo?: {
    inicio?: string | null;
    fin?: string | null;
    proximoCobro?: string | null;
  } | null;
  estado?: {
    suspendida?: boolean;
    suspendida_motivo?: string | null;
    suspendida_at?: string | null;
    plan_vencido?: boolean;
    estado_plan?: string | null;
    tipo_cobertura_actual?: string | null;
    dias_desde_vencimiento?: number | null;
    en_periodo_gracia?: boolean;
    requiere_seleccion_plan?: boolean;
    requiere_pago?: boolean;
    requiere_pago_inicial_acuerdo?: boolean;
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
};

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

export default function CuentaSuspendidaPage() {
  const { user, loading } = useAuth();
  const { primaryColor, logoUrl } = useTheme();
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [billingEstado, setBillingEstado] = useState<BillingEstado | null>(null);

  const brandColor = useMemo(() => primaryColor || "#1e40af", [primaryColor]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user?.id) return;

    let cancelled = false;

    const checkPlan = async () => {
      try {
        const res = await fetch("/api/billing/estado", { cache: "no-store" });

        if (!res.ok) {
          console.error(
            "Error al consultar /api/billing/estado (suspendido):",
            res.status
          );
          if (!cancelled) setChecking(false);
          return;
        }

        const data: BillingEstado = await res.json();
        const estado = data?.estado;

        if (!estado) {
          if (!cancelled) setChecking(false);
          return;
        }

        const debeSuspender =
          !!estado.suspendida ||
          !!estado.requiere_seleccion_plan ||
          (!!estado.plan_vencido && !estado.en_periodo_gracia);

        if (!debeSuspender) {
          if (!cancelled) {
            router.replace("/dashboard/empresa");
          }
          return;
        }

        if (!cancelled) {
          setBillingEstado(data);
          setChecking(false);
        }
      } catch (err) {
        console.error("Error verificando estado de suscripción (suspendido):", err);
        if (!cancelled) setChecking(false);
      }
    };

    checkPlan();

    const t = setInterval(checkPlan, 45000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user, loading, router]);

  const estado = billingEstado?.estado ?? null;
  const acuerdoActivo = !!billingEstado?.acuerdoComercial?.activo;
  const esTrial =
    !!billingEstado?.plan?.es_trial ||
    billingEstado?.plan?.tipo_plan === "trial" ||
    estado?.tipo_cobertura_actual === "trial";

  const requierePagoAcuerdo = !!estado?.requiere_pago_inicial_acuerdo;
  const requiereSeleccionPlan = !!estado?.requiere_seleccion_plan;
  const requierePago = !!estado?.requiere_pago;
  const motivo = estado?.suspendida_motivo ?? null;
  const suspensionAdministrativa = isAdministrativeSuspension(motivo);

  const importe =
    billingEstado?.pricing?.precio_total_final ??
    billingEstado?.acuerdoComercial?.precio_total_final ??
    billingEstado?.pricing?.precio_neto_final ??
    billingEstado?.acuerdoComercial?.precio_neto_final ??
    null;

  const vencimiento =
    billingEstado?.ciclo?.proximoCobro ??
    billingEstado?.ciclo?.fin ??
    billingEstado?.acuerdoComercial?.fecha_fin ??
    null;

  const content = useMemo(() => {
    if (suspensionAdministrativa) {
      return {
        title: "Cuenta en Revisión",
        heading: "Tu cuenta se encuentra temporalmente suspendida",
        description:
          "La cuenta fue pausada por una revisión administrativa. Para restablecer el acceso, comunicate con administración o soporte.",
        button: "Ir al portal de planes",
        buttonAction: "planes" as const,
        showPaymentInfo: false,
      };
    }

    if (acuerdoActivo && requierePagoAcuerdo) {
      return {
        title: "Pago Mensual Pendiente",
        heading: "Suscripción mensual pendiente de regularización",
        description:
          "Tu empresa posee un acuerdo comercial vigente, pero el ciclo mensual se encuentra vencido o pendiente de pago. Para restablecer el acceso, regularizá el pago correspondiente al acuerdo.",
        button: "Regularizar pago",
        buttonAction: "planes" as const,
        showPaymentInfo: true,
      };
    }

    if (esTrial || requiereSeleccionPlan) {
      return {
        title: "Trial Vencido",
        heading: "Tu período de prueba finalizó",
        description:
          "El período de prueba gratuito terminó. Para continuar usando la plataforma, ingresá al portal de planes y seleccioná una suscripción vigente.",
        button: "Seleccionar plan",
        buttonAction: "planes" as const,
        showPaymentInfo: false,
      };
    }

    if (requierePago || estado?.plan_vencido) {
      return {
        title: "Pago Pendiente",
        heading: "Tu suscripción se encuentra vencida",
        description:
          "Tu cuenta se encuentra temporalmente suspendida por falta de pago del ciclo actual. Una vez regularizado el pago, el acceso será restablecido automáticamente.",
        button: "Ir a pagar",
        buttonAction: "planes" as const,
        showPaymentInfo: true,
      };
    }

    return {
      title: "Cuenta Suspendida",
      heading: "Cuenta suspendida temporalmente",
      description:
        motivo ||
        "Tu cuenta se encuentra temporalmente suspendida. Revisá el estado de tu plan o comunicate con administración si considerás que se trata de un error.",
      button: "Ir al portal de planes",
      buttonAction: "planes" as const,
      showPaymentInfo: false,
    };
  }, [
    acuerdoActivo,
    esTrial,
    estado?.plan_vencido,
    motivo,
    requierePago,
    requierePagoAcuerdo,
    requiereSeleccionPlan,
    suspensionAdministrativa,
  ]);

  const handlePrimaryAction = () => {
    router.push("/dashboard/empresa/planes");
  };

  if (checking) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Verificando estado de tu cuenta...
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50 text-center px-6 py-10">
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="h-14 mb-4 object-contain" />
      ) : (
        <h1 className="text-2xl font-bold mb-4" style={{ color: brandColor }}>
          VAI | Valuador de Activos Inmobiliarios
        </h1>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm w-full max-w-xl p-6">
        <div className="inline-flex items-center rounded-full bg-red-100 text-red-700 text-xs font-semibold px-3 py-1 mb-4">
          {content.title}
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-3">
          {content.heading}
        </h2>

        <p className="text-gray-600 max-w-md mx-auto mb-5">
          {content.description}
        </p>

        {motivo ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-left text-sm text-gray-700 mb-5">
            <div className="text-xs text-gray-500 mb-1">Motivo informado</div>
            <div className="font-medium">{motivo}</div>
          </div>
        ) : null}

        {content.showPaymentInfo ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-5">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs text-gray-500 mb-1">
                Importe a regularizar
              </div>
              <div className="font-semibold text-gray-800">
                {fmtMoney(importe)}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs text-gray-500 mb-1">
                Vencimiento
              </div>
              <div className="font-semibold text-gray-800">
                {fmtDateOnly(vencimiento)}
              </div>
            </div>
          </div>
        ) : null}

        {acuerdoActivo ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 mb-5">
            Esta cuenta posee un acuerdo comercial vigente. Los cambios de plan,
            cupo o condiciones comerciales deben gestionarse con administración.
          </div>
        ) : null}

        <button
          onClick={handlePrimaryAction}
          className="text-white px-6 py-2 rounded-lg font-medium transition"
          style={{ backgroundColor: brandColor }}
        >
          {content.button}
        </button>

        <p className="text-sm text-gray-500 mt-4">
          Si ya realizaste el pago o seleccionaste un nuevo plan, actualizá la
          página o esperá unos segundos.
        </p>
      </div>

      <p className="text-xs text-gray-400 mt-5">
        © {new Date().getFullYear()} VAI - Todos los derechos reservados
      </p>
    </div>
  );
}
