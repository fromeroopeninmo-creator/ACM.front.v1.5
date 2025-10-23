// frontend/app/dashboard/soporte/AccionesSoporte.tsx
"use client";

import { useState } from "react";
import { postResetPassword, postTogglePlan } from "#lib/soporteApi";

type Props = {
  empresaId: string;
  correoResetDefault?: string;
  estadoPlanActual?: "activo" | "suspendido";
};

export default function AccionesSoporte({
  empresaId,
  correoResetDefault = "",
  estadoPlanActual,
}: Props) {
  const [email, setEmail] = useState(correoResetDefault);
  const [loadingReset, setLoadingReset] = useState(false);
  const [loadingToggle, setLoadingToggle] = useState<"activar" | "suspender" | null>(null);
  const [estado, setEstado] = useState<"activo" | "suspendido" | undefined>(estadoPlanActual);

  async function onResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      alert("Ingresá un email válido.");
      return;
    }
    try {
      setLoadingReset(true);
      // ✅ Fix: pasar string, no objeto
      const res = await postResetPassword(email);
      if (res.ok) {
        alert("Se envió el email de recuperación (si el usuario existe).");
      } else {
        alert("No se pudo enviar el email de recuperación.");
      }
    } catch (err: any) {
      alert(err?.message || "Error al enviar el email de recuperación.");
    } finally {
      setLoadingReset(false);
    }
  }

  async function onToggle(action: "activar" | "suspender") {
    try {
      setLoadingToggle(action);
      const res = await postTogglePlan(empresaId, action);
      if (res.ok) {
        setEstado(action === "activar" ? "activo" : "suspendido");
        alert(`Plan ${action === "activar" ? "activado" : "suspendido"} correctamente.`);
      } else {
        alert("No se pudo aplicar la acción sobre el plan.");
      }
    } catch (err: any) {
      alert(err?.message || "Error al aplicar la acción sobre el plan.");
    } finally {
      setLoadingToggle(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Reset de password */}
      <form onSubmit={onResetPassword} className="flex flex-col md:flex-row gap-2 md:items-end">
        <div className="flex-1">
          <label className="block text-sm text-gray-600 mb-1">Enviar reset de contraseña</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
          />
        </div>
        <button
          type="submit"
          disabled={loadingReset}
          className="rounded-xl border px-4 py-2 text-sm bg-blue-600 text-white disabled:opacity-50"
        >
          {loadingReset ? "Enviando..." : "Enviar reset"}
        </button>
      </form>

      {/* Toggle plan: activar / suspender */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-600">Estado del plan:</span>
        <span
          className={
            estado === "activo"
              ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700"
              : estado === "suspendido"
              ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"
              : "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-700"
          }
        >
          {estado || "—"}
        </span>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => onToggle("activar")}
            disabled={loadingToggle !== null}
            className="rounded-xl border px-3 py-1.5 text-sm bg-green-600 text-white disabled:opacity-50"
          >
            {loadingToggle === "activar" ? "Activando..." : "Activar"}
          </button>
          <button
            onClick={() => onToggle("suspender")}
            disabled={loadingToggle !== null}
            className="rounded-xl border px-3 py-1.5 text-sm bg-amber-600 text-white disabled:opacity-50"
          >
            {loadingToggle === "suspender" ? "Suspendiendo..." : "Suspender"}
          </button>
        </div>
      </div>
    </div>
  );
}
