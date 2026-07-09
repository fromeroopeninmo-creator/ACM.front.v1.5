import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RawBcraVariable = {
  idVariable?: number;
  descripcion?: string;
  categoria?: string;
  tipoSerie?: string;
  periodicidad?: string;
  unidadExpresion?: string;
  moneda?: string;
  primerFechaInformada?: string;
  ultFechaInformada?: string;
  ultValorInformado?: number;
};

type RawSerieItem = {
  fecha?: string;
  valor?: number;
};

type Indicador = {
  codigo: "IPC_MENSUAL" | "IPC_INTERANUAL" | "UVA" | "CER" | "ICL";
  nombre: string;
  valor: number | null;
  unidad: "%" | "ARS" | "CER" | "ICL";
  valorFormateado: string;
  fecha: string | null;
  fuente: "BCRA" | "ArgentinaDatos" | "No disponible";
  descripcion: string;
};

const BCRA_BASE_URL = "https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias";
const ARG_DATOS_BASE_URL = "https://api.argentinadatos.com/v1/finanzas/indices";

const BCRA_VARIABLE_IDS = {
  IPC_MENSUAL: 27,
  CER: 30,
  UVA: 31,
  ICL: 40,
} as const;

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatNumber(value: number | null, maximumFractionDigits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function formatValue(
  value: number | null,
  unit: Indicador["unidad"],
  maxDecimals = 2
): string {
  if (value == null || !Number.isFinite(value)) return "—";

  if (unit === "%") {
    return `${formatNumber(value, maxDecimals)} %`;
  }

  if (unit === "ARS") {
    return `${formatNumber(value, maxDecimals)} ARS`;
  }

  return `${formatNumber(value, maxDecimals)} ${unit}`;
}

function normalizeDate(value?: string | null): string | null {
  if (!value) return null;
  const datePart = value.includes("T") ? value.split("T")[0] : value;
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : value;
}

function emptyIndicator(
  codigo: Indicador["codigo"],
  nombre: string,
  unidad: Indicador["unidad"],
  descripcion: string
): Indicador {
  return {
    codigo,
    nombre,
    valor: null,
    unidad,
    valorFormateado: "—",
    fecha: null,
    fuente: "No disponible",
    descripcion,
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

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

async function fetchBcraVariables(): Promise<RawBcraVariable[]> {
  const payload = await fetchJson<{ results?: RawBcraVariable[] }>(
    `${BCRA_BASE_URL}?Limit=200`
  );
  return Array.isArray(payload?.results) ? payload.results : [];
}

async function fetchBcraSerieLatest(idVariable: number): Promise<RawSerieItem | null> {
  const payload = await fetchJson<{
    results?: Array<{ idVariable?: number; detalle?: RawSerieItem[] }>;
  }>(`${BCRA_BASE_URL}/${idVariable}?Limit=1`);

  const detalle = payload?.results?.[0]?.detalle;
  if (!Array.isArray(detalle) || detalle.length === 0) return null;

  return detalle
    .filter((item) => item?.fecha && parseNumber(item.valor) != null)
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0] ?? null;
}

function indicadorFromBcraVariable(args: {
  codigo: Indicador["codigo"];
  nombre: string;
  unidad: Indicador["unidad"];
  descripcion: string;
  variable?: RawBcraVariable | null;
  maxDecimals?: number;
}): Indicador | null {
  const value = parseNumber(args.variable?.ultValorInformado);
  if (value == null) return null;

  return {
    codigo: args.codigo,
    nombre: args.nombre,
    valor: value,
    unidad: args.unidad,
    valorFormateado: formatValue(value, args.unidad, args.maxDecimals ?? 2),
    fecha: normalizeDate(args.variable?.ultFechaInformada),
    fuente: "BCRA",
    descripcion: args.descripcion,
  };
}

async function indicadorFromBcraSerie(args: {
  codigo: Indicador["codigo"];
  nombre: string;
  unidad: Indicador["unidad"];
  descripcion: string;
  idVariable: number;
  maxDecimals?: number;
}): Promise<Indicador | null> {
  const item = await fetchBcraSerieLatest(args.idVariable);
  const value = parseNumber(item?.valor);
  if (value == null) return null;

  return {
    codigo: args.codigo,
    nombre: args.nombre,
    valor: value,
    unidad: args.unidad,
    valorFormateado: formatValue(value, args.unidad, args.maxDecimals ?? 2),
    fecha: normalizeDate(item?.fecha),
    fuente: "BCRA",
    descripcion: args.descripcion,
  };
}

async function fetchArgentinaDatosLatest(
  path: "inflacion" | "inflacionInteranual" | "uva"
): Promise<RawSerieItem | null> {
  const payload = await fetchJson<RawSerieItem[]>(`${ARG_DATOS_BASE_URL}/${path}`);

  if (!Array.isArray(payload) || payload.length === 0) return null;

  return payload
    .filter((item) => item?.fecha && parseNumber(item.valor) != null)
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0] ?? null;
}

async function indicadorFromArgentinaDatos(args: {
  path: "inflacion" | "inflacionInteranual" | "uva";
  codigo: Indicador["codigo"];
  nombre: string;
  unidad: Indicador["unidad"];
  descripcion: string;
  maxDecimals?: number;
}): Promise<Indicador | null> {
  const item = await fetchArgentinaDatosLatest(args.path);
  const value = parseNumber(item?.valor);
  if (value == null) return null;

  return {
    codigo: args.codigo,
    nombre: args.nombre,
    valor: value,
    unidad: args.unidad,
    valorFormateado: formatValue(value, args.unidad, args.maxDecimals ?? 2),
    fecha: normalizeDate(item?.fecha),
    fuente: "ArgentinaDatos",
    descripcion: args.descripcion,
  };
}

export async function GET() {
  const generatedAt = new Date().toISOString();

  try {
    const variables = await fetchBcraVariables();

    const byId = (id: number) =>
      variables.find((item) => Number(item.idVariable) === id) ?? null;

    const [ipcMensualFallback, ipcInteranual, uvaFallback] = await Promise.all([
      indicadorFromArgentinaDatos({
        path: "inflacion",
        codigo: "IPC_MENSUAL",
        nombre: "IPC mensual",
        unidad: "%",
        descripcion: "Última variación mensual publicada.",
        maxDecimals: 1,
      }),
      indicadorFromArgentinaDatos({
        path: "inflacionInteranual",
        codigo: "IPC_INTERANUAL",
        nombre: "IPC interanual",
        unidad: "%",
        descripcion: "Variación interanual del último dato disponible.",
        maxDecimals: 1,
      }),
      indicadorFromArgentinaDatos({
        path: "uva",
        codigo: "UVA",
        nombre: "UVA",
        unidad: "ARS",
        descripcion: "Unidad de Valor Adquisitivo actualizada por CER.",
        maxDecimals: 2,
      }),
    ]);

    const ipcMensual =
      indicadorFromBcraVariable({
        codigo: "IPC_MENSUAL",
        nombre: "IPC mensual",
        unidad: "%",
        descripcion: "Última variación mensual publicada.",
        variable: byId(BCRA_VARIABLE_IDS.IPC_MENSUAL),
        maxDecimals: 1,
      }) ??
      (await indicadorFromBcraSerie({
        codigo: "IPC_MENSUAL",
        nombre: "IPC mensual",
        unidad: "%",
        descripcion: "Última variación mensual publicada.",
        idVariable: BCRA_VARIABLE_IDS.IPC_MENSUAL,
        maxDecimals: 1,
      })) ??
      ipcMensualFallback ??
      emptyIndicator(
        "IPC_MENSUAL",
        "IPC mensual",
        "%",
        "Última variación mensual publicada."
      );

    const uva =
      indicadorFromBcraVariable({
        codigo: "UVA",
        nombre: "UVA",
        unidad: "ARS",
        descripcion: "Unidad de Valor Adquisitivo actualizada por CER.",
        variable: byId(BCRA_VARIABLE_IDS.UVA),
        maxDecimals: 2,
      }) ??
      (await indicadorFromBcraSerie({
        codigo: "UVA",
        nombre: "UVA",
        unidad: "ARS",
        descripcion: "Unidad de Valor Adquisitivo actualizada por CER.",
        idVariable: BCRA_VARIABLE_IDS.UVA,
        maxDecimals: 2,
      })) ??
      uvaFallback ??
      emptyIndicator("UVA", "UVA", "ARS", "Unidad de Valor Adquisitivo actualizada por CER.");

    const cer =
      indicadorFromBcraVariable({
        codigo: "CER",
        nombre: "CER",
        unidad: "CER",
        descripcion: "Coeficiente de Estabilización de Referencia.",
        variable: byId(BCRA_VARIABLE_IDS.CER),
        maxDecimals: 4,
      }) ??
      (await indicadorFromBcraSerie({
        codigo: "CER",
        nombre: "CER",
        unidad: "CER",
        descripcion: "Coeficiente de Estabilización de Referencia.",
        idVariable: BCRA_VARIABLE_IDS.CER,
        maxDecimals: 4,
      })) ??
      emptyIndicator("CER", "CER", "CER", "Coeficiente de Estabilización de Referencia.");

    const icl =
      indicadorFromBcraVariable({
        codigo: "ICL",
        nombre: "ICL",
        unidad: "ICL",
        descripcion: "Índice para Contratos de Locación.",
        variable: byId(BCRA_VARIABLE_IDS.ICL),
        maxDecimals: 4,
      }) ??
      (await indicadorFromBcraSerie({
        codigo: "ICL",
        nombre: "ICL",
        unidad: "ICL",
        descripcion: "Índice para Contratos de Locación.",
        idVariable: BCRA_VARIABLE_IDS.ICL,
        maxDecimals: 4,
      })) ??
      emptyIndicator("ICL", "ICL", "ICL", "Índice para Contratos de Locación.");

    const indicadores: Indicador[] = [
      ipcMensual,
      ipcInteranual ??
        emptyIndicator(
          "IPC_INTERANUAL",
          "IPC interanual",
          "%",
          "Variación interanual del último dato disponible."
        ),
      uva,
      cer,
      icl,
    ];

    return NextResponse.json(
      {
        ok: true,
        generatedAt,
        fuentePrincipal: "BCRA",
        fuenteSecundaria: "ArgentinaDatos",
        indicadores,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
        },
      }
    );
  } catch (error) {
    console.error("Error en /api/indicadores/economicos:", error);

    return NextResponse.json(
      {
        ok: false,
        generatedAt,
        error: "No se pudieron obtener los indicadores económicos.",
        indicadores: [],
      },
      { status: 200 }
    );
  }
}
