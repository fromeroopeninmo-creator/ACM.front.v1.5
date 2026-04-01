"use client";

import { useState, useEffect } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

interface Props {
  empresaId?: string;
  onCreated: () => void;
}

function normalizarTexto(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function resolverLimiteFallback(plan: {
  nombre?: string | null;
  nombre_comercial?: string | null;
  tipo_plan?: string | null;
  tier_plan?: string | null;
  es_trial?: boolean | null;
}): number {
  if (plan?.es_trial) return 0;

  const nombre = normalizarTexto(plan?.nombre);
  const nombreComercial = normalizarTexto(plan?.nombre_comercial);
  const tipoPlan = normalizarTexto(plan?.tipo_plan);
  const tierPlan = normalizarTexto(plan?.tier_plan);

  if (tipoPlan === "trial" || nombre === "trial" || nombreComercial === "trial") {
    return 0;
  }

  if (tipoPlan === "core" || tipoPlan === "combo" || tipoPlan === "tracker_only") {
    switch (tierPlan) {
      case "inicial":
        return 4;
      case "pro":
        return 10;
      case "premium":
        return 20;
      case "personalizado":
        return 50;
      default:
        break;
    }
  }

  if (nombre.includes("desarrollo") || nombreComercial.includes("desarrollo")) {
    return 50;
  }

  if (nombre.includes("personalizado") || nombreComercial.includes("personalizado")) {
    return 50;
  }

  if (nombre.includes("premium") || nombreComercial.includes("premium")) {
    return 20;
  }

  if (nombre === "pro" || nombreComercial === "pro") {
    return 10;
  }

  if (nombre === "inicial" || nombreComercial === "inicial") {
    return 4;
  }

  return 0;
}

export default function NewAsesorForm({ empresaId, onCreated }: Props) {
  const { user } = useAuth();

  const [resolvedEmpresaId, setResolvedEmpresaId] = useState<string | null>(
    empresaId || null
  );
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planNombre, setPlanNombre] = useState<string | null>(null);
  const [planLimite, setPlanLimite] = useState<number | null>(null);
  const [asesoresActivos, setAsesoresActivos] = useState<number>(0);

  useEffect(() => {
    const fetchEmpresaId = async () => {
      if (resolvedEmpresaId || !user) return;

      const { data, error } = await supabase
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        console.warn("⚠️ No se pudo obtener empresa_id automáticamente:", error);
        setError("No se encontró la empresa asociada al usuario actual.");
        return;
      }

      setResolvedEmpresaId(data.id);
    };

    fetchEmpresaId();
  }, [user, resolvedEmpresaId]);

  const fetchPlanInfo = async (empId: string) => {
    setError(null);

    const { data: empresaPlan, error: errorEmpresaPlan } = await supabase
      .from("empresas_planes")
      .select("plan_id, max_asesores_override")
      .eq("empresa_id", empId)
      .eq("activo", true)
      .maybeSingle();

    if (errorEmpresaPlan) {
      console.error("Error buscando plan de empresa:", errorEmpresaPlan);
      setError("Error al obtener el plan actual.");
      return;
    }

    if (!empresaPlan?.plan_id) {
      setError("No se encontró plan activo para esta empresa.");
      setPlanNombre(null);
      setPlanLimite(0);
      return;
    }

    let acuerdoActivo: {
      plan_id?: string | null;
      max_asesores_override?: number | null;
    } | null = null;

    const { data: acuerdoData, error: acuerdoError } = await supabase
      .from("empresa_acuerdos_comerciales")
      .select("plan_id, max_asesores_override")
      .eq("empresa_id", empId)
      .eq("activo", true)
      .maybeSingle();

    if (acuerdoError) {
      console.warn(
        "⚠️ No se pudo leer acuerdo comercial activo; se continúa con plan operativo:",
        acuerdoError
      );
    } else if (acuerdoData) {
      acuerdoActivo = acuerdoData;
    }

    const planIdFuente = acuerdoActivo?.plan_id || empresaPlan.plan_id;

    const { data: planData, error: planError } = await supabase
      .from("planes")
      .select("id, nombre, nombre_comercial, tipo_plan, tier_plan, max_asesores, es_trial")
      .eq("id", planIdFuente)
      .maybeSingle();

    if (planError) {
      console.error("Error obteniendo datos del plan:", planError);
      setError("Error al obtener la configuración del plan.");
      return;
    }

    if (!planData) {
      setError("No se encontró el plan asociado a la empresa.");
      setPlanNombre(null);
      setPlanLimite(0);
      return;
    }

    const nombreVisible =
      planData.nombre_comercial?.trim() || planData.nombre?.trim() || "Plan actual";

    let limiteEfectivo: number;

    if (typeof acuerdoActivo?.max_asesores_override === "number") {
      limiteEfectivo = acuerdoActivo.max_asesores_override;
    } else if (typeof empresaPlan.max_asesores_override === "number") {
      limiteEfectivo = empresaPlan.max_asesores_override;
    } else if (typeof planData.max_asesores === "number") {
      limiteEfectivo = planData.max_asesores;
    } else {
      limiteEfectivo = resolverLimiteFallback(planData);
    }

    setPlanNombre(nombreVisible);
    setPlanLimite(limiteEfectivo);

    const { count, error: asesoresCountError } = await supabase
      .from("asesores")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empId)
      .eq("activo", true);

    if (asesoresCountError) {
      console.error("Error contando asesores activos:", asesoresCountError);
      setError("Error al obtener la cantidad de asesores activos.");
      return;
    }

    setAsesoresActivos(count || 0);
  };

  useEffect(() => {
    if (!resolvedEmpresaId) return;
    fetchPlanInfo(resolvedEmpresaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedEmpresaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resolvedEmpresaId) {
      setError("No se encontró la empresa asociada.");
      return;
    }

    if (!nombre || !apellido || !email || !password) {
      setError("Por favor, completá los campos obligatorios.");
      return;
    }

    if (planLimite !== null && asesoresActivos >= planLimite) {
      setError(
        `Tu plan (${planNombre || "actual"}) permite un máximo de ${planLimite} asesores activos.`
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/crear-asesor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId: resolvedEmpresaId,
          nombre,
          apellido,
          email,
          telefono,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear el asesor.");

      setNombre("");
      setApellido("");
      setEmail("");
      setTelefono("");
      setPassword("");

      await fetchPlanInfo(resolvedEmpresaId);
      onCreated();
    } catch (err: any) {
      console.error("Error al crear asesor:", err);
      setError(err.message || "Error desconocido al crear asesor.");
    } finally {
      setLoading(false);
    }
  };

  if (!resolvedEmpresaId) {
    return <p className="text-gray-500 text-sm">Cargando datos de la empresa...</p>;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white shadow-sm border border-gray-200 p-4 rounded-lg"
    >
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-medium">Nuevo Asesor</h2>
        {planNombre && (
          <span className="text-sm text-gray-500">
            Plan actual:{" "}
            <strong>
              {planNombre} ({asesoresActivos}/{planLimite ?? 0})
            </strong>
          </span>
        )}
      </div>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <input
          type="text"
          placeholder="Nombre *"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Apellido *"
          value={apellido}
          onChange={(e) => setApellido(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="email"
          placeholder="Email *"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Teléfono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className="border p-2 rounded"
        />

        <div className="col-span-2 relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Contraseña *"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 rounded w-full pr-20"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-2 text-gray-500 text-sm"
          >
            {showPassword ? "🙈 Ocultar" : "👁️ Ver"}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
      >
        {loading ? "Guardando..." : "Guardar Asesor"}
      </button>
    </form>
  );
}
