// frontend/app/dashboard/empresa/components/PlanStatusBanner.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

type BillingEstado = {
  estado?: {
    empresaId: string;
    tienePlan: boolean;
    esTrial: boolean;
    tipoPlan: "core" | "combo" | "tracker_only" | null;
    incluyeValuador: boolean;
    incluyeTracker: boolean;
    suspendida: boolean;
    planVencido: boolean;
    enPeriodoGracia: boolean;
    diasRestantes: number | null;
    diasGraciaRestantes: number | null;
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
  // 1) Empresa donde el usuario es dueño directo
  const { data: emp } = await supabase
    .from("empresas")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (emp?.id) return emp.id as string;

  // 2) Perfil con empresa asociada
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

  const hoursLeftWithinGrace = useMemo(() => {
    if (diasRestantes === null) return null;
    const h = 48 + diasRestantes * 24; // si diasRestantes es negativo, quedan menos de 48h
    return Math.max(0, h);
  }, [diasRestantes]);

  useEffect(() => {
    const fetchEstado = async () => {
      if (!user?.id) return;

      try {
        // Resolución de empresa (por si en el futuro permitimos admin ver otra empresa)
        const empresaId =
          (user as any)?.empresa_id || (await resolveEmpresaIdForUser(user.id));

        // Llamamos al endpoint interno que ya aplica control de rol y arma el shape estable
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

        // 🧩 Flags de estado (incluyeTracker, esTrial, etc.)
        const flags = data?.estado;
        if (flags) {
          const trackerHabilitado = !!flags.incluyeTracker || !!flags.esTrial;
          setTieneTracker(trackerHabilitado);
        } else {
          setTieneTracker(null);
        }

        // Cálculo de días restantes: usamos el valor del backend si viene, o caemos al cálculo tradicional
        let diff: number | null = null;
        if (flags && typeof flags.diasRestantes === "number") {
          diff = flags.diasRestantes;
        } else if (fin) {
          const hoy = new Date();
          diff = Math.ceil(
            (fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        if (diff !== null) {
          setDiasRestantes(diff);

          // 🚨 bloqueo si plan pago vencido +2 días
          if (nombre && nombre !== "Trial" && diff < -2) {
            if (!window.location.pathname.includes("/dashboard/empresa/suspendido")) {
              router.replace("/dashboard/empresa/suspendido");
              return;
            }
          }

          // ✅ si estaba suspendido y vuelve a margen tolerado, redirigir al dashboard normal
          if (nombre && nombre !== "Trial" && diff >= -2) {
            if (window.location.pathname.includes("/dashboard/empresa/suspendido")) {
              router.replace("/dashboard/empresa");
              return;
            }
          }
        } else {
          setDiasRestantes(null);
        }
      } catch (err) {
        console.error("Error obteniendo estado de billing:", err);
      } finally {
        setLoading(false);
      }
    };

    // primera carga
    fetchEstado();
    // refresco cada 60s para captar cambios por webhook
    const t = setInterval(fetchEstado, 60000);
    return () => clearInterval(t);
  }, [user, router]);

  // 🧪 BYPASS TEMPORAL: permitir agregar asesores sin plan (modo development)
  // ⚠️ Mantener la lógica del archivo original
  if (process.env.NODE_ENV === "development") {
    console.warn("🚧 Bypass de verificación de plan activo habilitado (solo en desarrollo)");
    return null;
  }

  if (loading || !planNombre) return null;

  // 🧩 BANNER PARA PLAN TRIAL ACTIVO
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

  // 🧩 BANNER PARA PLANES PAGOS ACTIVOS
  if (planNombre !== "Trial" && diasRestantes !== null && diasRestantes >= 0) {
    return (
      <div className="p-3 text-sm text-white bg-blue-600 text-center font-medium">
        <div>
          💼 Plan actual: <strong>{planNombre}</strong> — Vigente hasta{" "}
          {fechaFin?.toLocaleDateString("es-AR")}.
        </div>

        {/* 🔔 Upsell específico para Business Tracker / Analytics cuando el plan NO lo incluye */}
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

  // 🧩 BANNER PARA PLANES PAGOS VENCIDOS (DENTRO DE 48HS)
  if (
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
