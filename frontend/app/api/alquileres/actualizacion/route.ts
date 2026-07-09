import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type IndiceAjuste = "ICL" | "IPC";
type FrecuenciaMeses = 1 | 2 | 3 | 4 | 6 | 12;

type RawSerieItem = {
  fecha?: string;
  valor?: number | string;
};

type RawBcraVariable = {
  idVariable?: number;
  descripcion?: string;
  ultFechaInformada?: string;
  ultValorInformado?: number | string;
};

type AjusteRequest = {
  indice?: IndiceAjuste;
  montoInicial?: number | string;
  fechaInicio?: string;
  fechaActualizacion?: string;
  frecuenciaMeses?: FrecuenciaMeses | number | string;
};

type SeriePoint = {
  fecha: string;
  valor: number;
};

type IpcPeriodoAplicado = {
  mes: string;
  fechaDato: string;
  valor: number;
};

const BCRA_BASE_URL = "https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias";
const ARG_DATOS_BASE_URL = "https://api.argentinadatos.com/v1/finanzas/indices";
const FRECUENCIAS_VALIDAS = [1, 2, 3, 4, 6, 12] as const;
const ICL_FALLBACK_VARIABLE_IDS = [40, 41, 42, 43, 44, 45, 46, 47];

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const normalized = value.trim().replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseFrecuencia(value: unknown): FrecuenciaMeses | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return FRECUENCIAS_VALIDAS.includes(parsed as FrecuenciaMeses)
    ? (parsed as FrecuenciaMeses)
    : null;
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

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonthsIso(dateIso: string, months: number): string {
  const date = toDate(dateIso);
  const originalDay = date.getDate();
  date.setMonth(date.getMonth() + months);

  // Evita saltos raros cuando el día original no existe en el mes destino.
  if (date.getDate() !== originalDay) {
    date.setDate(0);
  }

  return toIsoDate(date);
}

function subtractDaysIso(dateIso: string, days: number): string {
  const date = toDate(dateIso);
  date.setDate(date.getDate() - days);
  return toIsoDate(date);
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

function monthKey(dateIso: string): string {
  return dateIso.slice(0, 7);
}

function addMonthsToMonthKey(startMonth: string, offset: number): string {
  const [year, month] = startMonth.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1, 12, 0, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthKeys(fechaInicio: string, frecuenciaMeses: FrecuenciaMeses): string[] {
  const startMonth = monthKey(fechaInicio);
  return Array.from({ length: frecuenciaMeses }, (_, index) =>
    addMonthsToMonthKey(startMonth, index)
  );
}

function normalizeText(value?: string | null): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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
        "Accept-Language": "es-AR,es;q=0.9",
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

async function fetchBcraVariables(): Promise<RawBcraVariable[]> {
  const payload = await fetchJson<{ results?: RawBcraVariable[] }>(
    `${BCRA_BASE_URL}?Limit=300`
  );

  const results = payload?.results;
  return Array.isArray(results) ? results : [];
}

function findIclVariableId(variables: RawBcraVariable[]): number | null {
  const exact = variables.find((item) => {
    const description = normalizeText(item.descripcion);
    return (
      typeof item.idVariable === "number" &&
      (description.includes("contratos de locacion") ||
        description.includes("contratos de locación") ||
        description.includes("lease contracts") ||
        description.includes("icl"))
    );
  });

  return typeof exact?.idVariable === "number" ? exact.idVariable : null;
}

async function fetchBcraSerieById(
  idVariable: number,
  desde: string,
  hasta: string
): Promise<SeriePoint[]> {
  const url = `${BCRA_BASE_URL}/${idVariable}?Desde=${encodeURIComponent(
    desde
  )}&Hasta=${encodeURIComponent(hasta)}&Limit=5000`;

  const payload = await fetchJson<{
    results?: Array<{ idVariable?: number; detalle?: RawSerieItem[] }>;
  }>(url);

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

async function fetchIclSerie(fechaInicio: string, fechaActualizacion: string) {
  const desde = subtractDaysIso(fechaInicio, 12);
  const hasta = fechaActualizacion;
  const variables = await fetchBcraVariables();
  const discoveredId = findIclVariableId(variables);
  const candidateIds = [discoveredId, ...ICL_FALLBACK_VARIABLE_IDS].filter(
    (value, index, arr): value is number =>
      typeof value === "number" && arr.indexOf(value) === index
  );

  for (const idVariable of candidateIds) {
    const serie = await fetchBcraSerieById(idVariable, desde, hasta);
    if (serie.length >= 2) {
      return { idVariable, serie };
    }
  }

  return { idVariable: discoveredId, serie: [] as SeriePoint[] };
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

function calculateIpcFactor(
  series: SeriePoint[],
  fechaInicio: string,
  frecuenciaMeses: FrecuenciaMeses
) {
  const requiredMonths = buildMonthKeys(fechaInicio, frecuenciaMeses);
  const byMonth = new Map<string, SeriePoint>();

  for (const item of series) {
    byMonth.set(monthKey(item.fecha), item);
  }

  const included: IpcPeriodoAplicado[] = [];
  const missing: string[] = [];

  for (const requiredMonth of requiredMonths) {
    const point = byMonth.get(requiredMonth);
    if (!point) {
      missing.push(requiredMonth);
      continue;
    }

    included.push({
      mes: requiredMonth,
      fechaDato: point.fecha,
      valor: point.valor,
    });
  }

  if (missing.length) {
    return { factor: null, included, missing };
  }

  const factor = included.reduce((acc, item) => acc * (1 + item.valor / 100), 1);

  return {
    factor,
    included,
    missing,
  };
}

function buildError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...(extra || {}) }, { status });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as AjusteRequest | null;

    const indice = body?.indice;
    const montoInicial = parseNumber(body?.montoInicial);
    const fechaInicio = normalizeDate(body?.fechaInicio);
    const frecuenciaMeses = parseFrecuencia(body?.frecuenciaMeses);

    if (!indice || !["ICL", "IPC"].includes(indice)) {
      return buildError("Seleccioná un índice válido para alquileres: ICL o IPC.");
    }

    if (!frecuenciaMeses) {
      return buildError("Seleccioná una frecuencia válida: 1, 2, 3, 4, 6 o 12 meses.");
    }

    if (montoInicial == null || montoInicial <= 0) {
      return buildError("Ingresá un monto inicial válido.");
    }

    if (!fechaInicio) {
      return buildError("Ingresá una fecha de inicio válida.");
    }

    const fechaActualizacion =
      normalizeDate(body?.fechaActualizacion) || addMonthsIso(fechaInicio, frecuenciaMeses);

    if (toDate(fechaActualizacion).getTime() <= toDate(fechaInicio).getTime()) {
      return buildError("La fecha de actualización debe ser posterior a la fecha de inicio.");
    }

    if (indice === "IPC") {
      const series = await fetchIpcMensual();
      const ipcCalc = calculateIpcFactor(series, fechaInicio, frecuenciaMeses);

      if (!ipcCalc.factor) {
        return buildError(
          `No hay datos oficiales suficientes de IPC para completar ${frecuenciaMeses} mes${
            frecuenciaMeses === 1 ? "" : "es"
          } desde ${fechaInicio}.`,
          404,
          {
            indice,
            fuente: "ArgentinaDatos",
            mesesRequeridos: buildMonthKeys(fechaInicio, frecuenciaMeses),
            mesesDisponibles: ipcCalc.included.map((item) => item.mes),
            mesesFaltantes: ipcCalc.missing,
          }
        );
      }

      const factor = ipcCalc.factor;
      const montoActualizado = montoInicial * factor;
      const aumentoMonto = montoActualizado - montoInicial;
      const aumentoPorcentaje = (factor - 1) * 100;
      const first = ipcCalc.included[0];
      const last = ipcCalc.included[ipcCalc.included.length - 1];

      return NextResponse.json(
        {
          ok: true,
          indice,
          fuente: "ArgentinaDatos",
          metodo: "IPC mensual compuesto por frecuencia",
          frecuenciaMeses,
          montoInicial: roundMoney(montoInicial),
          montoActualizado: roundMoney(montoActualizado),
          montoActual: roundMoney(montoActualizado),
          aumentoMonto: roundMoney(aumentoMonto),
          aumentoPorcentaje: roundRatio(aumentoPorcentaje),
          variacionAcumulada: roundRatio(aumentoPorcentaje),
          factor: roundRatio(factor),
          fechaInicio,
          fechaActualizacion,
          fechaDatoInicial: first?.fechaDato ?? fechaInicio,
          fechaDatoActualizacion: last?.fechaDato ?? fechaActualizacion,
          valorIndiceInicial: 1,
          valorIndiceActualizacion: roundRatio(factor),
          cantidadPeriodos: ipcCalc.included.length,
          periodosAplicados: ipcCalc.included,
          unidadMonto: "ARS",
          nota:
            "Cálculo orientativo por acumulación compuesta de IPC mensual para la frecuencia seleccionada.",
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const { idVariable, serie } = await fetchIclSerie(fechaInicio, fechaActualizacion);
    const startPoint = pickPointForDate(serie, fechaInicio);
    const endPoint = pickPointForDate(serie, fechaActualizacion);

    if (!startPoint || !endPoint || startPoint.valor <= 0 || endPoint.valor <= 0) {
      return buildError(
        "No hay datos suficientes de ICL para el período seleccionado.",
        404,
        {
          indice,
          fuente: "BCRA",
          idVariable,
          fechaInicio,
          fechaActualizacion,
          puntosEncontrados: serie.length,
        }
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
        metodo: "ICL actual / ICL inicial",
        frecuenciaMeses,
        montoInicial: roundMoney(montoInicial),
        montoActualizado: roundMoney(montoActualizado),
        montoActual: roundMoney(montoActualizado),
        aumentoMonto: roundMoney(aumentoMonto),
        aumentoPorcentaje: roundRatio(aumentoPorcentaje),
        variacionAcumulada: roundRatio(aumentoPorcentaje),
        factor: roundRatio(factor),
        fechaInicio,
        fechaActualizacion,
        fechaDatoInicial: startPoint.fecha,
        fechaDatoActualizacion: endPoint.fecha,
        valorIndiceInicial: roundRatio(startPoint.valor),
        valorIndiceActualizacion: roundRatio(endPoint.valor),
        cantidadPeriodos: null,
        periodosAplicados: null,
        unidadMonto: "ARS",
        idVariable,
        nota:
          "Cálculo orientativo según la variación del ICL publicado por BCRA entre la fecha inicial y la fecha de actualización. Si la fecha cae en día no hábil, se usa el último dato disponible anterior.",
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
