import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type IndiceAjuste = "ICL" | "UVA" | "CER" | "IPC";

type RawSerieItem = {
  fecha?: string;
  valor?: number;
};

type AjusteRequest = {
  indice?: IndiceAjuste;
  montoInicial?: number | string;
  fechaInicio?: string;
  fechaActualizacion?: string;
};

type SeriePoint = {
  fecha: string;
  valor: number;
};

const BCRA_BASE_URL = "https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias";
const ARG_DATOS_BASE_URL = "https://api.argentinadatos.com/v1/finanzas/indices";

const BCRA_VARIABLE_IDS: Record<Exclude<IndiceAjuste, "IPC">, number> = {
  ICL: 40,
  UVA: 31,
  CER: 30,
};

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const normalized = value.trim().replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeDate(value?: string | null): string | null {
  if (!value) return null;
  const datePart = value.includes("T") ? value.split("T")[0] : value;
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

function toDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function compareIsoDates(a: string, b: string): number {
  return a.localeCompare(b);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        "User-Agent": "VAI-Prop/1.0",
      },
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBcraSerie(idVariable: number): Promise<SeriePoint[]> {
  const payload = await fetchJson<{
    results?: Array<{ idVariable?: number; detalle?: RawSerieItem[] }>;
  }>(`${BCRA_BASE_URL}/${idVariable}?Limit=5000`);

  const detalle = payload?.results?.[0]?.detalle;
  if (!Array.isArray(detalle)) return [];

  return detalle
    .map((item) => {
      const fecha = normalizeDate(item.fecha);
      const valor = parseNumber(item.valor);
      if (!fecha || valor == null) return null;
      return { fecha, valor };
    })
    .filter((item): item is SeriePoint => item !== null)
    .sort((a, b) => compareIsoDates(a.fecha, b.fecha));
}

async function fetchIpcMensual(): Promise<SeriePoint[]> {
  const payload = await fetchJson<RawSerieItem[]>(`${ARG_DATOS_BASE_URL}/inflacion`);

  if (!Array.isArray(payload)) return [];

  return payload
    .map((item) => {
      const fecha = normalizeDate(item.fecha);
      const valor = parseNumber(item.valor);
      if (!fecha || valor == null) return null;
      return { fecha, valor };
    })
    .filter((item): item is SeriePoint => item !== null)
    .sort((a, b) => compareIsoDates(a.fecha, b.fecha));
}

function pickPointForDate(series: SeriePoint[], targetDate: string): SeriePoint | null {
  if (!series.length) return null;

  const priorOrSame = [...series]
    .filter((item) => compareIsoDates(item.fecha, targetDate) <= 0)
    .sort((a, b) => compareIsoDates(b.fecha, a.fecha))[0];

  if (priorOrSame) return priorOrSame;

  return [...series].sort((a, b) => compareIsoDates(a.fecha, b.fecha))[0] ?? null;
}

function firstDayOfMonth(dateIso: string): string {
  const [year, month] = dateIso.split("-");
  return `${year}-${month}-01`;
}

function calculateIpcFactor(series: SeriePoint[], fechaInicio: string, fechaActualizacion: string) {
  const startMonth = firstDayOfMonth(fechaInicio);
  const endMonth = firstDayOfMonth(fechaActualizacion);

  const included = series.filter(
    (item) => compareIsoDates(item.fecha, startMonth) > 0 && compareIsoDates(item.fecha, endMonth) <= 0
  );

  if (!included.length) return null;

  const factor = included.reduce((acc, item) => acc * (1 + item.valor / 100), 1);
  const first = included[0];
  const last = included[included.length - 1];

  return {
    factor,
    first,
    last,
    cantidadPeriodos: included.length,
  };
}

function buildError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as AjusteRequest | null;

    const indice = body?.indice;
    const montoInicial = parseNumber(body?.montoInicial);
    const fechaInicio = normalizeDate(body?.fechaInicio);
    const fechaActualizacion = normalizeDate(body?.fechaActualizacion);

    if (!indice || !["ICL", "UVA", "CER", "IPC"].includes(indice)) {
      return buildError("Seleccioná un índice válido.");
    }

    if (montoInicial == null || montoInicial <= 0) {
      return buildError("Ingresá un monto inicial válido.");
    }

    if (!fechaInicio || !fechaActualizacion) {
      return buildError("Ingresá una fecha de inicio y una fecha de actualización válidas.");
    }

    if (toDate(fechaActualizacion).getTime() <= toDate(fechaInicio).getTime()) {
      return buildError("La fecha de actualización debe ser posterior a la fecha de inicio.");
    }

    if (indice === "IPC") {
      const series = await fetchIpcMensual();
      const ipcCalc = calculateIpcFactor(series, fechaInicio, fechaActualizacion);

      if (!ipcCalc) {
        return buildError(
          "No hay datos suficientes de IPC para el período seleccionado.",
          404
        );
      }

      const factor = ipcCalc.factor;
      const montoActualizado = montoInicial * factor;
      const aumentoMonto = montoActualizado - montoInicial;
      const aumentoPorcentaje = (factor - 1) * 100;

      return NextResponse.json(
        {
          ok: true,
          indice,
          fuente: "ArgentinaDatos",
          metodo: "IPC mensual acumulado",
          montoInicial: roundMoney(montoInicial),
          montoActualizado: roundMoney(montoActualizado),
          aumentoMonto: roundMoney(aumentoMonto),
          aumentoPorcentaje: roundRatio(aumentoPorcentaje),
          factor: roundRatio(factor),
          fechaInicio,
          fechaActualizacion,
          fechaDatoInicial: ipcCalc.first.fecha,
          fechaDatoActualizacion: ipcCalc.last.fecha,
          valorIndiceInicial: 1,
          valorIndiceActualizacion: roundRatio(factor),
          cantidadPeriodos: ipcCalc.cantidadPeriodos,
          unidadMonto: "ARS",
          nota:
            "Cálculo orientativo por acumulación compuesta de IPC mensual publicado para los meses disponibles del período.",
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const idVariable = BCRA_VARIABLE_IDS[indice];
    const series = await fetchBcraSerie(idVariable);

    const startPoint = pickPointForDate(series, fechaInicio);
    const endPoint = pickPointForDate(series, fechaActualizacion);

    if (!startPoint || !endPoint || startPoint.valor <= 0 || endPoint.valor <= 0) {
      return buildError(
        `No hay datos suficientes de ${indice} para el período seleccionado.`,
        404
      );
    }

    const factor = endPoint.valor / startPoint.valor;
    const montoActualizado = montoInicial * factor;
    const aumentoMonto = montoActualizado - montoInicial;
    const aumentoPorcentaje = (factor - 1) * 100;

    return NextResponse.json(
      {
        ok: true,
        indice,
        fuente: "BCRA",
        metodo: `${indice} actual / ${indice} inicial`,
        montoInicial: roundMoney(montoInicial),
        montoActualizado: roundMoney(montoActualizado),
        aumentoMonto: roundMoney(aumentoMonto),
        aumentoPorcentaje: roundRatio(aumentoPorcentaje),
        factor: roundRatio(factor),
        fechaInicio,
        fechaActualizacion,
        fechaDatoInicial: startPoint.fecha,
        fechaDatoActualizacion: endPoint.fecha,
        valorIndiceInicial: roundRatio(startPoint.valor),
        valorIndiceActualizacion: roundRatio(endPoint.valor),
        cantidadPeriodos: null,
        unidadMonto: "ARS",
        nota:
          "Cálculo orientativo según la variación del índice publicado entre la fecha inicial y la fecha de actualización.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Error calculando actualización de alquiler:", error);
    return buildError("No se pudo calcular la actualización del alquiler.", 500);
  }
}
