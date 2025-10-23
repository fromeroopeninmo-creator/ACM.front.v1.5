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
  const [email, setEmail] = useState<string>(correoResetDefault);
  const [loadingReset, setLoadingReset] = useState(false);
  const [loadingToggle, setLoadingToggle] = useState<false | "activar" | "suspender">(false);

  async function onResetPassword() {
    if (!email) {
      alert("Ingresá un email válido para enviar el reset.");
      return;
    }
    if (!confirm(`¿Enviar email de recuperación a ${email}?`)) return;

    try {
      setLoadingReset(true);
      const res = await postResetPassword({ email });
      if (res.ok) {
        alert("Se envió el email de recuperación (si el usuario existe).");
      } else {
        alert(res.message || "No se pudo enviar el reset de contraseña.");
      }
    } catch (e: any) {
      alert(e?.message || "Error en reset de contraseña.");
    } finally {
      setLoadingReset(false);
    }
  }

  async function onTogglePlan(activar: boolean) {
    const verbo = activar ? "activar" : "suspender";
    if (!confirm(`¿Confirmás ${verbo} el plan de esta empresa?`)) return;

    try {
      setLoadingToggle(activar ? "activar" : "suspender");
      const res = await postTogglePlan({ empresaId, activar });
      if (res.ok) {
        alert(`Plan ${activar ? "activado" : "suspendido"} correctamente.`);
        // tip: el padre puede hacer mutate() para revalidar su SWR si lo integra
      } else {
        alert(res.message || `No se pudo ${verbo} el plan.`);
      }
    } catch (e: any) {
      alert(e?.message || `Error al ${verbo} el plan.`);
    } finally {
      setLoadingToggle(false);
    }
  }

  const isActivo = estadoPlanActual === "activo";
  const isSuspendido = estadoPlanActual === "suspendido";

  return (
    <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900 space-y-3">
      <h3 className="font-medium">Acciones de Soporte</h3>

      {/* Reset de contraseña */}
      <div className="space-y-2">
        <label className="text-sm text-gray-600 dark:text-gray-300">
          Envío de enlace de recuperación
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            placeholder="usuario@empresa.com"
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
          />
          <button
            onClick={onResetPassword}
            disabled={loadingReset}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loadingReset ? "Enviando…" : "Enviar reset"}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Registra en auditoría. Si el email no existe, no revela información sensible.
        </p>
      </div>

      {/* Activar / Suspender plan */}
      <div className="space-y-2">
        <label className="text-sm text-gray-600 dark:text-gray-300">
          Estado del plan
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onTogglePlan(true)}
            disabled={loadingToggle !== false || isActivo}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loadingToggle === "activar" ? "Activando…" : "Activar"}
          </button>
          <button
            onClick={() => onTogglePlan(false)}
            disabled={loadingToggle !== false || isSuspendido}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loadingToggle === "suspender" ? "Suspendiendo…" : "Suspender"}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Usa <code>/api/soporte/plan-visual-toggle</code>. El padre puede refrescar métricas luego.
        </p>
      </div>
    </div>
  );
}
