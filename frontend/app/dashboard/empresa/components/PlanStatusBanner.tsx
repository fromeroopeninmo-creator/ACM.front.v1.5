"use client";

import { useEffect, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function PlanStatusBanner() {
  const { user } = useAuth();
  const router = useRouter();

  const [planNombre, setPlanNombre] = useState<string | null>(null);
  const [fechaFin, setFechaFin] = useState<Date | null>(null);
  const [diasRestantes, setDiasRestantes] = useState<number | null>(null);
  const [activo, setActivo] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

   useEffect(() => {
  const fetchPlan = async () => {
    if (!user?.id) return;

    const { data: plan, error } = await supabase
      .from("empresas_planes")
      .select("fecha_fin, activo, planes(nombre)")
      .eq("empresa_id", user.id)
      .eq("activo", true)
      .maybeSingle();

    if (error || !plan) {
      setLoading(false);
      return;
    }

    const fin = new Date(plan.fecha_fin);
    const hoy = new Date();
    const diff = Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

    // 🩵 aseguramos el tipo correcto:
    const planesData = (plan.planes as { nombre: string }[] | { nombre: string } | null) || null;
    const planInfo =
      Array.isArray(planesData) && planesData.length > 0
        ? planesData[0]
        : (planesData as { nombre: string } | null);

    setFechaFin(fin);
    setDiasRestantes(diff);
    setPlanNombre(planInfo?.nombre ?? "Trial");
    setLoading(false);

    // 🚨 bloqueo si plan pago vencido +2 días
    if (planInfo?.nombre !== "Trial" && diff < -2) {
      alert(
        "Su suscripción ha superado el período de tolerancia. Redirigiendo al portal de pago..."
      );
      router.replace("/dashboard/empresa/planes");
    }
  };

  fetchPlan();
}, [user, router]);


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
        <strong>{diasRestantes} día{diasRestantes !== 1 ? "s" : ""}</strong> (
        {fechaFin?.toLocaleDateString("es-AR")}).{" "}
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
        💼 Plan actual: <strong>{planNombre}</strong> — Vigente hasta{" "}
        {fechaFin?.toLocaleDateString("es-AR")}.
      </div>
    );
  }

  // 🧩 BANNER PARA PLANES PAGOS VENCIDOS (DENTRO DE 48HS)
  if (planNombre !== "Trial" && diasRestantes !== null && diasRestantes < 0 && diasRestantes >= -2) {
    return (
      <div className="p-3 text-sm text-white bg-red-700 text-center font-medium">
        ⚠️ Su plan <strong>{planNombre}</strong> se encuentra vencido.
        Por favor regularice su pago dentro de las próximas{" "}
        <strong>{48 + diasRestantes * 24} horas</strong> para evitar la suspensión
        del servicio.{" "}
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
