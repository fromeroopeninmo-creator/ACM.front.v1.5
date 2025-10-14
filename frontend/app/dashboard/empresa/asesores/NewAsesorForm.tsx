"use client";

import { useState, useEffect } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

interface Props {
  empresaId?: string; // puede venir de props o se resuelve automáticamente
  onCreated: () => void;
}

export default function NewAsesorForm({ empresaId, onCreated }: Props) {
  const { user } = useAuth();
  const [resolvedEmpresaId, setResolvedEmpresaId] = useState<string | null>(empresaId || null);

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planNombre, setPlanNombre] = useState<string | null>(null);
  const [planLimite, setPlanLimite] = useState<number | null>(null);
  const [asesoresActivos, setAsesoresActivos] = useState<number>(0);

  // 📡 Map de límites por plan
  const limitesPlanes: Record<string, number> = {
    Trial: 0,
    Prueba: 0,
    Inicial: 4,
    Pro: 10,
    Premium: 20,
    Personalizado: 50,
  };

  // 🔍 Resolver empresa asociada si no se pasa empresaId por props
  useEffect(() => {
    const fetchEmpresaId = async () => {
      if (empresaId) return; // ya vino por props
      if (!user?.id) return;

      const { data: empresa, error: empresaError } = await supabase
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (empresaError || !empresa) {
        console.error("❌ No se encontró empresa asociada al usuario:", empresaError);
        setError("No se encontró la empresa asociada a este usuario.");
        return;
      }

      setResolvedEmpresaId(empresa.id);
    };

    fetchEmpresaId();
  }, [user, empresaId]);

  // 🔍 Carga datos del plan activo y cantidad de asesores
  useEffect(() => {
    const fetchPlan = async () => {
      if (!resolvedEmpresaId) return;

      // Buscar plan activo de la empresa
      const { data: empresaPlan, error: errorEmpresaPlan } = await supabase
        .from("empresas_planes")
        .select("plan_id")
        .eq("empresa_id", resolvedEmpresaId)
        .eq("activo", true)
        .maybeSingle();

      if (errorEmpresaPlan) {
        console.error("Error buscando plan de empresa:", errorEmpresaPlan);
        setError("Error al obtener el plan actual.");
        return;
      }

      if (!empresaPlan?.plan_id) {
        setError("No se encontró plan activo para esta empresa.");
        return;
      }

      // Buscar nombre del plan
      const { data: planData } = await supabase
        .from("planes")
        .select("nombre")
        .eq("id", empresaPlan.plan_id)
        .single();

      const nombrePlan = planData?.nombre || "Trial";
      setPlanNombre(nombrePlan);
      setPlanLimite(limitesPlanes[nombrePlan] ?? 0);

      // Contar asesores activos
      const { count } = await supabase
        .from("asesores")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", resolvedEmpresaId)
        .eq("activo", true);

      setAsesoresActivos(count || 0);
    };

    fetchPlan();
  }, [resolvedEmpresaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resolvedEmpresaId) {
      setError("No se encontró la empresa asociada.");
      return;
    }

    if (!nombre || !apellido || !email) {
      setError("Por favor, completá los campos obligatorios.");
      return;
    }

    // 🚫 Verificación de límite
    if (planLimite !== null && asesoresActivos >= planLimite) {
      setError(
        `Tu plan (${planNombre}) permite un máximo de ${planLimite} asesores activos.`
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 🧩 Insert con FK correcta
      const { error } = await supabase.from("asesores").insert([
        {
          empresa_id: resolvedEmpresaId,
          nombre,
          apellido,
          email,
          telefono,
          activo: true,
          fecha_creacion: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      // Reset form y callback
      setNombre("");
      setApellido("");
      setEmail("");
      setTelefono("");
      onCreated();
    } catch (err) {
      console.error("Error al crear asesor:", err);
      setError("No se pudo crear el asesor.");
    } finally {
      setLoading(false);
    }
  };

  // 🧩 Fallback visual si todavía no hay empresaId cargado
  if (!resolvedEmpresaId) {
    return (
      <p className="text-gray-500 text-sm">
        Cargando datos de la empresa...
      </p>
    );
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
