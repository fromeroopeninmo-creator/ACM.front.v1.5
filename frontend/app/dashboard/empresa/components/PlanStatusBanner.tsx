"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

type BillingEstado = {
  estado?: {
    empresaId?: string;
    tienePlan?: boolean;
    esTrial?: boolean;
    tipoPlan?: "core" | "combo" | "tracker_only" | null;
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
    suspendida_motivo?: string | null;
  } | null;
  plan: {
    id: string;
    nombre: string;
    precioNeto: number | null;
    totalConIVA: number | null;
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

export default function PlanStatusBanner() {
  const { user } = useAuth();
  const router = useRouter();

  const [planNombre, setPlanNombre] = useState<string | null>(null);
  const [fechaFin, setFechaFin] = useState<Date | null>(null);
  const [diasRestantes, setDiasRestantes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tieneTracker, setTieneTracker] = useState<boolean | null>(null);
  const [requiereSeleccionPlan, setRequiereSeleccionPlan] = useState(false);
  const [estaSuspendida, setEstaSuspendida] = useState(false);

  const hoursLeftWithinGrace = useMemo(() => {
    if (diasRestantes === null) return null;
    const h = 48 + diasRestantes * 24;
    return Math.max(0, h);
  }, [diasRestantes]);

  useEffect(() => {
    const fetchEstado = async () => {
      if (!user?.id) return;

      try {
        const empresaId =
          (user as any)?.empresa_id || (await resolveEmpresaIdForUser(user.id));

        const qs = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : "";
        const res = await fetch(`/api/billing/estado${qs}`, { cache: "no-store" });

        if (!res.ok) {
          setLoading(false);
          return;
        }

        const data: BillingEstado = await res.json();
        const nombre = data?.plan?.nombre ?? null;
        setPlanNombre(nombre);

        const finIso = data?.ciclo?.fin ?? null;
        const fin = finIso ? new Date(finIso) : null;
        setFechaFin(fin);

        const flags = data?.estado ?? null;

        const trackerHabilitado =
          !!flags?.incluyeTracker || !!flags?.esTrial;
        setTieneTracker(flags ? trackerHabilitado : null);

        const requierePlan = !!flags?.requiere_seleccion_plan;
        const suspendidaFlag = !!flags?.suspendida;
        const planVencido =
          !!flags?.planVencido || !!flags?.plan_vencido;
        const enGracia =
          !!flags?.enPeriodoGracia || !!flags?.en_periodo_gracia;

        setRequiereSeleccionPlan(requierePlan);
        setEstaSuspendida(suspendidaFlag);

        let diff: number | null = null;

        if (typeof flags?.diasRestantes === "number") {
          diff = flags.diasRestantes;
        } else if (
          typeof flags?.dias_desde_vencimiento === "number" &&
          planVencido
        ) {
          diff = -Math.abs(flags.dias_desde_vencimiento);
        } else if (fin) {
          const hoy = new Date();
          diff = Math.ceil(
            (fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        setDiasRestantes(diff);

        const debeSuspender =
          requierePlan || suspendidaFlag || (planVencido && !enGracia);

        if (debeSuspender) {
          if (!window.location.pathname.includes("/dashboard/empresa/suspendido")) {
            router.replace("/dashboard/empresa/suspendido");
            return;
          }
        } else {
          if (window.location.pathname.includes("/dashboard/empresa/suspendido")) {
            router.replace("/dashboard/empresa");
            return;
          }
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

  // Sin plan activo / requiere selección => mostrar banner rojo directo
  if (requiereSeleccionPlan) {
    return (
      <div className="p-3 text-sm text-white bg-red-700 text-center font-medium">
        ⚠️ Tu cuenta no tiene un plan activo. Para continuar utilizando la app,
        debés seleccionar y pagar un plan.{" "}
        <a
          href="/dashboard/empresa/planes"
          className="underline hover:text-blue-100 ml-1"
        >
          Ir al portal de planes
        </a>
      </div>
    );
  }

  if (loading || (!planNombre && !estaSuspendida)) return null;

  if (planNombre === "Trial" && diasRestantes !== null && diasRestantes >= 0) {
    return (
      <div
        className={`p-3 text-sm text-white font-medium text-center ${
          diasRestantes <= 2 ? "bg-red-600" : "bg-yellow-500"
        }`}
      >
        🕒 Tu plan <strong>{planNombre}</strong> vence en{" "}
        <strong>
          {diasRestantes} día{diasRestantes !== 1 ? "s" : ""}
        </strong>{" "}
        ({fechaFin?.toLocaleDateString("es-AR")}).{" "}
        <a
          href="/dashboard/empresa/planes"
          className="underline hover:text-blue-100 ml-1"
        >
          Actualizá tu plan
        </a>
      </div>
    );
  }

  if (planNombre && planNombre !== "Trial" && diasRestantes !== null && diasRestantes >= 0) {
    return (
      <div className="p-3 text-sm text-white bg-blue-600 text-center font-medium">
        <div>
          💼 Plan actual: <strong>{planNombre}</strong> — Vigente hasta{" "}
          {fechaFin?.toLocaleDateString("es-AR")}.
        </div>

        {tieneTracker === false && (
          <div className="mt-1 text-xs sm:text-sm">
            📊 Para usar <strong>Business Tracker</strong> y{" "}
            <strong>Business Analytics</strong> necesitás un plan{" "}
            <strong>Full</strong> o <strong>Business Tracker</strong>.{" "}
            <a
              href="/dashboard/empresa/planes"
              className="underline font-semibold hover:text-blue-100 ml-1"
            >
              Ver planes disponibles
            </a>
          </div>
        )}
      </div>
    );
  }

  if (
    planNombre &&
    planNombre !== "Trial" &&
    diasRestantes !== null &&
    diasRestantes < 0 &&
    diasRestantes >= -2
  ) {
    return (
      <div className="p-3 text-sm text-white bg-red-700 text-center font-medium">
        ⚠️ Su plan <strong>{planNombre}</strong> se encuentra vencido. Por favor
        regularice su pago dentro de las próximas{" "}
        <strong>{hoursLeftWithinGrace ?? 0} horas</strong> para evitar la suspensión del
        servicio.{" "}
        <a
          href="/dashboard/empresa/planes"
          className="underline hover:text-blue-100 ml-1"
        >
          Ir al portal de pago
        </a>
      </div>
    );
  }

  return null;
}
