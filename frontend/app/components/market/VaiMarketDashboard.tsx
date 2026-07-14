"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

type TipoOperacion = "venta" | "alquiler";
type PeriodoRapido = "" | "3" | "6" | "12" | "todo" | "personalizado";

type GeoOption = {
  id: string;
  nombre: string;
  operaciones?: number;
};

type ValueOption = {
  valor: string | number;
  operaciones: number;
};

type RankingZona = {
  zona_id: string;
  nombre: string;
  operaciones: number;
  participacion_porcentaje: number;
};

type RankingTipologia = {
  tipologia: string;
  operaciones: number;
  participacion_porcentaje: number;
};

type MarketFilterOptionsResponse = {
  tipo_operacion: TipoOperacion;
  muestra_minima: number;
  provincias: GeoOption[];
  localidades: GeoOption[];
  zonas: GeoOption[];
  tipologias: ValueOption[];
  dormitorios: ValueOption[];
  monedas: ValueOption[];
};

type MarketStatsResponse = {
  hay_datos: boolean;
  mensaje?: string;
  cantidad_operaciones_base?: number;
  cantidad_operaciones?: number;
  depuracion_extremos_aplicada?: boolean;
  percentil_inferior?: number | null;
  percentil_superior?: number | null;
  valor_promedio?: number | null;
  valor_mediano?: number | null;
  valor_minimo?: number | null;
  valor_maximo?: number | null;
  m2_cubiertos_promedio?: number | null;
  cantidad_operaciones_con_m2?: number;
  valor_m2_promedio?: number | null;
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
  dias_a_la_venta_promedio?: number | null;
  gap_disponible?: boolean;
  cantidad_operaciones_gap?: number;
  gap_promedio?: number | null;
  gap_mediano?: number | null;
  gap_minimo?: number | null;
  gap_maximo?: number | null;
  top_zonas?: RankingZona[];
  top_tipologias?: RankingTipologia[];
};

type FiltersState = {
  tipo_operacion: TipoOperacion;
  provincia_georef_id: string;
  localidad_georef_id: string;
  zona_id: string;
  tipologia: string;
  dormitorios: string;
  moneda: string;
  m2_cubiertos_desde: string;
  m2_cubiertos_hasta: string;
  fecha_desde: string;
  fecha_hasta: string;
};

type InformeRentabilidadForm = {
  nombreCliente: string;
  localidad: string;
  zona: string;
  tipologia: string;
  ambientes: string;
  m2Cubiertos: string;
  antiguedad: string;
  estadoPropiedad: string;
  demandaAlquiler: string;
  alquilerPromedio: string;
  monedaAlquilerPromedio: "ARS" | "USD";
  observaciones: string;
};

const INITIAL_INFORME_RENTABILIDAD: InformeRentabilidadForm = {
  nombreCliente: "",
  localidad: "",
  zona: "",
  tipologia: "",
  ambientes: "",
  m2Cubiertos: "",
  antiguedad: "",
  estadoPropiedad: "",
  demandaAlquiler: "",
  alquilerPromedio: "",
  monedaAlquilerPromedio: "ARS",
  observaciones: "",
};

const INITIAL_FILTERS: FiltersState = {
  tipo_operacion: "venta",
  provincia_georef_id: "",
  localidad_georef_id: "",
  zona_id: "",
  tipologia: "",
  dormitorios: "",
  moneda: "",
  m2_cubiertos_desde: "",
  m2_cubiertos_hasta: "",
  fecha_desde: "",
  fecha_hasta: "",
};

const fieldClassName =
  "w-full rounded-xl border border-zinc-700/80 bg-zinc-900/90 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-500 hover:border-zinc-600 focus:border-[#E6A930] focus:ring-1 focus:ring-[#E6A930] disabled:cursor-not-allowed disabled:opacity-50";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function parseNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function getDisplayCurrency(
  tipoOperacion: TipoOperacion | undefined,
  moneda: string
): string {
  if (moneda.trim()) return moneda.trim().toUpperCase();
  return tipoOperacion === "alquiler" ? "ARS" : "USD";
}

function formatMoney(value: number | null | undefined, moneda: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const currency = moneda.trim().toUpperCase();
  const amount = new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(value);
  return currency ? `${amount} ${currency}` : amount;
}

function formatNumber(
  value: number | null | undefined,
  maximumFractionDigits = 2
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits }).format(value);
}

function formatPercentage(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function capitalizeWords(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Ocurrió un error inesperado.";
}

async function fetchToDataURL(url?: string | null): Promise<string | null> {
  try {
    if (!url) return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-sm font-medium text-zinc-300"
    >
      {children}
    </label>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  accent = false,
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  accent?: boolean;
}) {
  return (
    <article
      className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl ${
        accent
          ? "border-[#E6A930]/45 bg-gradient-to-br from-[#E6A930]/15 via-zinc-950 to-zinc-950"
          : "border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950"
      }`}
    >
      <div
        className={`absolute right-0 top-0 h-20 w-20 rounded-bl-full ${
          accent ? "bg-[#E6A930]/10" : "bg-white/[0.025]"
        }`}
      />
      <p className="relative text-sm font-medium text-zinc-400">{title}</p>
      <p
        className={`relative mt-2 text-2xl font-semibold tracking-tight ${
          accent ? "text-[#F1C15B]" : "text-white"
        }`}
      >
        {value}
      </p>
      {subtitle ? (
        <p className="relative mt-2 text-xs leading-5 text-zinc-500">
          {subtitle}
        </p>
      ) : null}
    </article>
  );
}

function RankingPanel({
  title,
  subtitle,
  items,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  items: Array<{
    key: string;
    label: string;
    operations: number;
    percentage: number;
  }>;
  emptyMessage: string;
}) {
  const maxOperations = Math.max(...items.map((item) => item.operations), 1);

  return (
    <section className="rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-black p-5 sm:p-6">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      </div>

      {items.length ? (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.key}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E6A930]/25 bg-[#E6A930]/10 text-xs font-bold text-[#E6A930]">
                    {index + 1}
                  </span>
                  <span className="truncate font-medium text-zinc-200">
                    {item.label}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {item.operations} operaciones · {formatPercentage(item.percentage)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#9F6E10] via-[#E6A930] to-[#F5CA6A] transition-all duration-500"
                  style={{
                    width: `${Math.max(
                      (item.operations / maxOperations) * 100,
                      7
                    )}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-black/30 p-6 text-center text-sm text-zinc-500">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

export default function VaiMarketDashboard() {
  const { user } = useAuth();
  const theme = useTheme();
  const themePrimaryColor = (theme as any)?.primaryColor as string | undefined;
  const themeCompanyName = (theme as any)?.companyName as string | undefined;
  const themeLogoUrl =
    (theme as any)?.logoUrlBusted ?? (theme as any)?.logoUrl ?? undefined;
  const effectivePrimaryColor = themePrimaryColor || "#E6A930";

  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [periodoRapido, setPeriodoRapido] = useState<PeriodoRapido>("");
  const [provincias, setProvincias] = useState<GeoOption[]>([]);
  const [localidades, setLocalidades] = useState<GeoOption[]>([]);
  const [options, setOptions] =
    useState<MarketFilterOptionsResponse | null>(null);
  const [stats, setStats] = useState<MarketStatsResponse | null>(null);
  const [loadingProvincias, setLoadingProvincias] = useState(true);
  const [loadingLocalidades, setLoadingLocalidades] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastAppliedFilters, setLastAppliedFilters] =
    useState<FiltersState | null>(null);

  const [precioCompraUsd, setPrecioCompraUsd] = useState("");
  const [alquilerMensualUsd, setAlquilerMensualUsd] = useState("");
  const [informeModalAbierto, setInformeModalAbierto] = useState(false);
  const [generandoInforme, setGenerandoInforme] = useState(false);
  const [informeError, setInformeError] = useState<string | null>(null);
  const [informeForm, setInformeForm] = useState<InformeRentabilidadForm>(
    INITIAL_INFORME_RENTABILIDAD
  );

  const resultCurrency = getDisplayCurrency(
    lastAppliedFilters?.tipo_operacion ?? filters.tipo_operacion,
    lastAppliedFilters?.moneda ?? filters.moneda
  );

  const buildRpcParams = useCallback(
    (currentFilters: FiltersState) => ({
      p_tipo_operacion: currentFilters.tipo_operacion,
      p_provincia_georef_id:
        currentFilters.provincia_georef_id || null,
      p_localidad_georef_id:
        currentFilters.localidad_georef_id || null,
      p_zona_id: currentFilters.zona_id || null,
      p_tipologia: currentFilters.tipologia || null,
      p_dormitorios:
        currentFilters.dormitorios === ""
          ? null
          : Number(currentFilters.dormitorios),
      p_moneda: currentFilters.moneda || null,
      p_m2_cubiertos_desde: parseNullableNumber(
        currentFilters.m2_cubiertos_desde
      ),
      p_m2_cubiertos_hasta: parseNullableNumber(
        currentFilters.m2_cubiertos_hasta
      ),
      p_fecha_desde: currentFilters.fecha_desde || null,
      p_fecha_hasta: currentFilters.fecha_hasta || null,
    }),
    []
  );

  const cargarProvincias = useCallback(async () => {
    setLoadingProvincias(true);
    try {
      const response = await fetch("/api/geografia/provincias");
      if (!response.ok) {
        throw new Error("No se pudieron cargar las provincias.");
      }
      const payload = (await response.json()) as
        | GeoOption[]
        | { provincias?: GeoOption[]; data?: GeoOption[] };
      setProvincias(
        Array.isArray(payload)
          ? payload
          : asArray(payload.provincias ?? payload.data)
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingProvincias(false);
    }
  }, []);

  const cargarLocalidades = useCallback(async (provinciaId: string) => {
    if (!provinciaId) {
      setLocalidades([]);
      return;
    }

    setLoadingLocalidades(true);
    try {
      const response = await fetch(
        `/api/geografia/localidades?provincia=${encodeURIComponent(
          provinciaId
        )}`
      );
      if (!response.ok) {
        throw new Error("No se pudieron cargar las localidades.");
      }
      const payload = (await response.json()) as
        | GeoOption[]
        | { localidades?: GeoOption[]; data?: GeoOption[] };
      setLocalidades(
        Array.isArray(payload)
          ? payload
          : asArray(payload.localidades ?? payload.data)
      );
    } catch (requestError) {
      setLocalidades([]);
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingLocalidades(false);
    }
  }, []);

  const cargarOpciones = useCallback(
    async (currentFilters: FiltersState) => {
      setLoadingOptions(true);
      try {
        const { data, error: rpcError } = await supabase.rpc(
          "get_vai_market_filter_options_v2",
          buildRpcParams(currentFilters)
        );
        if (rpcError) throw rpcError;

        const payload = (data ?? {}) as Partial<MarketFilterOptionsResponse>;
        setOptions({
          tipo_operacion:
            payload.tipo_operacion ?? currentFilters.tipo_operacion,
          muestra_minima: payload.muestra_minima ?? 3,
          provincias: asArray(payload.provincias),
          localidades: asArray(payload.localidades),
          zonas: asArray(payload.zonas),
          tipologias: asArray(payload.tipologias),
          dormitorios: asArray(payload.dormitorios),
          monedas: asArray(payload.monedas),
        });
      } catch (requestError) {
        setOptions(null);
        setError(getErrorMessage(requestError));
      } finally {
        setLoadingOptions(false);
      }
    },
    [buildRpcParams]
  );

  const consultarEstadisticas = useCallback(
    async (currentFilters: FiltersState) => {
      setLoadingStats(true);
      setHasSearched(true);
      setLastAppliedFilters(currentFilters);
      setError(null);

      try {
        const [statsResponse] = await Promise.all([
          supabase.rpc(
            "get_vai_market_stats_v3",
            buildRpcParams(currentFilters)
          ),
          cargarOpciones(currentFilters),
        ]);

        if (statsResponse.error) throw statsResponse.error;

        setStats(
          (statsResponse.data ?? {
            hay_datos: false,
            mensaje: "No se recibieron estadísticas.",
          }) as MarketStatsResponse
        );
      } catch (requestError) {
        setStats(null);
        setError(getErrorMessage(requestError));
      } finally {
        setLoadingStats(false);
      }
    },
    [buildRpcParams, cargarOpciones]
  );

  useEffect(() => {
    cargarProvincias();
    cargarOpciones(INITIAL_FILTERS);
  }, [cargarOpciones, cargarProvincias]);

  useEffect(() => {
    if (!filters.provincia_georef_id) {
      setLocalidades([]);
      return;
    }
    cargarLocalidades(filters.provincia_georef_id);
  }, [cargarLocalidades, filters.provincia_georef_id]);

  const availableProvincias = useMemo(() => {
    if (!options?.provincias.length) return provincias;
    const allowed = new Set(options.provincias.map((item) => item.id));
    const filtered = provincias.filter((item) => allowed.has(item.id));
    return filtered.length ? filtered : provincias;
  }, [options, provincias]);

  const availableLocalidades = useMemo(() => {
    if (!options?.localidades.length) return localidades;
    const allowed = new Set(options.localidades.map((item) => item.id));
    const filtered = localidades.filter((item) => allowed.has(item.id));
    return filtered.length ? filtered : localidades;
  }, [localidades, options]);

  const selectedResultLabels = useMemo(() => {
    const applied = lastAppliedFilters ?? filters;
    const zona = options?.zonas.find((item) => item.id === applied.zona_id);
    const localidad = localidades.find(
      (item) => item.id === applied.localidad_georef_id
    );
    const provincia = provincias.find(
      (item) => item.id === applied.provincia_georef_id
    );

    const mainTitle =
      zona?.nombre || localidad?.nombre || provincia?.nombre || "Mercado general";

    const secondLine = applied.tipologia
      ? capitalizeWords(applied.tipologia)
      : applied.tipo_operacion === "venta"
      ? "Mercado de ventas"
      : "Mercado de alquileres";

    const thirdLine =
      applied.dormitorios === ""
        ? ""
        : `${applied.dormitorios} ${
            Number(applied.dormitorios) === 1 ? "dormitorio" : "dormitorios"
          }`;

    return { mainTitle, secondLine, thirdLine };
  }, [filters, lastAppliedFilters, localidades, options, provincias]);

  const perCalculation = useMemo(() => {
    const price = parseNullableNumber(precioCompraUsd);
    const rent = parseNullableNumber(alquilerMensualUsd);

    if (!price || price <= 0 || !rent || rent <= 0) {
      return null;
    }

    const annualIncome = rent * 12;
    const annualYield = (annualIncome / price) * 100;
    const perYears = price / annualIncome;

    const status =
      perYears < 15
        ? {
            label: "Buena oportunidad",
            description: "Alta rentabilidad relativa",
            className:
              "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
          }
        : perYears <= 20
        ? {
            label: "Rentabilidad aceptable",
            description: "Recuperación dentro de un rango intermedio",
            className:
              "border-amber-500/35 bg-amber-500/10 text-amber-300",
          }
        : {
            label: "Recuperación lenta",
            description: "Rentabilidad bruta relativamente baja",
            className: "border-red-500/35 bg-red-500/10 text-red-300",
          };

    return { annualIncome, annualYield, perYears, status };
  }, [alquilerMensualUsd, precioCompraUsd]);

  function updateInformeField<K extends keyof InformeRentabilidadForm>(
    key: K,
    value: InformeRentabilidadForm[K]
  ) {
    setInformeForm((current) => ({ ...current, [key]: value }));
  }

  function abrirModalInforme() {
    if (!perCalculation) return;
    setInformeError(null);
    setInformeModalAbierto(true);
  }

  function cerrarModalInforme() {
    if (generandoInforme) return;
    setInformeModalAbierto(false);
    setInformeError(null);
  }

  async function handleDownloadRentabilidadPDF() {
    if (!perCalculation) {
      setInformeError(
        "Completá el precio de compra y el alquiler mensual antes de generar el informe."
      );
      return;
    }

    setGenerandoInforme(true);
    setInformeError(null);

    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF("p", "pt", "a4");
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 38;
      const anyUser = user as any;

      let matriculado = anyUser?.matriculado_nombre || "-";
      let cpi = anyUser?.cpi || "-";
      let inmobiliaria = themeCompanyName || anyUser?.inmobiliaria || "-";
      const asesorNombre =
        anyUser?.nombre && anyUser?.apellido
          ? `${anyUser.nombre} ${anyUser.apellido}`
          : "-";
      const role = String(anyUser?.role || "").toLowerCase();
      const isAsesor = role === "asesor";

      if (inmobiliaria === "-" || matriculado === "-" || cpi === "-") {
        try {
          let query = supabase
            .from("empresas")
            .select("id, nombre_comercial, matriculado, cpi, user_id")
            .limit(1);

          if (isAsesor && anyUser?.empresa_id) {
            query = query.eq("id", anyUser.empresa_id);
          } else if (anyUser?.id) {
            query = query.eq("user_id", anyUser.id);
          }

          const { data: empresaRow, error: empresaError } =
            await query.maybeSingle();

          if (!empresaError && empresaRow) {
            if (inmobiliaria === "-" && empresaRow.nombre_comercial) {
              inmobiliaria = empresaRow.nombre_comercial;
            }
            if (matriculado === "-" && empresaRow.matriculado) {
              matriculado = empresaRow.matriculado;
            }
            if (cpi === "-" && empresaRow.cpi) {
              cpi = empresaRow.cpi;
            }
          }
        } catch (empresaRequestError) {
          console.warn(
            "No se pudieron resolver los datos de la empresa para el PDF:",
            empresaRequestError
          );
        }
      }

      const hexToRgb = (hex: string) => {
        const safe = /^#?[0-9A-Fa-f]{3,6}$/.test(hex || "")
          ? hex
          : "#E6A930";
        const raw = safe.replace("#", "");
        const normalized =
          raw.length === 3
            ? raw
                .split("")
                .map((char) => char + char)
                .join("")
            : raw;
        const parsed = parseInt(normalized, 16);
        return {
          r: (parsed >> 16) & 255,
          g: (parsed >> 8) & 255,
          b: parsed & 255,
        };
      };

      const pc = hexToRgb(effectivePrimaryColor);
      const border = { r: 226, g: 232, b: 240 };
      const soft = { r: 248, g: 250, b: 252 };
      const muted = { r: 100, g: 116, b: 139 };
      const dark = { r: 15, g: 23, b: 42 };
      const reportDate = new Date().toLocaleDateString("es-AR");
      const logoData = await fetchToDataURL(themeLogoUrl || null);

      const safeValue = (value: string | number | null | undefined) => {
        const normalized = String(value ?? "").trim();
        return normalized || "-";
      };

      const pdfMoney = (value: number, currency: "ARS" | "USD") => {
        const amount = new Intl.NumberFormat("es-AR", {
          maximumFractionDigits: 0,
        }).format(value);
        return currency === "USD" ? `USD ${amount}` : `$ ${amount}`;
      };

      const imageFormat = (src: string) =>
        src.startsWith("data:image/png") ? "PNG" : "JPEG";

      const addImageContain = (
        src: string,
        x: number,
        y: number,
        boxW: number,
        boxH: number
      ) => {
        try {
          const props = (doc as any).getImageProperties(src);
          const imgW = Number(props?.width) || boxW;
          const imgH = Number(props?.height) || boxH;
          const ratio = Math.min(boxW / imgW, boxH / imgH);
          const drawW = imgW * ratio;
          const drawH = imgH * ratio;
          doc.addImage(
            src,
            imageFormat(src),
            x + (boxW - drawW) / 2,
            y + (boxH - drawH) / 2,
            drawW,
            drawH,
            undefined,
            "FAST"
          );
        } catch (imageError) {
          console.warn("No se pudo insertar el logo en el PDF:", imageError);
        }
      };

      const drawPageHeader = (title: string) => {
        doc.setFillColor(pc.r, pc.g, pc.b);
        doc.rect(0, 0, pageW, 74, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text(title, margin, 32);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.text(`${inmobiliaria}  |  ${reportDate}`, margin, 52);
        if (logoData) {
          addImageContain(logoData, pageW - margin - 100, 8, 100, 58);
        }
        doc.setTextColor(0, 0, 0);
      };

      const drawSectionTitle = (title: string, y: number) => {
        doc.setFillColor(pc.r, pc.g, pc.b);
        doc.rect(margin, y, pageW - margin * 2, 24, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text(title, margin + 12, y + 16);
        doc.setTextColor(0, 0, 0);
      };

      const drawLabelValue = (
        label: string,
        value: string,
        x: number,
        y: number,
        maxW: number
      ) => {
        const labelText = `${label}: `;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(muted.r, muted.g, muted.b);
        doc.text(labelText, x, y);
        const labelW = doc.getTextWidth(labelText);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(dark.r, dark.g, dark.b);
        const lines = doc.splitTextToSize(
          safeValue(value),
          Math.max(45, maxW - labelW - 8)
        );
        doc.text(lines as string[], x + labelW + 8, y);
        doc.setTextColor(0, 0, 0);
      };

      const drawKpi = (
        x: number,
        y: number,
        w: number,
        h: number,
        title: string,
        value: string,
        subtitle?: string,
        accent?: {
          text: { r: number; g: number; b: number };
          fill: { r: number; g: number; b: number };
          border: { r: number; g: number; b: number };
        }
      ) => {
        const fillColor = accent?.fill ?? { r: 255, g: 255, b: 255 };
        const borderColor = accent?.border ?? border;
        const valueColor = accent?.text ?? dark;

        doc.setFillColor(fillColor.r, fillColor.g, fillColor.b);
        doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
        doc.roundedRect(x, y, w, h, 6, 6, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(muted.r, muted.g, muted.b);
        doc.text(title, x + 14, y + 20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(valueColor.r, valueColor.g, valueColor.b);
        doc.text(value, x + 14, y + 48);
        if (subtitle) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(muted.r, muted.g, muted.b);
          const lines = doc.splitTextToSize(subtitle, w - 28);
          doc.text(lines as string[], x + 14, y + h - 17);
        }
        doc.setTextColor(0, 0, 0);
      };

      const drawPERGraph = (
        graphX: number,
        graphY: number,
        graphW: number,
        graphH: number
      ) => {
        const plotPadL = 42;
        const plotPadR = 18;
        const plotPadT = 28;
        const plotPadB = 34;
        const x0 = graphX + plotPadL;
        const y0 = graphY + graphH - plotPadB;
        const plotW = graphW - plotPadL - plotPadR;
        const plotH = graphH - plotPadT - plotPadB;
        const xMin = 5;
        const xMax = 30;
        const yMax = 20;
        const mapX = (value: number) =>
          x0 + ((value - xMin) / (xMax - xMin)) * plotW;
        const mapY = (value: number) => y0 - (value / yMax) * plotH;

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(border.r, border.g, border.b);
        doc.rect(graphX, graphY, graphW, graphH, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(dark.r, dark.g, dark.b);
        doc.text(
          "Relación PER y Rentabilidad Anual",
          graphX + graphW / 2,
          graphY + 17,
          { align: "center" }
        );

        doc.setFillColor(209, 250, 229);
        doc.rect(mapX(5), graphY + plotPadT, mapX(15) - mapX(5), plotH, "F");
        doc.setFillColor(254, 243, 199);
        doc.rect(mapX(15), graphY + plotPadT, mapX(20) - mapX(15), plotH, "F");
        doc.setFillColor(254, 226, 226);
        doc.rect(mapX(20), graphY + plotPadT, mapX(30) - mapX(20), plotH, "F");

        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.4);
        [5, 10, 15, 20, 25, 30].forEach((tick) => {
          const tx = mapX(tick);
          doc.line(tx, graphY + plotPadT, tx, y0);
        });
        [0, 5, 10, 15, 20].forEach((tick) => {
          const ty = mapY(tick);
          doc.line(x0, ty, x0 + plotW, ty);
        });

        doc.setDrawColor(71, 85, 105);
        doc.setLineWidth(0.8);
        doc.line(x0, y0, x0 + plotW, y0);
        doc.line(x0, graphY + plotPadT, x0, y0);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.2);
        doc.setTextColor(71, 85, 105);
        [5, 10, 15, 20, 25, 30].forEach((tick) => {
          doc.text(String(tick), mapX(tick), y0 + 11, { align: "center" });
        });
        [0, 5, 10, 15, 20].forEach((tick) => {
          doc.text(`${tick}%`, x0 - 6, mapY(tick) + 2, { align: "right" });
        });
        doc.text(
          "PER (años de alquiler)",
          graphX + graphW / 2,
          graphY + graphH - 9,
          { align: "center" }
        );
        doc.text(
          "Rentabilidad anual (%)",
          graphX + 9,
          graphY + graphH / 2,
          { angle: 90, align: "center" } as any
        );

        doc.setDrawColor(34, 197, 94);
        doc.setLineDashPattern([3, 3], 0);
        doc.line(mapX(15), graphY + plotPadT, mapX(15), y0);
        doc.setDrawColor(245, 158, 11);
        doc.line(mapX(20), graphY + plotPadT, mapX(20), y0);
        doc.setLineDashPattern([], 0);

        doc.setDrawColor(220, 38, 38);
        doc.setLineWidth(1.4);
        let previousX = mapX(5);
        let previousY = mapY(20);
        for (let per = 5.25; per <= 30; per += 0.25) {
          const rent = Math.min(20, 100 / per);
          const pointX = mapX(per);
          const pointY = mapY(rent);
          doc.line(previousX, previousY, pointX, pointY);
          previousX = pointX;
          previousY = pointY;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.8);
        doc.setTextColor(22, 101, 52);
        doc.text("Buena Inversión", mapX(10), y0 - 5, { align: "center" });
        doc.setTextColor(146, 64, 14);
        doc.text("Rentabilidad", mapX(17.5), y0 - 10, { align: "center" });
        doc.text("Aceptable", mapX(17.5), y0 - 3, { align: "center" });
        doc.setTextColor(153, 27, 27);
        doc.text("Recuperación Lenta", mapX(25), y0 - 5, {
          align: "center",
        });

        const markerPer = Math.max(5, Math.min(30, perCalculation.perYears));
        const markerRent = Math.min(20, 100 / markerPer);
        const markerX = mapX(markerPer);
        const markerY = mapY(markerRent);
        doc.setFillColor(pc.r, pc.g, pc.b);
        doc.circle(markerX, markerY, 3.2, "F");

        const markerLabel = `PER ${formatNumber(perCalculation.perYears, 1)}`;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.2);
        const markerLabelW = doc.getTextWidth(markerLabel) + 10;
        const markerLabelX =
          markerPer > 22 ? markerX - markerLabelW - 6 : markerX + 7;
        const markerLabelY = markerY - 12;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(border.r, border.g, border.b);
        doc.roundedRect(
          markerLabelX,
          markerLabelY - 8,
          markerLabelW,
          13,
          2,
          2,
          "FD"
        );
        doc.setTextColor(pc.r, pc.g, pc.b);
        doc.text(markerLabel, markerLabelX + 5, markerLabelY);

        const legendX = graphX + graphW - 196;
        const legendY = graphY + 32;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(148, 163, 184);
        doc.roundedRect(legendX - 7, legendY - 8, 172, 43, 3, 3, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.7);
        doc.setTextColor(30, 41, 59);
        doc.setFillColor(187, 247, 208);
        doc.setDrawColor(34, 197, 94);
        doc.rect(legendX, legendY, 9, 7, "FD");
        doc.text("Buena inversión (PER < 15)", legendX + 13, legendY + 6);
        doc.setFillColor(253, 230, 138);
        doc.setDrawColor(245, 158, 11);
        doc.rect(legendX, legendY + 12, 9, 7, "FD");
        doc.text(
          "Rentabilidad aceptable (15 a 20)",
          legendX + 13,
          legendY + 18
        );
        doc.setFillColor(252, 165, 165);
        doc.setDrawColor(185, 28, 28);
        doc.rect(legendX, legendY + 24, 9, 7, "FD");
        doc.text("Recuperación lenta (PER > 20)", legendX + 13, legendY + 30);
        doc.setTextColor(0, 0, 0);
      };

      drawPageHeader("Informe de Rentabilidad y PER");

      doc.setFillColor(soft.r, soft.g, soft.b);
      doc.setDrawColor(border.r, border.g, border.b);
      doc.rect(margin, 96, pageW - margin * 2, 58, "FD");
      drawLabelValue("Empresa", inmobiliaria, margin + 12, 115, 225);
      drawLabelValue(
        "Asesor",
        isAsesor ? asesorNombre : "-",
        margin + 12,
        135,
        225
      );
      drawLabelValue("Profesional", matriculado, pageW / 2 + 12, 115, 215);
      drawLabelValue("Matrícula N°", cpi, pageW / 2 + 12, 135, 215);

      drawSectionTitle("Datos del Cliente y de la Propiedad", 178);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(border.r, border.g, border.b);
      doc.rect(margin, 214, pageW - margin * 2, 194, "FD");

      const leftX = margin + 16;
      const rightX = pageW / 2 + 8;
      const columnW = pageW / 2 - margin - 28;
      const leftRows: Array<[string, string]> = [
        ["Cliente", informeForm.nombreCliente],
        ["Localidad", informeForm.localidad],
        ["Zona/Barrio", informeForm.zona],
        ["Tipología", informeForm.tipologia],
        ["Ambientes", informeForm.ambientes],
        [
          "m² Cubiertos",
          informeForm.m2Cubiertos.trim()
            ? `${informeForm.m2Cubiertos.trim()} m²`
            : "-",
        ],
      ];
      const rightRows: Array<[string, string]> = [
        [
          "Antigüedad",
          informeForm.antiguedad.trim()
            ? `${informeForm.antiguedad.trim()} años`
            : "-",
        ],
        ["Estado", informeForm.estadoPropiedad],
        ["Demanda locativa", informeForm.demandaAlquiler],
        ["Valor de adquisición", pdfMoney(Number(precioCompraUsd), "USD")],
        [
          "Renta mensual bruta (cálculo)",
          pdfMoney(Number(alquilerMensualUsd), "USD"),
        ],
        [
          "Alquiler mensual estimado",
          informeForm.alquilerPromedio.trim()
            ? pdfMoney(
                Number(informeForm.alquilerPromedio),
                informeForm.monedaAlquilerPromedio
              )
            : "-",
        ],
      ];

      leftRows.forEach(([label, value], index) => {
        drawLabelValue(label, value, leftX, 238 + index * 28, columnW);
      });
      rightRows.forEach(([label, value], index) => {
        drawLabelValue(label, value, rightX, 238 + index * 28, columnW);
      });

      drawSectionTitle("Resultado del Análisis", 434);
      const kpiGap = 12;
      const kpiW = (pageW - margin * 2 - kpiGap) / 2;
      drawKpi(
        margin,
        470,
        kpiW,
        88,
        "Rentabilidad anual bruta",
        formatPercentage(perCalculation.annualYield),
        "Relación entre el ingreso anual estimado y el precio de compra."
      );
      drawKpi(
        margin + kpiW + kpiGap,
        470,
        kpiW,
        88,
        "Recuperación estimada",
        `${formatNumber(perCalculation.perYears, 1)} años`,
        "PER bruto calculado a partir del alquiler mensual informado."
      );
      drawKpi(
        margin,
        570,
        kpiW,
        88,
        "Ingreso anual estimado",
        pdfMoney(perCalculation.annualIncome, "USD"),
        "Alquiler mensual utilizado multiplicado por doce meses."
      );
      const evaluationAccent =
        perCalculation.perYears < 15
          ? {
              text: { r: 21, g: 128, b: 61 },
              fill: { r: 240, g: 253, b: 244 },
              border: { r: 134, g: 239, b: 172 },
            }
          : perCalculation.perYears <= 20
          ? {
              text: { r: 180, g: 83, b: 9 },
              fill: { r: 255, g: 251, b: 235 },
              border: { r: 252, g: 211, b: 77 },
            }
          : {
              text: { r: 185, g: 28, b: 28 },
              fill: { r: 254, g: 242, b: 242 },
              border: { r: 252, g: 165, b: 165 },
            };

      drawKpi(
        margin + kpiW + kpiGap,
        570,
        kpiW,
        88,
        "Evaluación de la inversión",
        perCalculation.status.label,
        perCalculation.status.description,
        evaluationAccent
      );

      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(margin, 676, pageW - margin * 2, 66, 5, 5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(146, 64, 14);
      doc.text("Referencia orientativa", margin + 14, 697);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.2);
      const disclaimer = doc.splitTextToSize(
        "La Renta mensual bruta (cálculo) es el valor utilizado para determinar la rentabilidad anual y el PER. El cálculo es bruto y no contempla gastos, impuestos, vacancia, mantenimiento, expensas ni costos de adquisición. No reemplaza un análisis financiero, legal o impositivo específico.",
        pageW - margin * 2 - 28
      );
      doc.text(disclaimer as string[], margin + 14, 713);

      doc.addPage();
      drawPageHeader("Informe de Rentabilidad y PER");
      drawSectionTitle("Gráfico de PER y Rentabilidad", 96);
      drawPERGraph(margin, 132, pageW - margin * 2, 286);

      drawSectionTitle("Observaciones Generales", 446);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(border.r, border.g, border.b);
      doc.rect(margin, 482, pageW - margin * 2, 244, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(dark.r, dark.g, dark.b);
      const observationLines = doc.splitTextToSize(
        safeValue(informeForm.observaciones),
        pageW - margin * 2 - 28
      );
      doc.text(observationLines as string[], margin + 14, 506);

      const footerText = `${matriculado}  |  Matrícula N°: ${cpi}`;
      const totalPages = (doc as any).getNumberOfPages
        ? (doc as any).getNumberOfPages()
        : doc.internal.pages.length - 1;

      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setDrawColor(border.r, border.g, border.b);
        doc.line(margin, pageH - 44, pageW - margin, pageH - 44);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(footerText, pageW / 2, pageH - 28, { align: "center" });
        doc.text(`Página ${page} de ${totalPages}`, pageW - margin, pageH - 28, {
          align: "right",
        });
      }

      const clientSlug = informeForm.nombreCliente
        .trim()
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/g, "_")
        .replace(/^_+|_+$/g, "");
      const filename = clientSlug
        ? `Informe_Rentabilidad_PER_${clientSlug}.pdf`
        : "Informe_Rentabilidad_PER.pdf";

      doc.save(filename);
      setInformeModalAbierto(false);
    } catch (pdfError) {
      console.error("Generar informe de rentabilidad:", pdfError);
      setInformeError(getErrorMessage(pdfError));
    } finally {
      setGenerandoInforme(false);
    }
  }

  function updateFilter<K extends keyof FiltersState>(
    key: K,
    value: FiltersState[K]
  ) {
    setFilters((current) => {
      const next = { ...current, [key]: value };

      if (key === "tipo_operacion") {
        next.tipologia = "";
        next.dormitorios = "";
        next.moneda = "";
        next.zona_id = "";
      }

      if (key === "provincia_georef_id") {
        next.localidad_georef_id = "";
        next.zona_id = "";
      }

      if (key === "localidad_georef_id") {
        next.zona_id = "";
      }

      if (key === "fecha_desde" || key === "fecha_hasta") {
        setPeriodoRapido("personalizado");
      }

      return next;
    });
  }

  function applyQuickPeriod(value: PeriodoRapido) {
    setPeriodoRapido(value);

    if (value === "todo" || value === "") {
      setFilters((current) => ({
        ...current,
        fecha_desde: "",
        fecha_hasta: "",
      }));
      return;
    }

    if (value === "personalizado") return;

    const months = Number(value);
    const today = new Date();
    const from = new Date(today);
    from.setMonth(from.getMonth() - months);

    setFilters((current) => ({
      ...current,
      fecha_desde: toIsoDate(from),
      fecha_hasta: toIsoDate(today),
    }));
  }

  function handleReset() {
    setFilters(INITIAL_FILTERS);
    setPeriodoRapido("");
    setStats(null);
    setHasSearched(false);
    setLastAppliedFilters(null);
    setError(null);
    cargarOpciones(INITIAL_FILTERS);
  }

  const loading = loadingStats || loadingOptions;
  const topZones = asArray<RankingZona>(stats?.top_zonas);
  const topTypes = asArray<RankingTipologia>(stats?.top_tipologias);

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="relative overflow-hidden rounded-[28px] border border-[#E6A930]/25 bg-zinc-950 p-6 shadow-2xl shadow-black/40 sm:p-8 lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(230,169,48,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(230,169,48,0.08),transparent_28%)]" />
          <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full border border-[#E6A930]/15" />
          <div className="absolute -right-2 top-12 h-36 w-36 rounded-full border border-[#E6A930]/10" />

          <div className="relative max-w-4xl">
            <span className="inline-flex rounded-full border border-[#E6A930]/40 bg-[#E6A930]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#E6A930]">
              Inteligencia inmobiliaria colaborativa
            </span>

            <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
              VAI Market Data
            </h1>

            <p className="mt-4 text-xl font-semibold leading-relaxed text-[#F0C05B] sm:text-2xl">
              Valuá mejor. Negociá mejor. Decidí con datos.
            </p>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
              Cada operación cerrada por la comunidad VAI Prop fortalece una
              base de conocimiento colectiva que permite analizar precios
              reales, detectar oportunidades y acercarse a valuaciones más
              precisas.
            </p>

            <p className="mt-4 text-sm font-medium text-zinc-400">
              Cada operación suma conocimiento y fortalece a toda la comunidad.
            </p>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-xl shadow-black/20 sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Explorá el mercado</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Combiná ubicación, tipología, superficie y período para obtener
                referencias comparables.
              </p>
            </div>
            <span className="text-xs text-zinc-600">
              Los resultados se muestran solo cuando existe una muestra segura.
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div>
              <FieldLabel htmlFor="market-tipo-operacion">
                Operación
              </FieldLabel>
              <select
                id="market-tipo-operacion"
                className={fieldClassName}
                value={filters.tipo_operacion}
                onChange={(event) =>
                  updateFilter(
                    "tipo_operacion",
                    event.target.value as TipoOperacion
                  )
                }
              >
                <option value="venta">Venta</option>
                <option value="alquiler">Alquiler</option>
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="market-provincia">Provincia</FieldLabel>
              <select
                id="market-provincia"
                className={fieldClassName}
                value={filters.provincia_georef_id}
                disabled={loadingProvincias}
                onChange={(event) =>
                  updateFilter("provincia_georef_id", event.target.value)
                }
              >
                <option value="">
                  {loadingProvincias
                    ? "Cargando provincias..."
                    : "Todas las provincias"}
                </option>
                {availableProvincias.map((provincia) => (
                  <option key={provincia.id} value={provincia.id}>
                    {provincia.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="market-localidad">Localidad</FieldLabel>
              <select
                id="market-localidad"
                className={fieldClassName}
                value={filters.localidad_georef_id}
                disabled={!filters.provincia_georef_id || loadingLocalidades}
                onChange={(event) =>
                  updateFilter("localidad_georef_id", event.target.value)
                }
              >
                <option value="">
                  {loadingLocalidades
                    ? "Cargando localidades..."
                    : "Todas las localidades"}
                </option>
                {availableLocalidades.map((localidad) => (
                  <option key={localidad.id} value={localidad.id}>
                    {localidad.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="market-zona">Zona</FieldLabel>
              <select
                id="market-zona"
                className={fieldClassName}
                value={filters.zona_id}
                disabled={
                  !filters.localidad_georef_id ||
                  loadingOptions ||
                  !options?.zonas.length
                }
                onChange={(event) =>
                  updateFilter("zona_id", event.target.value)
                }
              >
                <option value="">Todas las zonas</option>
                {options?.zonas.map((zona) => (
                  <option key={zona.id} value={zona.id}>
                    {zona.nombre} ({zona.operaciones ?? 0})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="market-tipologia">Tipología</FieldLabel>
              <select
                id="market-tipologia"
                className={fieldClassName}
                value={filters.tipologia}
                onChange={(event) =>
                  updateFilter("tipologia", event.target.value)
                }
              >
                <option value="">Todas las tipologías</option>
                {options?.tipologias.map((item) => (
                  <option key={String(item.valor)} value={String(item.valor)}>
                    {capitalizeWords(String(item.valor))} ({item.operaciones})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="market-dormitorios">
                Dormitorios
              </FieldLabel>
              <select
                id="market-dormitorios"
                className={fieldClassName}
                value={filters.dormitorios}
                onChange={(event) =>
                  updateFilter("dormitorios", event.target.value)
                }
              >
                <option value="">Todos</option>
                {options?.dormitorios.map((item) => (
                  <option key={String(item.valor)} value={String(item.valor)}>
                    {String(item.valor)} ({item.operaciones})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="market-moneda">Moneda</FieldLabel>
              <select
                id="market-moneda"
                className={fieldClassName}
                value={filters.moneda}
                onChange={(event) =>
                  updateFilter("moneda", event.target.value)
                }
              >
                <option value="">Todas las monedas</option>
                {options?.monedas.map((item) => (
                  <option key={String(item.valor)} value={String(item.valor)}>
                    {String(item.valor)} ({item.operaciones})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="market-m2-desde">
                M² cubiertos desde
              </FieldLabel>
              <input
                id="market-m2-desde"
                className={fieldClassName}
                type="number"
                min="0"
                step="0.01"
                placeholder="Ej.: 40"
                value={filters.m2_cubiertos_desde}
                onChange={(event) =>
                  updateFilter("m2_cubiertos_desde", event.target.value)
                }
              />
            </div>

            <div>
              <FieldLabel htmlFor="market-m2-hasta">
                M² cubiertos hasta
              </FieldLabel>
              <input
                id="market-m2-hasta"
                className={fieldClassName}
                type="number"
                min="0"
                step="0.01"
                placeholder="Ej.: 120"
                value={filters.m2_cubiertos_hasta}
                onChange={(event) =>
                  updateFilter("m2_cubiertos_hasta", event.target.value)
                }
              />
            </div>

            <div>
              <FieldLabel htmlFor="market-periodo-rapido">
                Período rápido
              </FieldLabel>
              <select
                id="market-periodo-rapido"
                className={fieldClassName}
                value={periodoRapido}
                onChange={(event) =>
                  applyQuickPeriod(event.target.value as PeriodoRapido)
                }
              >
                <option value="">Seleccionar período</option>
                <option value="3">Últimos 3 meses</option>
                <option value="6">Últimos 6 meses</option>
                <option value="12">Últimos 12 meses</option>
                <option value="todo">Todo el período</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="market-fecha-desde">
                Fecha desde
              </FieldLabel>
              <input
                id="market-fecha-desde"
                className={fieldClassName}
                type="date"
                value={filters.fecha_desde}
                onChange={(event) =>
                  updateFilter("fecha_desde", event.target.value)
                }
              />
            </div>

            <div>
              <FieldLabel htmlFor="market-fecha-hasta">
                Fecha hasta
              </FieldLabel>
              <input
                id="market-fecha-hasta"
                className={fieldClassName}
                type="date"
                value={filters.fecha_hasta}
                onChange={(event) =>
                  updateFilter("fecha_hasta", event.target.value)
                }
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => consultarEstadisticas(filters)}
              disabled={loading}
              className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-gradient-to-r from-[#D99A22] to-[#F0BE54] px-6 py-2.5 text-sm font-bold text-black shadow-lg shadow-[#E6A930]/10 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingStats ? "Analizando mercado..." : "Consultar mercado"}
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Limpiar filtros
            </button>
          </div>
        </section>

        {error ? (
          <section className="mt-6 rounded-2xl border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-200">
            <strong>No se pudo completar la consulta.</strong>
            <p className="mt-1">{error}</p>
          </section>
        ) : null}

        {!hasSearched ? (
          <section className="mt-6 rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/50 p-9 text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl border border-[#E6A930]/30 bg-[#E6A930]/10" />
            <h2 className="mt-4 text-lg font-semibold text-white">
              Convertí datos en decisiones
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Elegí una combinación de filtros o realizá una consulta general
              para conocer el comportamiento real del mercado.
            </p>
          </section>
        ) : null}

        {hasSearched && loadingStats ? (
          <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-9 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-[#E6A930]" />
            <p className="mt-4 text-sm text-zinc-400">
              Procesando operaciones comparables…
            </p>
          </section>
        ) : null}

        {hasSearched && !loadingStats && stats && !stats.hay_datos ? (
          <section className="mt-6 rounded-3xl border border-amber-900/50 bg-amber-950/20 p-6">
            <h2 className="text-lg font-semibold text-amber-100">
              Todavía no hay una muestra suficiente
            </h2>
            <p className="mt-2 text-sm leading-6 text-amber-200/80">
              {stats.mensaje ??
                "No hay suficientes operaciones comparables para mostrar una referencia confiable."}
            </p>
            <p className="mt-3 text-xs text-amber-300/60">
              Probá ampliar el período o quitar alguno de los filtros.
            </p>
          </section>
        ) : null}

        {hasSearched && !loadingStats && stats?.hay_datos ? (
          <>
            <section className="mt-8 border-l-4 border-[#E6A930] pl-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#E6A930]">
                Análisis de mercado
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {selectedResultLabels.mainTitle}
              </h2>
              <h3 className="mt-2 text-xl font-medium text-zinc-300">
                {selectedResultLabels.secondLine}
              </h3>
              {selectedResultLabels.thirdLine ? (
                <p className="mt-1 text-base text-zinc-500">
                  {selectedResultLabels.thirdLine}
                </p>
              ) : null}
              <p className="mt-3 text-sm text-zinc-500">
                {formatNumber(stats.cantidad_operaciones, 0)} operaciones
                analizadas entre {formatDate(stats.fecha_desde)} y {formatDate(stats.fecha_hasta)}
                {` · Valores expresados en ${resultCurrency}`}
              </p>
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Operaciones analizadas"
                value={formatNumber(stats.cantidad_operaciones, 0)}
                subtitle={
                  stats.depuracion_extremos_aplicada
                    ? `Base inicial: ${formatNumber(
                        stats.cantidad_operaciones_base,
                        0
                      )}. Se depuraron valores extremos.`
                    : "Operaciones reales cerradas dentro de los filtros seleccionados."
                }
                accent
              />

              <StatCard
                title={
                  (lastAppliedFilters?.tipo_operacion ?? filters.tipo_operacion) === "venta"
                    ? "Precio promedio"
                    : "Alquiler promedio"
                }
                value={formatMoney(stats.valor_promedio, resultCurrency)}
              />

              <StatCard
                title="Valor mediano"
                value={formatMoney(stats.valor_mediano, resultCurrency)}
                subtitle="Referencia central con menor sensibilidad a operaciones atípicas."
              />

              <StatCard
                title="Valor promedio por m²"
                value={
                  stats.valor_m2_promedio == null
                    ? "—"
                    : `${formatMoney(
                        stats.valor_m2_promedio,
                        resultCurrency
                      )}/m²`
                }
                subtitle={`${formatNumber(
                  stats.cantidad_operaciones_con_m2,
                  0
                )} operaciones con superficie cubierta informada.`}
              />

              <StatCard
                title="Rango observado"
                value={
                  <span className="block leading-tight">
                    <span className="block">
                      {formatMoney(stats.valor_minimo, resultCurrency)}
                    </span>
                    <span className="mt-1 block text-lg text-zinc-300">
                      a {formatMoney(stats.valor_maximo, resultCurrency)}
                    </span>
                  </span>
                }
              />

              <StatCard
                title="M² cubiertos promedio"
                value={
                  stats.m2_cubiertos_promedio == null
                    ? "—"
                    : `${formatNumber(stats.m2_cubiertos_promedio)} m²`
                }
              />

              <StatCard
                title="Días a la venta"
                value={
                  stats.dias_a_la_venta_promedio == null
                    ? "—"
                    : `${formatNumber(stats.dias_a_la_venta_promedio, 0)} días`
                }
                subtitle="Promedio desde la salida al mercado hasta el cierre."
              />

              <StatCard
                title="GAP mediano de negociación"
                value={
                  stats.gap_disponible
                    ? formatPercentage(stats.gap_mediano)
                    : "Sin muestra suficiente"
                }
                subtitle={
                  stats.gap_disponible
                    ? `Diferencia entre el precio de publicación y el precio real de cierre. Base: ${formatNumber(
                        stats.cantidad_operaciones_gap,
                        0
                      )} ventas.`
                    : "El GAP mide la diferencia entre publicación y cierre; se necesitan al menos 3 ventas captadas comparables."
                }
                accent={Boolean(stats.gap_disponible)}
              />
            </section>

            {stats.depuracion_extremos_aplicada ? (
              <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4 text-xs leading-5 text-zinc-500">
                Para reducir distorsiones, la estadística excluyó operaciones
                fuera del rango comprendido entre los percentiles 5 y 95: {" "}
                {formatMoney(stats.percentil_inferior, resultCurrency)} – {" "}
                {formatMoney(stats.percentil_superior, resultCurrency)}.
              </section>
            ) : null}

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <RankingPanel
                title="Zonas con mayor actividad"
                subtitle="Ranking de cierres dentro del período y los criterios seleccionados."
                items={topZones.map((item) => ({
                  key: item.zona_id,
                  label: item.nombre,
                  operations: item.operaciones,
                  percentage: item.participacion_porcentaje,
                }))}
                emptyMessage="Todavía no hay suficientes cierres por zona para construir el ranking."
              />

              <RankingPanel
                title="Tipologías más demandadas"
                subtitle="Participación de las tipologías con mayor cantidad de operaciones cerradas."
                items={topTypes.map((item) => ({
                  key: item.tipologia,
                  label: capitalizeWords(item.tipologia),
                  operations: item.operaciones,
                  percentage: item.participacion_porcentaje,
                }))}
                emptyMessage="Todavía no hay suficientes cierres por tipología para construir el ranking."
              />
            </section>
          </>
        ) : null}

        <section className="mt-8 overflow-hidden rounded-3xl border border-[#E6A930]/25 bg-gradient-to-br from-zinc-950 via-black to-[#171005] shadow-2xl shadow-black/30">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-6 sm:p-8">
              <span className="inline-flex rounded-full border border-[#E6A930]/30 bg-[#E6A930]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#E6A930]">
                Herramienta para inversores
              </span>
              <h2 className="mt-4 text-2xl font-bold sm:text-3xl">
                Calculadora rápida de rentabilidad y PER
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                Ingresá el precio de compra y el alquiler mensual estimado para
                conocer la rentabilidad anual bruta y los años aproximados de
                recuperación de la inversión.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="per-precio-compra">
                    Precio de compra (USD)
                  </FieldLabel>
                  <input
                    id="per-precio-compra"
                    className={fieldClassName}
                    type="number"
                    min="0"
                    step="100"
                    placeholder="Ej.: 100000"
                    value={precioCompraUsd}
                    onChange={(event) => setPrecioCompraUsd(event.target.value)}
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="per-alquiler-mensual">
                    Alquiler mensual (USD)
                  </FieldLabel>
                  <input
                    id="per-alquiler-mensual"
                    className={fieldClassName}
                    type="number"
                    min="0"
                    step="10"
                    placeholder="Ej.: 550"
                    value={alquilerMensualUsd}
                    onChange={(event) =>
                      setAlquilerMensualUsd(event.target.value)
                    }
                  />
                </div>
              </div>

              <p className="mt-4 text-xs leading-5 text-zinc-600">
                Cálculo bruto orientativo. No contempla gastos, impuestos,
                vacancia, mantenimiento, expensas ni costos de adquisición.
              </p>
            </div>

            <div className="border-t border-zinc-800 bg-black/30 p-6 sm:p-8 lg:border-l lg:border-t-0">
              {perCalculation ? (
                <div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                      <p className="text-sm text-zinc-500">
                        Rentabilidad anual bruta
                      </p>
                      <p className="mt-2 text-3xl font-bold text-white">
                        {formatPercentage(perCalculation.annualYield)}
                      </p>
                      <p className="mt-2 text-xs text-zinc-600">
                        Ingreso anual estimado: US$ {formatNumber(
                          perCalculation.annualIncome,
                          0
                        )}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                      <p className="text-sm text-zinc-500">
                        Recuperación estimada
                      </p>
                      <p className="mt-2 text-3xl font-bold text-white">
                        {formatNumber(perCalculation.perYears, 1)} años
                      </p>
                      <p className="mt-2 text-xs text-zinc-600">
                        PER bruto de la inversión
                      </p>
                    </div>
                  </div>

                  <div
                    className={`mt-4 rounded-2xl border p-5 ${perCalculation.status.className}`}
                  >
                    <p className="text-sm font-semibold uppercase tracking-[0.15em]">
                      {perCalculation.status.label}
                    </p>
                    <p className="mt-1 text-sm opacity-80">
                      {perCalculation.status.description}
                    </p>
                  </div>

                  <div className="mt-5 grid gap-2 text-xs sm:grid-cols-3">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-emerald-300">
                      <strong>&lt; 15 años</strong>
                      <p className="mt-1 opacity-70">Buena oportunidad</p>
                    </div>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-amber-300">
                      <strong>15 a 20 años</strong>
                      <p className="mt-1 opacity-70">Rentabilidad aceptable</p>
                    </div>
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-red-300">
                      <strong>&gt; 20 años</strong>
                      <p className="mt-1 opacity-70">Recuperación lenta</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={abrirModalInforme}
                    className="mt-5 inline-flex min-h-[46px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#D99A22] to-[#F0BE54] px-6 py-2.5 text-sm font-bold text-black shadow-lg shadow-[#E6A930]/10 transition hover:brightness-110"
                  >
                    Generar informe
                  </button>
                </div>
              ) : (
                <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 p-6 text-center">
                  <div className="h-14 w-14 rounded-2xl border border-[#E6A930]/25 bg-[#E6A930]/10" />
                  <h3 className="mt-4 font-semibold text-white">
                    Completá ambos valores
                  </h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                    El resultado se calculará automáticamente y mostrará una
                    referencia visual de la recuperación estimada.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {informeModalAbierto && perCalculation ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="informe-rentabilidad-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) cerrarModalInforme();
            }}
          >
            <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/60">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-800 bg-zinc-950/95 px-5 py-5 backdrop-blur sm:px-7">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E6A930]">
                    Informe descargable
                  </p>
                  <h2
                    id="informe-rentabilidad-title"
                    className="mt-1 text-xl font-bold text-white sm:text-2xl"
                  >
                    Informe de Rentabilidad y PER
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Todos los campos son opcionales. Los datos no completados se
                    mostrarán con un guion en el PDF.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cerrarModalInforme}
                  disabled={generandoInforme}
                  aria-label="Cerrar"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-xl text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
                >
                  ×
                </button>
              </div>

              <div className="p-5 sm:p-7">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <FieldLabel htmlFor="informe-nombre-cliente">
                      Nombre del cliente
                    </FieldLabel>
                    <input
                      id="informe-nombre-cliente"
                      className={fieldClassName}
                      type="text"
                      placeholder="Ej.: Juan Pérez"
                      value={informeForm.nombreCliente}
                      onChange={(event) =>
                        updateInformeField("nombreCliente", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <FieldLabel htmlFor="informe-localidad">Localidad</FieldLabel>
                    <input
                      id="informe-localidad"
                      className={fieldClassName}
                      type="text"
                      placeholder="Ej.: Córdoba"
                      value={informeForm.localidad}
                      onChange={(event) =>
                        updateInformeField("localidad", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <FieldLabel htmlFor="informe-zona">Zona / Barrio</FieldLabel>
                    <input
                      id="informe-zona"
                      className={fieldClassName}
                      type="text"
                      placeholder="Ej.: Nueva Córdoba"
                      value={informeForm.zona}
                      onChange={(event) =>
                        updateInformeField("zona", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <FieldLabel htmlFor="informe-tipologia">Tipología</FieldLabel>
                    <input
                      id="informe-tipologia"
                      className={fieldClassName}
                      type="text"
                      placeholder="Ej.: Departamento"
                      value={informeForm.tipologia}
                      onChange={(event) =>
                        updateInformeField("tipologia", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <FieldLabel htmlFor="informe-ambientes">Ambientes</FieldLabel>
                    <input
                      id="informe-ambientes"
                      className={fieldClassName}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Ej.: 3"
                      value={informeForm.ambientes}
                      onChange={(event) =>
                        updateInformeField("ambientes", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <FieldLabel htmlFor="informe-m2-cubiertos">
                      m² cubiertos
                    </FieldLabel>
                    <input
                      id="informe-m2-cubiertos"
                      className={fieldClassName}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ej.: 85"
                      value={informeForm.m2Cubiertos}
                      onChange={(event) =>
                        updateInformeField("m2Cubiertos", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <FieldLabel htmlFor="informe-antiguedad">
                      Antigüedad (años)
                    </FieldLabel>
                    <input
                      id="informe-antiguedad"
                      className={fieldClassName}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Ej.: 8"
                      value={informeForm.antiguedad}
                      onChange={(event) =>
                        updateInformeField("antiguedad", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <FieldLabel htmlFor="informe-estado-propiedad">
                      Estado de la propiedad
                    </FieldLabel>
                    <select
                      id="informe-estado-propiedad"
                      className={fieldClassName}
                      value={informeForm.estadoPropiedad}
                      onChange={(event) =>
                        updateInformeField("estadoPropiedad", event.target.value)
                      }
                    >
                      <option value="">Seleccionar estado</option>
                      <option value="A estrenar">A estrenar</option>
                      <option value="Excelente">Excelente</option>
                      <option value="Muy buena">Muy buena</option>
                      <option value="Buena">Buena</option>
                      <option value="Mala">Mala</option>
                      <option value="A reciclar">A reciclar</option>
                      <option value="Reciclada">Reciclada</option>
                    </select>
                  </div>

                  <div>
                    <FieldLabel htmlFor="informe-demanda-alquiler">
                      Demanda locativa en la zona
                    </FieldLabel>
                    <select
                      id="informe-demanda-alquiler"
                      className={fieldClassName}
                      value={informeForm.demandaAlquiler}
                      onChange={(event) =>
                        updateInformeField("demandaAlquiler", event.target.value)
                      }
                    >
                      <option value="">Seleccionar demanda</option>
                      <option value="Muy alta">Muy alta</option>
                      <option value="Alta">Alta</option>
                      <option value="Moderada">Moderada</option>
                      <option value="Baja">Baja</option>
                      <option value="Muy baja">Muy baja</option>
                    </select>
                  </div>

                  <div>
                    <FieldLabel htmlFor="informe-alquiler-promedio">
                      Alquiler mensual estimado
                    </FieldLabel>
                    <input
                      id="informe-alquiler-promedio"
                      className={fieldClassName}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Ej.: 650000"
                      value={informeForm.alquilerPromedio}
                      onChange={(event) =>
                        updateInformeField("alquilerPromedio", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <FieldLabel htmlFor="informe-moneda-alquiler">
                      Moneda del alquiler estimado
                    </FieldLabel>
                    <select
                      id="informe-moneda-alquiler"
                      className={fieldClassName}
                      value={informeForm.monedaAlquilerPromedio}
                      onChange={(event) =>
                        updateInformeField(
                          "monedaAlquilerPromedio",
                          event.target.value as "ARS" | "USD"
                        )
                      }
                    >
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <FieldLabel htmlFor="informe-observaciones">
                      Observaciones generales
                    </FieldLabel>
                    <textarea
                      id="informe-observaciones"
                      className={`${fieldClassName} min-h-[140px] resize-y`}
                      placeholder="Podés agregar comentarios sobre el inmueble, la inversión, fortalezas, aspectos a considerar u otra información relevante."
                      value={informeForm.observaciones}
                      onChange={(event) =>
                        updateInformeField("observaciones", event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                    Datos tomados de la calculadora
                  </p>
                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                      <span className="text-zinc-500">Precio de compra:</span>{" "}
                      <strong className="text-white">
                        USD {formatNumber(Number(precioCompraUsd), 0)}
                      </strong>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                      <span className="text-zinc-500">Alquiler para PER:</span>{" "}
                      <strong className="text-white">
                        USD {formatNumber(Number(alquilerMensualUsd), 0)}
                      </strong>
                    </div>
                  </div>
                </div>

                {informeError ? (
                  <div className="mt-5 rounded-xl border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-200">
                    {informeError}
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={cerrarModalInforme}
                    disabled={generandoInforme}
                    className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadRentabilidadPDF}
                    disabled={generandoInforme}
                    className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-gradient-to-r from-[#D99A22] to-[#F0BE54] px-6 py-2.5 text-sm font-bold text-black shadow-lg shadow-[#E6A930]/10 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {generandoInforme
                      ? "Generando informe..."
                      : "Descargar informe PDF"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <section className="mt-6 rounded-3xl border border-[#E6A930]/20 bg-[#E6A930]/5 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#E6A930]">
            Datos agregados y privacidad
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Los resultados se construyen con operaciones reales cerradas y
            datos agregados de forma anónima. No se muestran empresas,
            asesores, clientes, direcciones ni propiedades individuales.
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Las referencias son orientativas y no reemplazan una valuación
            profesional específica del inmueble.
          </p>
        </section>
      </div>
    </main>
  );
}
