"use client";

import { useState, useEffect } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

interface Props {
  empresaId?: string;
  onCreated: () => void;
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
  const [password, setPassword] = useState(""); // ✅ nueva contraseña
  const [showPassword, setShowPassword] = useState(false); // ✅ toggle ver/ocultar
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planNombre, setPlanNombre] = useState<string | null>(null);
  const [planLimite, setPlanLimite] = useState<number | null>(null);
  const [asesoresActivos, setAsesoresActivos] = useState<number>(0);

  const limitesPlanes: Record<string, number> = {
    Trial: 0,
    Prueba: 0,
    Inicial: 4,
    Pro: 10,
    Premium: 20,
    Personalizado: 50,
    Desarrollo: 50,
  };

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

  useEffect(() => {
    const fetchPlan = async () => {
      if (!resolvedEmpresaId) return;

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

      const { data: planData } = await supabase
        .from("planes")
        .select("nombre")
        .eq("id", empresaPlan.plan_id)
        .single();

      const nombrePlan = planData?.nombre || "Trial";
      setPlanNombre(nombrePlan);
      setPlanLimite(limitesPlanes[nombrePlan] ?? 0);

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

    if (!nombre || !apellido || !email || !password) {
      setError("Por favor, completá los campos obligatorios.");
      return;
    }

    if (planLimite !== null && asesoresActivos >= planLimite) {
      setError(
        `Tu plan (${planNombre}) permite un máximo de ${planLimite} asesores activos.`
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: empresaPlan } = await supabase
        .from("empresas_planes")
        .select("activo, fecha_fin")
        .eq("empresa_id", resolvedEmpresaId)
        .eq("activo", true)
        .maybeSingle();

      if (!empresaPlan || new Date(empresaPlan.fecha_fin) < new Date()) {
        setError("Tu plan ha expirado o no está activo.");
        setLoading(false);
        return;
      }

      // ✅ 1️⃣ Crear usuario auth
      const { data: newUser, error: signUpError } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            nombre,
            apellido,
            empresa_id: resolvedEmpresaId,
            role: "asesor",
          },
        });

      if (signUpError) {
        console.error("Error creando usuario auth:", signUpError);
        setError("No se pudo crear el usuario del asesor.");
        setLoading(false);
        return;
      }

      // ✅ 2️⃣ Insertar registro en tabla asesores
      const { error: insertError } = await supabase.from("asesores").insert([
        {
          id_usuario: newUser.user.id,
          empresa_id: resolvedEmpresaId,
          nombre,
          apellido,
          email,
          telefono,
          activo: true,
          fecha_creacion: new Date().toISOString(),
        },
      ]);

      if (insertError) {
        console.error("Error insertando asesor:", insertError);
        setError("No se pudo registrar el asesor en la base de datos.");
      } else {
        setNombre("");
        setApellido("");
        setEmail("");
        setTelefono("");
        setPassword("");
        onCreated();
      }
    } catch (err) {
      console.error("Excepción al crear asesor:", err);
      setError("Ocurrió un error inesperado.");
    }

    setLoading(false);
  };

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

        {/* ✅ Nuevo campo contraseña */}
        <div className="col-span-2 relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Contraseña *"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 rounded w-full pr-10"
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
