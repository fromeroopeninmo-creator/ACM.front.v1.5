// frontend/app/dashboard/empresa/components/ProrationConfirmModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type PreviewResponse = {
  ok?: boolean;
  tipo?: "upgrade" | "downgrade" | "sin_cambio";
  planActual?: { id: string; nombre: string | null };
  planNuevo?: { id: string; nombre: string | null };
  detalle?: {
    diasRestantes?: number | null;
    factor?: number | null; // 0..1
    precioActualNeto?: number | null;
    precioNuevoNeto?: number | null;
    deltaNeto?: number | null;
    iva?: number | null;
    total?: number | null;
    cambioProgramadoPara?: string | null;
    aplicaAhora?: boolean | null;
  };
  mensaje?: string | null;
} | null;

export default function ProrationConfirmModal(props: {
  open: boolean;
  onClose: () => void;
  empresaId: string;
  planId: string;
  personalizadoCount?: number;
}) {
  const { open, onClose, empresaId, planId, personalizadoCount } = props;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse>(null);

  const IVA_LABEL = "+ IVA";
  const fmtPrice = (v?: number | null) => {
    if (v == null || !isFinite(v)) return "—";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(v);
  };
  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString("es-AR") : "—";

  // Nota visual simple por tipo
  const tipoNota = useMemo(() => {
    const t = preview?.tipo;
    if (t === "upgrade") return "Cambio a un plan superior — se cobra la diferencia prorrateada ahora.";
    if (t === "downgrade")
      return "Cambio a un plan inferior — el cambio quedará programado para el próximo ciclo (sin crédito).";
    if (t === "sin_cambio") return "No hay diferencias de precio entre los planes seleccionados.";
    return null;
  }, [preview]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!open) return;
      setErrorMsg(null);
      setLoading(true);
      setPreview(null);
      try {
        const usp = new URLSearchParams();
        usp.set("empresaId", empresaId);
        usp.set("planId", planId);
        if (typeof personalizadoCount === "number") {
          usp.set("override", String(personalizadoCount));
        }

        const res = await fetch(`/api/billing/preview-change?${usp.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        // Si el endpoint aún no existe o devuelve error, mostramos mensaje seguro
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          if (!cancelled) {
            setErrorMsg(
              txt?.trim()
                ? `No se pudo obtener el preview. ${txt}`
                : "No se pudo obtener el preview del cambio."
            );
          }
          return;
        }

        const data = (await res.json().catch(() => null)) as PreviewResponse;
        if (!cancelled) setPreview(data ?? null);
      } catch (e: any) {
        if (!cancelled)
          setErrorMsg(e?.message || "Error al consultar el preview del cambio.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [open, empresaId, planId, personalizadoCount]);

  const confirmar = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const body: any = { empresaId, planId };
      if (typeof personalizadoCount === "number") {
        body.override = personalizadoCount;
      }

      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res
        .json()
        .catch(() => ({ ok: false, error: "Error inesperado" }));

      if (!res.ok || data?.error) {
        setErrorMsg(
          data?.error ||
            `No se pudo confirmar el cambio (${res.status} ${res.statusText}).`
        );
        setSubmitting(false);
        return;
      }

      // OK
      onClose?.();
      // refrescamos para ver el nuevo estado
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Error al confirmar el cambio.");
      setSubmitting(false);
    }
  };

  if (!open) return null;

  // Backdrop + modal
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => {
          if (!submitting) onClose?.();
        }}
      />

      {/* Card */}
      <div className="relative z-[61] w-[94vw] max-w-2xl rounded-xl bg-white shadow-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">
            Confirmar cambio de plan
          </h3>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={() => !submitting && onClose?.()}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          {/* Info / estados */}
          {loading ? (
            <p className="text-sm text-gray-600">Calculando prorrateo…</p>
          ) : errorMsg ? (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
              {errorMsg}
            </div>
          ) : (
            <>
              {/* Nota por tipo */}
              {tipoNota && (
                <div className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-md p-3 mb-3">
                  {tipoNota}
                </div>
              )}

              {/* Mensaje del backend si vino */}
              {preview?.mensaje && (
                <p className="text-sm text-gray-700 mb-3">{preview.mensaje}</p>
              )}

              {/* Resumen de planes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Plan actual</div>
                  <div className="text-sm font-medium text-gray-800">
                    {preview?.planActual?.nombre ?? "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Nuevo plan</div>
                  <div className="text-sm font-medium text-gray-800">
                    {preview?.planNuevo?.nombre ?? "—"}
                  </div>
                </div>
              </div>

              {/* Métricas de ciclo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Días restantes</div>
                  <div className="text-sm font-medium text-gray-800">
                    {preview?.detalle?.diasRestantes ?? "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Factor prorrateo</div>
                  <div className="text-sm font-medium text-gray-800">
                    {preview?.detalle?.factor != null
                      ? (preview.detalle.factor * 100).toFixed(2) + "%"
                      : "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Cambio efectivo</div>
                  <div className="text-sm font-medium text-gray-800">
                    {preview?.detalle?.aplicaAhora
                      ? "Inmediato"
                      : preview?.detalle?.cambioProgramadoPara
                      ? fmtDate(preview.detalle.cambioProgramadoPara)
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Precios */}
              <div className="rounded-lg border border-gray-200 p-3 mb-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">
                      Precio actual (neto)
                    </div>
                    <div className="text-sm font-medium text-gray-800">
                      {fmtPrice(preview?.detalle?.precioActualNeto ?? null)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">
                      Precio nuevo (neto)
                    </div>
                    <div className="text-sm font-medium text-gray-800">
                      {fmtPrice(preview?.detalle?.precioNuevoNeto ?? null)}
                    </div>
                  </div>
                </div>

                <hr className="my-3" />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">
                      Diferencia prorrateada (neto)
                    </div>
                    <div className="text-sm font-medium text-gray-800">
                      {fmtPrice(preview?.detalle?.deltaNeto ?? null)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">IVA</div>
                    <div className="text-sm font-medium text-gray-800">
                      {fmtPrice(preview?.detalle?.iva ?? null)}{" "}
                      <span className="text-[11px] text-gray-500">{IVA_LABEL}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Total a pagar ahora</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {fmtPrice(preview?.detalle?.total ?? null)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Aviso override si aplica */}
              {typeof personalizadoCount === "number" && (
                <p className="text-xs text-gray-500 mt-2">
                  Cupo solicitado: <strong>{personalizadoCount}</strong> asesores.
                </p>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={loading || submitting || !!errorMsg}
            className={`px-4 py-2 text-sm rounded-lg text-white ${
              loading || submitting || !!errorMsg
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {submitting ? "Confirmando…" : "Confirmar cambio"}
          </button>
        </div>
      </div>
    </div>
  );
}
