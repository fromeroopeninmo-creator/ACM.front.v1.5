"use client";

import { useMemo, useState } from "react";

type IndiceAjuste = "ICL" | "IPC" | "UVA" | "CER";

type ResultadoAjuste = {
  ok: boolean;
  indice: IndiceAjuste;
  fuente: "BCRA" | "ArgentinaDatos";
  metodo: string;
  montoInicial: number;
  montoActualizado: number;
  aumentoMonto: number;
  aumentoPorcentaje: number;
  factor: number;
  fechaInicio: string;
  fechaActualizacion: string;
  fechaDatoInicial: string;
  fechaDatoActualizacion: string;
  valorIndiceInicial: number;
  valorIndiceActualizacion: number;
  cantidadPeriodos: number | null;
  unidadMonto: "ARS";
  nota: string;
};

const INDICES: Array<{
  value: IndiceAjuste;
  label: string;
  description: string;
}> = [
  {
    value: "ICL",
    label: "ICL - Contratos de locación",
    description: "Índice de contratos de locación publicado por BCRA.",
  },
  {
    value: "IPC",
    label: "IPC - Inflación mensual acumulada",
    description: "Actualización por inflación mensual acumulada.",
  },
  {
    value: "UVA",
    label: "UVA",
    description: "Unidad de Valor Adquisitivo publicada por BCRA.",
  },
  {
    value: "CER",
    label: "CER",
    description: "Coeficiente de Estabilización de Referencia publicado por BCRA.",
  },
];

function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function oneYearAgoIso(): string {
  const now = new Date();
  now.setFullYear(now.getFullYear() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(value)} ARS`;
}

function formatNumber(value?: number | null, decimals = 4): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} %`;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day, 12).toLocaleDateString("es-AR");
}

function parseMonto(value: string): number | null {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function CalculadoraActualizacionAlquiler() {
  const [indice, setIndice] = useState<IndiceAjuste>("ICL");
  const [montoInicial, setMontoInicial] = useState("300000");
  const [fechaInicio, setFechaInicio] = useState(oneYearAgoIso());
  const [fechaActualizacion, setFechaActualizacion] = useState(todayIso());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoAjuste | null>(null);

  const indiceDescripcion = useMemo(
    () => INDICES.find((item) => item.value === indice)?.description ?? "",
    [indice]
  );

  const montoPreview = useMemo(() => formatMoney(parseMonto(montoInicial)), [montoInicial]);

  async function calcular() {
    setLoading(true);
    setError(null);
    setResultado(null);

    try {
      const res = await fetch("/api/alquileres/actualizacion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          indice,
          montoInicial: parseMonto(montoInicial),
          fechaInicio,
          fechaActualizacion,
        }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || "No se pudo calcular el ajuste.");
      }

      setResultado(payload as ResultadoAjuste);
    } catch (err) {
      console.error("Error calculando actualización de alquiler:", err);
      setError(err instanceof Error ? err.message : "No se pudo calcular el ajuste.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Herramienta de actualización
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Calculadora de actualización de alquileres
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Calculá un valor orientativo de actualización usando ICL, IPC, UVA o CER.
            El resultado se expresa en ARS y depende de los datos publicados para las fechas seleccionadas.
          </p>
        </div>

        <span className="inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          Fuentes: BCRA / ArgentinaDatos
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Monto inicial del alquiler
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={montoInicial}
                onChange={(event) => setMontoInicial(event.target.value)}
                placeholder="Ej.: 300000"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
              <p className="mt-1 text-xs text-slate-500">Vista previa: {montoPreview}</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Índice de actualización
              </label>
              <select
                value={indice}
                onChange={(event) => setIndice(event.target.value as IndiceAjuste)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              >
                {INDICES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs leading-5 text-slate-500">{indiceDescripcion}</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Fecha inicio / valor base
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(event) => setFechaInicio(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Fecha de actualización
              </label>
              <input
                type="date"
                value={fechaActualizacion}
                onChange={(event) => setFechaActualizacion(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={calcular}
            disabled={loading}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Calculando actualización..." : "Calcular actualización"}
          </button>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          {resultado ? (
            <div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
                <p className="text-sm font-medium opacity-80">Alquiler actualizado</p>
                <p className="mt-2 text-4xl font-bold tracking-tight">
                  {formatMoney(resultado.montoActualizado)}
                </p>
                <p className="mt-2 text-sm opacity-75">
                  Aumento estimado: {formatMoney(resultado.aumentoMonto)} · {formatPercent(resultado.aumentoPorcentaje)}
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Monto inicial
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {formatMoney(resultado.montoInicial)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Factor aplicado
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    × {formatNumber(resultado.factor, 6)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Índice inicial
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {formatNumber(resultado.valorIndiceInicial, 6)} {resultado.indice}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Fecha dato: {formatDate(resultado.fechaDatoInicial)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Índice actualización
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {formatNumber(resultado.valorIndiceActualizacion, 6)} {resultado.indice}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Fecha dato: {formatDate(resultado.fechaDatoActualizacion)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-900">
                <strong>Método:</strong> {resultado.metodo}. Fuente: {resultado.fuente}.
                {resultado.cantidadPeriodos ? (
                  <> Períodos considerados: {resultado.cantidadPeriodos}.</>
                ) : null}
                <br />
                {resultado.nota}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                🏠
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                Completá los datos del contrato
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                La calculadora va a buscar los valores históricos disponibles y calculará el ajuste entre ambas fechas.
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Resultado orientativo. La aplicación contractual del índice puede variar según fecha de firma, tipo de contrato,
        normativa aplicable y cláusulas pactadas entre las partes.
      </p>
    </section>
  );
}
