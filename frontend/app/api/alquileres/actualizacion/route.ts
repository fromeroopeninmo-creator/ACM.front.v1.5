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

type BcraSeriePayload = {
  results?: Array<{
    idVariable?: number;
    detalle?: RawSerieItem[];
  }>;
};

type AjusteRequest = {
  indice?: IndiceAjuste;
  montoInicial?: number | string;
  fechaInicio?: string;
  fechaActualizacion?: string;
  fechaCalculo?: string;
  frecuenciaMeses?: FrecuenciaMeses | number | string;
};

type SeriePoint = {
  fecha: string;
  valor: number;
  fuente?: "BCRA" | "DatosGobAr" | "ArgentinaDatos";
};

type IpcPeriodoAplicado = {
  mes: string;
  fechaDato: string;
  valor: number;
  fuente: "BCRA" | "DatosGobAr" | "ArgentinaDatos";
};

const BCRA_BASE_URL = "https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias";
const BCRA_V3_BASE_URL = "https://api.bcra.gob.ar/estadisticas/v3.0/Monetarias";
const ARG_DATOS_BASE_URL = "https://api.argentinadatos.com/v1/finanzas/indices";

const BCRA_VARIABLE_IDS = {
  // IDs reales de la página pública de Principales Variables del BCRA
  // Inflación mensual: /principales-variables-datos/?serie=7931
  // ICL: /principales-variables-datos/?serie=7988
  IPC_MENSUAL: 7931,
  ICL: 7988,
} as const;

const FRECUENCIAS_VALIDAS = [1, 2, 3, 4, 6, 12] as const;

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const normalized = trimmed.includes(",")
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed;

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

function monthsBetweenIso(startIso: string, endIso: string): number {
  const start = toDate(startIso);
  const end = toDate(endIso);

  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  if (end.getDate() < start.getDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

function resolveFechaActualizacion(
  fechaInicio: string,
  frecuenciaMeses: FrecuenciaMeses,
  fechaCalculo: string
): { fechaActualizacion: string; mesesAplicados: number; ciclosAplicados: number } {
  const mesesTranscurridos = monthsBetweenIso(fechaInicio, fechaCalculo);
  const ciclosAplicados = Math.floor(mesesTranscurridos / frecuenciaMeses);
  const mesesAplicados = ciclosAplicados * frecuenciaMeses;

  return {
    fechaActualizacion: addMonthsIso(fechaInicio, mesesAplicados),
    mesesAplicados,
    ciclosAplicados,
  };
}

function buildMonthKeys(fechaInicio: string, monthsToApply: number): string[] {
  const startMonth = monthKey(fechaInicio);
  return Array.from({ length: monthsToApply }, (_, index) =>
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
  const timeout = setTimeout(() => controller.abort(), 14000);

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

    const text = await response.text();
    if (!text.trim()) return null;

    return JSON.parse(text) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-AR,es;q=0.9",
        "User-Agent": "VAI-Prop/1.0",
      },
    });

    if (!response.ok) return null;
    const text = await response.text();
    return text.trim() ? text : null;
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

function findIclVariableId(variables: RawBcraVariable[]): number {
  const exact = variables.find((item) => {
    const description = normalizeText(item.descripcion);
    return (
      typeof item.idVariable === "number" &&
      (description.includes("contratos de locacion") ||
        description.includes("indice para contratos") ||
        description.includes("rental agreement index") ||
        description === "icl" ||
        description.includes(" icl"))
    );
  });

  return typeof exact?.idVariable === "number"
    ? exact.idVariable
    : BCRA_VARIABLE_IDS.ICL;
}

function mapBcraSerie(payload: BcraSeriePayload | null): SeriePoint[] {
  const detalle = payload?.results?.[0]?.detalle;
  if (!Array.isArray(detalle)) return [];

  const points: SeriePoint[] = [];

  for (const item of detalle) {
    const fecha = normalizeDate(item.fecha);
    const valor = parseNumber(item.valor);

    if (!fecha || valor == null) continue;

    points.push({
      fecha,
      valor,
      fuente: "BCRA",
    });
  }

  return points.sort((a, b) => compareIsoDates(a.fecha, b.fecha));
}

async function fetchBcraSerieById(
  idVariable: number,
  desde: string,
  hasta: string
): Promise<SeriePoint[]> {
  const desdeDateTime = `${desde}T00:00:00.000Z`;
  const hastaDateTime = `${hasta}T23:59:59.999Z`;

  const urls = [
    `${BCRA_BASE_URL}/${idVariable}?Desde=${encodeURIComponent(
      desdeDateTime
    )}&Hasta=${encodeURIComponent(hastaDateTime)}&Limit=5000`,
    `${BCRA_BASE_URL}/${idVariable}?Desde=${encodeURIComponent(
      desde
    )}&Hasta=${encodeURIComponent(hasta)}&Limit=5000`,
    `${BCRA_V3_BASE_URL}/${idVariable}?Desde=${encodeURIComponent(
      desdeDateTime
    )}&Hasta=${encodeURIComponent(hastaDateTime)}&Limit=5000`,
    `${BCRA_V3_BASE_URL}/${idVariable}?Desde=${encodeURIComponent(
      desde
    )}&Hasta=${encodeURIComponent(hasta)}&Limit=5000`,
  ];

  for (const url of urls) {
    const payload = await fetchJson<BcraSeriePayload>(url);
    const serie = mapBcraSerie(payload);
    if (serie.length > 0) return serie;
  }

  return [];
}

function parseBcraPublicDate(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function parseHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchBcraPublicIclSerie(): Promise<SeriePoint[]> {
  const urls = [
    "https://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables_datos.asp?serie=7988",
    "https://www.bcra.gov.ar/PublicacionesEstadisticas/Principales_variables_datos.asp?serie=7988",
  ];

  for (const url of urls) {
    const html = await fetchText(url);
    if (!html) continue;

    const clean = parseHtmlEntities(html);
    const points: SeriePoint[] = [];
    const pattern = /(\d{2}\/\d{2}\/\d{4})\s+([0-9]{1,6}(?:[.,][0-9]{1,6})?)/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(clean)) !== null) {
      const fecha = parseBcraPublicDate(match[1]);
      const valor = parseNumber(match[2]);

      if (!fecha || valor == null) continue;
      points.push({ fecha, valor, fuente: "BCRA" });
    }

    const unique = new Map<string, SeriePoint>();
    for (const point of points) unique.set(point.fecha, point);

    const serie = Array.from(unique.values()).sort((a, b) =>
      compareIsoDates(a.fecha, b.fecha)
    );

    if (serie.length > 0) return serie;
  }

  return [];
}

async function fetchIclSerie(fechaInicio: string, fechaActualizacion: string) {
  const desde = subtractDaysIso(fechaInicio, 45);
  const hasta = fechaActualizacion;
  const idVariable = BCRA_VARIABLE_IDS.ICL;

  const serieApi = await fetchBcraSerieById(idVariable, desde, hasta);
  if (serieApi.length > 0) return { idVariable, serie: serieApi };

  const seriePublica = await fetchBcraPublicIclSerie();
  const serieFiltrada = seriePublica.filter(
    (item) =>
      compareIsoDates(item.fecha, desde) >= 0 &&
      compareIsoDates(item.fecha, hasta) <= 0
  );

  return { idVariable, serie: serieFiltrada.length ? serieFiltrada : seriePublica };
}

async function fetchIpcBcraMensual(
  fechaInicio: string,
  mesesAplicados: number
): Promise<SeriePoint[]> {
  const desde = subtractDaysIso(fechaInicio, 45);
  const hasta = addMonthsIso(fechaInicio, mesesAplicados + 1);
  return fetchBcraSerieById(BCRA_VARIABLE_IDS.IPC_MENSUAL, desde, hasta);
}

async function fetchIpcDatosGob(fechaInicio: string, mesesAplicados: number): Promise<SeriePoint[]> {
  const desde = fechaInicio;
  const hasta = addMonthsIso(fechaInicio, mesesAplicados + 1);
  const url =
    "https://apis.datos.gob.ar/series/api/series" +
    `?ids=145.3_INGNACUAL_DICI_M_38&start_date=${encodeURIComponent(desde)}` +
    `&end_date=${encodeURIComponent(hasta)}&format=json`;

  const payload = await fetchJson<{ data?: unknown[][] }>(url);
  const rows = payload?.data;
  if (!Array.isArray(rows)) return [];

  const points: SeriePoint[] = [];

  for (const row of rows) {
    const fechaRaw = typeof row?.[0] === "string" ? row[0] : null;
    const fecha = normalizeDate(fechaRaw);
    const valor = parseNumber(row?.[1]);

    if (!fecha || valor == null) continue;
    points.push({ fecha, valor, fuente: "DatosGobAr" });
  }

  return points.sort((a, b) => compareIsoDates(a.fecha, b.fecha));
}

async function fetchIpcArgentinaDatos(): Promise<SeriePoint[]> {
  const payload = await fetchJson<RawSerieItem[]>(`${ARG_DATOS_BASE_URL}/inflacion`);

  if (!Array.isArray(payload)) return [];

  const points: SeriePoint[] = [];

  for (const item of payload) {
    const fecha = normalizeDate(item.fecha);
    const valor = parseNumber(item.valor);

    if (!fecha || valor == null) continue;

    points.push({
      fecha,
      valor,
      fuente: "ArgentinaDatos",
    });
  }

  return points.sort((a, b) => compareIsoDates(a.fecha, b.fecha));
}

function mergeIpcSeries(...seriesGroups: SeriePoint[][]): SeriePoint[] {
  const byMonth = new Map<string, SeriePoint>();

  for (const group of seriesGroups) {
    for (const item of group) {
      byMonth.set(monthKey(item.fecha), item);
    }
  }

  return Array.from(byMonth.values()).sort((a, b) => compareIsoDates(a.fecha, b.fecha));
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
  monthsToApply: number
) {
  const requiredMonths = buildMonthKeys(fechaInicio, monthsToApply);
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
      fuente: point.fuente || "BCRA",
    });
  }

  if (missing.length) {
    return { factor: null, included, missing, requiredMonths };
  }

  const factor = included.reduce((acc, item) => acc * (1 + item.valor / 100), 1);

  return {
    factor,
    included,
    missing,
    requiredMonths,
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

    const fechaCalculo = normalizeDate(body?.fechaCalculo) || normalizeDate(body?.fechaActualizacion) || toIsoDate(new Date());

    if (toDate(fechaCalculo).getTime() <= toDate(fechaInicio).getTime()) {
      return buildError("La fecha de cálculo debe ser posterior a la fecha de inicio.");
    }

    const resolved = resolveFechaActualizacion(
      fechaInicio,
      frecuenciaMeses,
      fechaCalculo
    );

    // Siempre calculamos hasta el último ciclo completo según fechaCalculo.
    // No usamos fechaActualizacion enviada desde versiones anteriores del componente,
    // porque hacía que un contrato trimestral de enero quedara fijo en abril.
    const fechaActualizacion = resolved.fechaActualizacion;
    const mesesAplicados = resolved.mesesAplicados;
    const ciclosAplicados = resolved.ciclosAplicados;

    if (mesesAplicados < frecuenciaMeses || ciclosAplicados < 1) {
      return buildError(
        `Todavía no corresponde aplicar ajuste: no se completó un período de ${frecuenciaMeses} mes${
          frecuenciaMeses === 1 ? "" : "es"
        } desde ${fechaInicio}.`,
        400,
        {
          indice,
          frecuenciaMeses,
          fechaInicio,
          fechaCalculo,
          fechaActualizacion,
          mesesAplicados,
          ciclosAplicados,
        }
      );
    }

    if (indice === "IPC") {
      const [datosGobSeries, bcraSeries, argentinaDatosSeries] = await Promise.all([
        fetchIpcDatosGob(fechaInicio, mesesAplicados),
        fetchIpcBcraMensual(fechaInicio, mesesAplicados),
        fetchIpcArgentinaDatos(),
      ]);

      // Orden de prioridad: ArgentinaDatos < BCRA < DatosGobAr.
      // datos.gob.ar se usa como fuente principal para IPC porque expone la serie oficial
      // 145.3_INGNACUAL_DICI_M_38 de variación mensual nacional.
      const mergedSeries = mergeIpcSeries(
        argentinaDatosSeries,
        bcraSeries,
        datosGobSeries
      );
      const ipcCalc = calculateIpcFactor(mergedSeries, fechaInicio, mesesAplicados);

      if (!ipcCalc.factor) {
        return buildError(
          `No hay datos oficiales suficientes de IPC para completar ${mesesAplicados} mes${
            mesesAplicados === 1 ? "" : "es"
          } desde ${fechaInicio}.`,
          404,
          {
            indice,
            fuente: "DatosGobAr / BCRA / ArgentinaDatos",
            mesesRequeridos: ipcCalc.requiredMonths,
            mesesDisponibles: ipcCalc.included.map((item) => item.mes),
            mesesFaltantes: ipcCalc.missing,
            puntosDatosGobAr: datosGobSeries.length,
            puntosBcra: bcraSeries.length,
            puntosArgentinaDatos: argentinaDatosSeries.length,
            detalle:
              "El cálculo IPC exige que estén publicados todos los meses de la frecuencia seleccionada.",
          }
        );
      }

      const factor = ipcCalc.factor;
      const montoActualizado = montoInicial * factor;
      const aumentoMonto = montoActualizado - montoInicial;
      const aumentoPorcentaje = (factor - 1) * 100;
      const first = ipcCalc.included[0];
      const last = ipcCalc.included[ipcCalc.included.length - 1];
      const fuentes = Array.from(new Set(ipcCalc.included.map((item) => item.fuente)));

      return NextResponse.json(
        {
          ok: true,
          indice,
          fuente: fuentes.join(" / "),
          metodo: "IPC mensual compuesto por frecuencia",
          frecuenciaMeses,
          fechaCalculo,
          mesesAplicados,
          ciclosAplicados,
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
          detalle:
            "Se intentó consultar la serie diaria oficial del ICL en BCRA usando la serie 7988 de Principales Variables. Si la API devuelve cero puntos, puede ser un problema temporal del endpoint o del rango solicitado.",
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
        fechaCalculo,
        mesesAplicados,
        ciclosAplicados,
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
