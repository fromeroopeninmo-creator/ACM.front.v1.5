"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type HistoryItem = {
  id: string;
  accion: string;
  motivo: string | null;
  vigente_hasta: string | null;
  realizado_por: string | null;
  created_at: string;
};

type Props = {
  empresaId: string;
  accesoPermitido: boolean;
  origenAcceso: string | null;
  motivoActual: string | null;
  suspensionManual: boolean;
  habilitacionManual: boolean;
  habilitacionManualHasta: string | null;
  habilitacionManualMotivo: string | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function defaultUntilDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function actionLabel(action: string) {
  if (action === "suspender") return "Suspensión administrativa";
  if (action === "habilitar_temporalmente") return "Habilitación temporal";
  if (action === "restablecer_billing_automatico") return "Billing automático restaurado";
  return action;
}

export default function AccessControlAdminCard(props: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "suspend" | "enable">("none");
  const [motivo, setMotivo] = useState("");
  const [hasta, setHasta] = useState(defaultUntilDate());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const statusLabel = props.suspensionManual
    ? "Suspendida administrativamente"
    : props.habilitacionManual
      ? "Habilitada temporalmente"
      : props.accesoPermitido
        ? "Activa por billing"
        : "Suspendida por billing";

  const statusClass = props.suspensionManual
    ? "border-red-200 bg-red-50 text-red-800"
    : props.habilitacionManual
      ? "border-blue-200 bg-blue-50 text-blue-800"
      : props.accesoPermitido
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-amber-200 bg-amber-50 text-amber-800";

  const explanation = useMemo(() => {
    if (props.suspensionManual) {
      return props.motivoActual || "La cuenta fue suspendida por un administrador.";
    }
    if (props.habilitacionManual) {
      return `${props.habilitacionManualMotivo || "Excepción administrativa."} Vigente hasta ${formatDateTime(props.habilitacionManualHasta)}.`;
    }
    if (props.accesoPermitido) {
      return "El acceso depende del ciclo pagado, trial o plan de Desarrollo vigente.";
    }
    return props.motivoActual || "La cuenta no tiene cobertura vigente.";
  }, [props]);

  async function loadHistory() {
    try {
      const response = await fetch(
        `/api/admin/empresas/${encodeURIComponent(props.empresaId)}/acceso-manual/historial`,
        { cache: "no-store" },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "No se pudo cargar el historial.");
      setHistory(Array.isArray(body?.items) ? body.items : []);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el historial.");
    }
  }

  useEffect(() => {
    if (historyOpen && history.length === 0) void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyOpen]);

  async function postAction(url: string, payload: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "No se pudo completar la acción.");
      setMode("none");
      setMotivo("");
      setHistory([]);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "No se pudo completar la acción.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border-2 border-[#E6A930]/40 bg-white p-4 shadow-sm dark:bg-neutral-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              CONTROL DE ACCESO DE LA CUENTA
            </p>
            <h2 className="mt-1 text-lg font-semibold">Suspensión y excepciones</h2>
          </div>
          <div className={`inline-flex max-w-full rounded-xl border px-3 py-2 text-sm font-medium ${statusClass}`}>
            <span className="break-words">{statusLabel}</span>
          </div>
          <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-300">{explanation}</p>
          <p className="text-xs text-gray-500">
            Estas acciones no modifican el plan, el acuerdo ni los ciclos abonados.
          </p>
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[370px]">
          <button
            type="button"
            onClick={() => {
              setMode("suspend");
              setError(null);
            }}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            disabled={loading || props.suspensionManual}
          >
            Suspender cuenta
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("enable");
              setError(null);
            }}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            Habilitar temporalmente
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen((value) => !value)}
            className="rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 sm:col-span-2"
          >
            {historyOpen ? "Ocultar historial" : "Ver historial de acciones"}
          </button>
        </div>
      </div>

      {mode !== "none" ? (
        <div className="mt-5 rounded-2xl border bg-gray-50 p-4 dark:bg-neutral-950">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="font-semibold">
                {mode === "suspend" ? "Suspender cuenta inmediatamente" : "Habilitar acceso temporal"}
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {mode === "suspend"
                  ? "La suspensión administrativa tiene prioridad sobre cualquier ciclo vigente."
                  : "La excepción permite ingresar aunque falte el pago. Al vencer, el billing automático retoma el control."}
              </p>
            </div>

            <div className={`grid gap-3 ${mode === "enable" ? "md:grid-cols-2" : ""}`}>
              <div>
                <label className="mb-1 block text-sm font-medium">Motivo</label>
                <textarea
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  rows={3}
                  placeholder={
                    mode === "suspend"
                      ? "Ej.: suspensión solicitada por administración..."
                      : "Ej.: extensión comercial mientras se confirma el pago..."
                  }
                  className="w-full resize-none rounded-xl border bg-white px-3 py-2 text-sm dark:bg-neutral-900"
                />
              </div>
              {mode === "enable" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium">Habilitar hasta</label>
                  <input
                    type="date"
                    value={hasta}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setHasta(event.target.value)}
                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-neutral-900"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    La habilitación finalizará al terminar ese día.
                  </p>
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setMode("none");
                  setError(null);
                }}
                className="rounded-xl border px-4 py-2 text-sm hover:bg-white dark:hover:bg-neutral-900"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (mode === "suspend") {
                    void postAction(
                      `/api/admin/empresas/${encodeURIComponent(props.empresaId)}/suspend`,
                      { motivo },
                    );
                  } else {
                    void postAction(
                      `/api/admin/empresas/${encodeURIComponent(props.empresaId)}/unsuspend`,
                      { accion: "habilitar_temporalmente", motivo, hasta },
                    );
                  }
                }}
                disabled={loading || motivo.trim().length < 5 || (mode === "enable" && !hasta)}
                className={`rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  mode === "suspend"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {loading
                  ? "Guardando..."
                  : mode === "suspend"
                    ? "Confirmar suspensión"
                    : "Confirmar habilitación"}
              </button>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {historyOpen ? (
        <div className="mt-5 border-t pt-4">
          <h3 className="font-semibold">Historial de acceso manual</h3>
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No hay acciones registradas.</p>
          ) : (
            <div className="mt-3 grid gap-3">
              {history.map((item) => (
                <article key={item.id} className="rounded-xl border p-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <strong className="text-sm">{actionLabel(item.accion)}</strong>
                    <span className="text-xs text-gray-500">{formatDateTime(item.created_at)}</span>
                  </div>
                  <p className="mt-2 break-words text-sm text-gray-700 dark:text-gray-300">
                    {item.motivo || "Sin motivo informado."}
                  </p>
                  {item.vigente_hasta ? (
                    <p className="mt-1 text-xs text-gray-500">
                      Vigente hasta: {formatDateTime(item.vigente_hasta)}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
