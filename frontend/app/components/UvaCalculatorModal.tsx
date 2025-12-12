"use client";

import React, { useState, useEffect } from "react";

interface UvaCalculatorModalProps {
  open: boolean;
  onClose: () => void;
}

export default function UvaCalculatorModal({
  open,
  onClose,
}: UvaCalculatorModalProps) {
  const [monto, setMonto] = useState<string>("");
  const [tasaAnual, setTasaAnual] = useState<string>("");
  const [anios, setAnios] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [cuotaMensual, setCuotaMensual] = useState<number | null>(null);
  const [totalPagado, setTotalPagado] = useState<number | null>(null);
  const [totalIntereses, setTotalIntereses] = useState<number | null>(null);

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 2,
    }).format(value);

  const handleCalcular = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const montoNum = parseFloat(monto.replace(",", "."));
    const tasaNum = parseFloat(tasaAnual.replace(",", "."));
    const aniosNum = parseInt(anios, 10);

    if (
      isNaN(montoNum) ||
      isNaN(tasaNum) ||
      isNaN(aniosNum) ||
      montoNum <= 0 ||
      aniosNum <= 0 ||
      tasaNum < 0
    ) {
      setErrorMsg(
        "Revisá los datos: el monto y los años deben ser mayores a 0. La tasa no puede ser negativa."
      );
      setCuotaMensual(null);
      setTotalPagado(null);
      setTotalIntereses(null);
      return;
    }

    const tasaAnualDecimal = tasaNum / 100;
    const tasaMensual = tasaAnualDecimal / 12;
    const numPagos = aniosNum * 12;

    let cuota: number;

    // Caso tasa 0% (crédito sin interés)
    if (tasaMensual === 0) {
      cuota = montoNum / numPagos;
    } else {
      const factor = Math.pow(1 + tasaMensual, numPagos);
      cuota = (montoNum * tasaMensual * factor) / (factor - 1);
    }

    const total = cuota * numPagos;
    const intereses = total - montoNum;

    setCuotaMensual(cuota);
    setTotalPagado(total);
    setTotalIntereses(intereses);
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-900">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Calculadora de Créditos UVA
            </h2>
            <p className="text-xs text-neutral-300 mt-0.5">
              Estimá la cuota mensual aproximada de un crédito hipotecario.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-neutral-100 hover:bg-neutral-700 text-sm"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleCalcular} className="px-6 pt-5 pb-4 space-y-4">
          {/* Campos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Monto */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 mb-1 uppercase tracking-wide">
                Monto del crédito (en pesos)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="Ej: 150000000"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500"
              />
            </div>

            {/* Tasa anual */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1 uppercase tracking-wide">
                Tasa de interés anual (%)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={tasaAnual}
                onChange={(e) => setTasaAnual(e.target.value)}
                placeholder="Ej: 5.5"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500"
              />
              <p className="mt-1 text-[11px] text-neutral-500">
                Podés tomar como referencia la TNA del banco que elijas.
              </p>
            </div>

            {/* Años */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1 uppercase tracking-wide">
                Años del crédito
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={anios}
                onChange={(e) => setAnios(e.target.value)}
                placeholder="Ej: 20"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500"
              />
              <p className="mt-1 text-[11px] text-neutral-500">
                20 o 30 años suelen ser plazos habituales en hipotecarios.
              </p>
            </div>
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Botones */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-1">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black shadow-sm hover:bg-amber-400 transition-colors"
            >
              Calcular cuota mensual
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              Cerrar
            </button>
          </div>

          {/* Resultado */}
          {cuotaMensual !== null && (
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 space-y-1.5">
              <p className="text-xs font-semibold tracking-wide text-emerald-800 uppercase">
                Resultado estimado
              </p>
              <p className="font-semibold">
                Cuota mensual aproximada:{" "}
                <span className="font-bold">
                  {formatCurrency(cuotaMensual)}
                </span>
              </p>
              {totalPagado !== null && totalIntereses !== null && (
                <>
                  <p>
                    Total a pagar en todo el plazo:{" "}
                    <span className="font-medium">
                      {formatCurrency(totalPagado)}
                    </span>
                  </p>
                  <p>
                    Intereses aproximados:{" "}
                    <span className="font-medium">
                      {formatCurrency(totalIntereses)}
                    </span>
                  </p>
                </>
              )}
            </div>
          )}

          {/* Disclaimer */}
          <p className="mt-4 text-[11px] leading-snug text-neutral-500 border-t border-dashed border-neutral-200 pt-3">
            * Este cálculo es orientativo y no incluye variaciones del índice
            UVA, seguros ni gastos administrativos. No reemplaza el simulador
            oficial del banco ni constituye asesoramiento financiero.
          </p>
        </form>
      </div>
    </div>
  );
}
