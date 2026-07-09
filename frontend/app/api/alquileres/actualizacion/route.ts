import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type IndiceAjuste = "ICL" | "IPC";
type FrecuenciaMeses = 1 | 2 | 3 | 4 | 6 | 12;

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
  fuente?: "BCRA" | "DatosGobAr" | "ArgentinaDatos" | "CUCICBA";
  proyectado?: boolean;
};

type BcraSeriePayload = {
  results?: Array<{
    idVariable?: number;
    detalle?: Array<{
      fecha?: string;
      valor?: number | string;
    }>;
  }>;
};

type ColegioResult = {
  montoInicial: number;
  montoActualizado: number;
  aumentoPorcentaje: number;
  valorIndiceInicial: number | null;
  valorIndiceActualizacion: number | null;
  proyectado: boolean;
};

const BCRA_BASE_URL = "https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias";
const BCRA_V3_BASE_URL = "https://api.bcra.gob.ar/estadisticas/v3.0/Monetarias";
const DATOS_GOB_SERIES_URL = "https://apis.datos.gob.ar/series/api/series";
const ARG_DATOS_BASE_URL = "https://api.argentinadatos.com/v1/finanzas/indices";

const BCRA_SERIE_ICL = 7988;
const DATOS_GOB_IPC_NIVEL_GENERAL = "145.3_INGNACNAL_DICI_M_15";
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

function monthKey(dateIso: string): string {
  return dateIso.slice(0, 7);
}

function monthKeyToIso(month: string): string {
  return `${month}-01`;
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

  if (end.getDate() < start.getDate()) months -= 1;
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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}

function frecuenciaToColegio(value: FrecuenciaMeses): string {
  if (value === 1) return "mensual";
  if (value === 2) return "bimestral";
  if (value === 3) return "trimestral";
  if (value === 4) return "cuatrimestral";
  if (value === 6) return "semestral";
  return "anual";
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#36;/g, "$ ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
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

function mapBcraSerie(payload: BcraSeriePayload | null): SeriePoint[] {
  const detalle = payload?.results?.[0]?.detalle;
  if (!Array.isArray(detalle)) return [];

  const points: SeriePoint[] = [];

  for (const item of detalle) {
    const fecha = normalizeDate(item.fecha);
    const valor = parseNumber(item.valor);
    if (!fecha || valor == null) continue;
    points.push({ fecha, valor, fuente: "BCRA" });
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
    `${BCRA_BASE_URL}/${idVariable}?Desde=${encodeURIComponent(desdeDateTime)}&Hasta=${encodeURIComponent(hastaDateTime)}&Limit=5000`,
    `${BCRA_BASE_URL}/${idVariable}?Desde=${encodeURIComponent(desde)}&Hasta=${encodeURIComponent(hasta)}&Limit=5000`,
    `${BCRA_V3_BASE_URL}/${idVariable}?Desde=${encodeURIComponent(desdeDateTime)}&Hasta=${encodeURIComponent(hastaDateTime)}&Limit=5000`,
    `${BCRA_V3_BASE_URL}/${idVariable}?Desde=${encodeURIComponent(desde)}&Hasta=${encodeURIComponent(hasta)}&Limit=5000`,
  ];

  for (const url of urls) {
    const payload = await fetchJson<BcraSeriePayload>(url);
    const serie = mapBcraSerie(payload);
    if (serie.length > 0) return serie;
  }

  return [];
}

async function fetchIpcNivelDatosGob(
  fechaInicio: string,
  fechaActualizacion: string
): Promise<SeriePoint[]> {
  const desde = subtractDaysIso(fechaInicio, 45);
  const hasta = addMonthsIso(fechaActualizacion, 2);
  const url =
    `${DATOS_GOB_SERIES_URL}?ids=${encodeURIComponent(DATOS_GOB_IPC_NIVEL_GENERAL)}` +
    `&start_date=${encodeURIComponent(desde)}` +
    `&end_date=${encodeURIComponent(hasta)}` +
    `&format=json`;

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

function indexSeriesByMonth(series: SeriePoint[]): Map<string, SeriePoint> {
  const map = new Map<string, SeriePoint>();
  for (const point of series) map.set(monthKey(point.fecha), point);
  return map;
}

function monthlyRatesFromIndex(series: SeriePoint[]): number[] {
  const sorted = [...series].sort((a, b) => compareIsoDates(a.fecha, b.fecha));
  const rates: number[] = [];

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.valor > 0 && curr.valor > 0) {
      rates.push(curr.valor / prev.valor - 1);
    }
  }

  return rates.filter((rate) => Number.isFinite(rate));
}

function projectIndexSeriesToMonth(
  series: SeriePoint[],
  targetMonth: string
): SeriePoint[] {
  const sorted = [...series].sort((a, b) => compareIsoDates(a.fecha, b.fecha));
  if (!sorted.length) return [];

  const projected = [...sorted];
  const rates = monthlyRatesFromIndex(sorted);
  const trendRates = rates.slice(-3);
  const avgRate = trendRates.length
    ? trendRates.reduce((sum, rate) => sum + rate, 0) / trendRates.length
    : 0;

  let latest = projected[projected.length - 1];
  let latestMonth = monthKey(latest.fecha);

  while (latestMonth < targetMonth) {
    const nextMonth = addMonthsToMonthKey(latestMonth, 1);
    const nextValue = latest.valor * (1 + avgRate);
    latest = {
      fecha: monthKeyToIso(nextMonth),
      valor: nextValue,
      fuente: latest.fuente || "DatosGobAr",
      proyectado: true,
    };
    projected.push(latest);
    latestMonth = nextMonth;
  }

  return projected;
}

function pickPointByMonth(series: SeriePoint[], targetMonth: string): SeriePoint | null {
  const map = indexSeriesByMonth(series);
  return map.get(targetMonth) ?? null;
}

function pickPointForDate(series: SeriePoint[], targetDate: string): SeriePoint | null {
  if (!series.length) return null;
  const priorOrSame = [...series]
    .filter((item) => compareIsoDates(item.fecha, targetDate) <= 0)
    .sort((a, b) => compareIsoDates(b.fecha, a.fecha))[0];
  return priorOrSame ?? null;
}

async function fetchColegioCalculator(
  indice: IndiceAjuste,
  montoInicial: number,
  fechaInicio: string,
  frecuenciaMeses: FrecuenciaMeses
): Promise<ColegioResult | null> {
  const url =
    "https://www.colegioinmobiliario.org.ar/servicios/calculadora-alquileres" +
    `?monto=${encodeURIComponent(String(montoInicial))}` +
    `&fecha_inicio=${encodeURIComponent(fechaInicio)}` +
    `&frecuencia=${encodeURIComponent(frecuenciaToColegio(frecuenciaMeses))}` +
    `&indice=${encodeURIComponent(indice)}`;

  const html = await fetchText(url);
  if (!html) return null;

  const text = stripHtml(html);
  const projected = /\*/.test(text) || /proyectad/i.test(text);

  const montoInicialMatch = text.match(/Monto inicial\s*\$\s*([0-9.]+,[0-9]{2})/i);
  const montoActualMatch = text.match(/Monto actual\s*\$\s*([0-9.]+,[0-9]{2})/i);
  const variacionMatch = text.match(/Variaci[oó]n acumulada\s*\+?\s*([0-9.,]+)\s*%/i);

  const parsedMontoInicial = parseNumber(montoInicialMatch?.[1]);
  const parsedMontoActual = parseNumber(montoActualMatch?.[1]);
  const parsedVariacion = parseNumber(variacionMatch?.[1]);

  if (parsedMontoActual == null || parsedVariacion == null) return null;

  const periodPattern = /(\d{2}\/\d{4})\s+(?:Inicio\s+)?([0-9.]+,[0-9]{2})/g;
  const values: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = periodPattern.exec(text)) !== null) {
    const value = parseNumber(match[2]);
    if (value != null) values.push(value);
  }

  return {
    montoInicial: parsedMontoInicial ?? montoInicial,
    montoActualizado: parsedMontoActual,
    aumentoPorcentaje: parsedVariacion,
    valorIndiceInicial: values.length ? values[0] : null,
    valorIndiceActualizacion: values.length > 1 ? values[values.length - 1] : null,
    proyectado: projected,
  };
}

async function fetchIclSerie(fechaInicio: string, fechaActualizacion: string): Promise<SeriePoint[]> {
  const desde = subtractDaysIso(fechaInicio, 45);
  const hasta = addMonthsIso(fechaActualizacion, 1);
  return fetchBcraSerieById(BCRA_SERIE_ICL, desde, hasta);
}

function buildError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...(extra || {}) }, { status });
}

function buildSuccessResponse(args: {
  indice: IndiceAjuste;
  fuente: string;
  metodo: string;
  frecuenciaMeses: FrecuenciaMeses;
  fechaInicio: string;
  fechaActualizacion: string;
  fechaCalculo: string;
  mesesAplicados: number;
  ciclosAplicados: number;
  montoInicial: number;
  montoActualizado: number;
  factor: number;
  valorIndiceInicial: number | null;
  valorIndiceActualizacion: number | null;
  fechaDatoInicial: string;
  fechaDatoActualizacion: string;
  periodosAplicados?: Array<{ mes: string; fechaDato: string; valor: number; fuente?: string; proyectado?: boolean }> | null;
  nota: string;
}) {
  const aumentoMonto = args.montoActualizado - args.montoInicial;
  const aumentoPorcentaje = (args.factor - 1) * 100;

  return NextResponse.json(
    {
      ok: true,
      indice: args.indice,
      fuente: args.fuente,
      metodo: args.metodo,
      frecuenciaMeses: args.frecuenciaMeses,
      fechaCalculo: args.fechaCalculo,
      mesesAplicados: args.mesesAplicados,
      ciclosAplicados: args.ciclosAplicados,
      montoInicial: roundMoney(args.montoInicial),
      montoActualizado: roundMoney(args.montoActualizado),
      montoActual: roundMoney(args.montoActualizado),
      aumentoMonto: roundMoney(aumentoMonto),
      aumentoPorcentaje: roundRatio(aumentoPorcentaje),
      variacionAcumulada: roundRatio(aumentoPorcentaje),
      factor: roundRatio(args.factor),
      fechaInicio: args.fechaInicio,
      fechaActualizacion: args.fechaActualizacion,
      fechaDatoInicial: args.fechaDatoInicial,
      fechaDatoActualizacion: args.fechaDatoActualizacion,
      valorIndiceInicial: args.valorIndiceInicial == null ? 1 : roundRatio(args.valorIndiceInicial),
      valorIndiceActualizacion:
        args.valorIndiceActualizacion == null ? roundRatio(args.factor) : roundRatio(args.valorIndiceActualizacion),
      cantidadPeriodos: args.periodosAplicados?.length ?? null,
      periodosAplicados: args.periodosAplicados ?? null,
      unidadMonto: "ARS",
      nota: args.nota,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
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

    const fechaCalculo =
      normalizeDate(body?.fechaCalculo) ||
      normalizeDate(body?.fechaActualizacion) ||
      toIsoDate(new Date());

    if (toDate(fechaCalculo).getTime() <= toDate(fechaInicio).getTime()) {
      return buildError("La fecha de cálculo debe ser posterior a la fecha de inicio.");
    }

    const resolved = resolveFechaActualizacion(
      fechaInicio,
      frecuenciaMeses,
      fechaCalculo
    );

    const fechaActualizacion = resolved.fechaActualizacion;
    const mesesAplicados = resolved.mesesAplicados;
    const ciclosAplicados = resolved.ciclosAplicados;

    if (mesesAplicados < frecuenciaMeses || ciclosAplicados < 1) {
      return buildError(
        `Todavía no corresponde aplicar ajuste: no se completó un período de ${frecuenciaMeses} mes${
          frecuenciaMeses === 1 ? "" : "es"
        } desde ${fechaInicio}.`,
        400,
        { indice, frecuenciaMeses, fechaInicio, fechaCalculo, fechaActualizacion, mesesAplicados, ciclosAplicados }
      );
    }

    if (indice === "IPC") {
      const serieOriginal = await fetchIpcNivelDatosGob(fechaInicio, fechaActualizacion);
      const targetStartMonth = monthKey(fechaInicio);
      const targetEndMonth = monthKey(fechaActualizacion);
      const serieConProyeccion = projectIndexSeriesToMonth(serieOriginal, targetEndMonth);
      const startPoint = pickPointByMonth(serieConProyeccion, targetStartMonth);
      const endPoint = pickPointByMonth(serieConProyeccion, targetEndMonth);

      if (startPoint && endPoint && startPoint.valor > 0 && endPoint.valor > 0) {
        const factor = endPoint.valor / startPoint.valor;
        const montoActualizado = montoInicial * factor;
        const endProjected = Boolean(endPoint.proyectado);

        return buildSuccessResponse({
          indice,
          fuente: endProjected ? "DatosGobAr / proyección por tendencia" : "DatosGobAr",
          metodo: endProjected ? "IPC nivel general con proyección de meses no publicados" : "IPC nivel general oficial",
          frecuenciaMeses,
          fechaInicio,
          fechaActualizacion,
          fechaCalculo,
          mesesAplicados,
          ciclosAplicados,
          montoInicial,
          montoActualizado,
          factor,
          valorIndiceInicial: startPoint.valor,
          valorIndiceActualizacion: endPoint.valor,
          fechaDatoInicial: startPoint.fecha,
          fechaDatoActualizacion: endPoint.fecha,
          periodosAplicados: [
            {
              mes: targetEndMonth,
              fechaDato: endPoint.fecha,
              valor: (factor - 1) * 100,
              fuente: endProjected ? "DatosGobAr / proyección" : "DatosGobAr",
              proyectado: endProjected,
            },
          ],
          nota: endProjected
            ? "Cálculo orientativo. El IPC del período final todavía no estaba publicado en datos.gob.ar, por eso se proyectó usando la tendencia de los últimos meses disponibles."
            : "Cálculo orientativo según IPC Nivel General Nacional publicado en datos.gob.ar.",
        });
      }

      const colegio = await fetchColegioCalculator(
        indice,
        montoInicial,
        fechaInicio,
        frecuenciaMeses
      );

      if (colegio) {
        const factor = colegio.montoActualizado / montoInicial;
        return buildSuccessResponse({
          indice,
          fuente: colegio.proyectado ? "DatosGobAr / CUCICBA proyección" : "DatosGobAr / CUCICBA",
          metodo: colegio.proyectado ? "IPC con proyección de valores no publicados" : "IPC nivel general",
          frecuenciaMeses,
          fechaInicio,
          fechaActualizacion,
          fechaCalculo,
          mesesAplicados,
          ciclosAplicados,
          montoInicial,
          montoActualizado: colegio.montoActualizado,
          factor,
          valorIndiceInicial: colegio.valorIndiceInicial,
          valorIndiceActualizacion: colegio.valorIndiceActualizacion,
          fechaDatoInicial: fechaInicio,
          fechaDatoActualizacion: fechaActualizacion,
          periodosAplicados: [
            {
              mes: monthKey(fechaActualizacion),
              fechaDato: fechaActualizacion,
              valor: colegio.aumentoPorcentaje,
              fuente: colegio.proyectado ? "CUCICBA proyección" : "CUCICBA",
              proyectado: colegio.proyectado,
            },
          ],
          nota: colegio.proyectado
            ? "Cálculo orientativo con valor proyectado para el último período, similar al criterio usado por calculadoras profesionales cuando el dato oficial aún no está publicado."
            : "Cálculo orientativo basado en valores públicos del IPC.",
        });
      }

      return buildError(
        "No hay datos suficientes de IPC para el período seleccionado.",
        404,
        {
          indice,
          fuente: "DatosGobAr",
          puntosDatosGobAr: serieOriginal.length,
          fechaInicio,
          fechaActualizacion,
        }
      );
    }

    const serieIcl = await fetchIclSerie(fechaInicio, fechaActualizacion);
    const startPoint = pickPointForDate(serieIcl, fechaInicio);
    const endPoint = pickPointForDate(serieIcl, fechaActualizacion);

    if (startPoint && endPoint && startPoint.valor > 0 && endPoint.valor > 0) {
      const factor = endPoint.valor / startPoint.valor;
      const montoActualizado = montoInicial * factor;

      return buildSuccessResponse({
        indice,
        fuente: "BCRA",
        metodo: "ICL actual / ICL inicial",
        frecuenciaMeses,
        fechaInicio,
        fechaActualizacion,
        fechaCalculo,
        mesesAplicados,
        ciclosAplicados,
        montoInicial,
        montoActualizado,
        factor,
        valorIndiceInicial: startPoint.valor,
        valorIndiceActualizacion: endPoint.valor,
        fechaDatoInicial: startPoint.fecha,
        fechaDatoActualizacion: endPoint.fecha,
        periodosAplicados: null,
        nota:
          "Cálculo orientativo según la variación del ICL publicado por BCRA entre la fecha inicial y la fecha de actualización.",
      });
    }

    const colegio = await fetchColegioCalculator(
      indice,
      montoInicial,
      fechaInicio,
      frecuenciaMeses
    );

    if (colegio) {
      const factor = colegio.montoActualizado / montoInicial;
      return buildSuccessResponse({
        indice,
        fuente: "BCRA / CUCICBA fallback",
        metodo: "ICL de contratos de locación",
        frecuenciaMeses,
        fechaInicio,
        fechaActualizacion,
        fechaCalculo,
        mesesAplicados,
        ciclosAplicados,
        montoInicial,
        montoActualizado: colegio.montoActualizado,
        factor,
        valorIndiceInicial: colegio.valorIndiceInicial,
        valorIndiceActualizacion: colegio.valorIndiceActualizacion,
        fechaDatoInicial: fechaInicio,
        fechaDatoActualizacion: fechaActualizacion,
        periodosAplicados: null,
        nota:
          "Cálculo orientativo con fallback a CUCICBA porque la API del BCRA no devolvió puntos para el rango consultado desde Vercel.",
      });
    }

    return buildError(
      "No hay datos suficientes de ICL para el período seleccionado.",
      404,
      {
        indice,
        fuente: "BCRA",
        idVariable: BCRA_SERIE_ICL,
        fechaInicio,
        fechaActualizacion,
        puntosEncontrados: serieIcl.length,
      }
    );
  } catch (error) {
    console.error("Error calculando actualización de alquiler:", error);
    return buildError("No se pudo calcular la actualización del alquiler.", 500);
  }
}
