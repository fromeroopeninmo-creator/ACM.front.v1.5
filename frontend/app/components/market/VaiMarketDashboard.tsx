"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "#lib/supabaseClient";

type TipoOperacion = "venta" | "alquiler";

type GeoOption = {
  id: string;
  nombre: string;
  operaciones?: number;
};

type ValueOption = {
  valor: string | number;
  operaciones: number;
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
  "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[#E6A930] focus:ring-1 focus:ring-[#E6A930] disabled:cursor-not-allowed disabled:opacity-50";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function parseNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: number | null | undefined, moneda: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const symbol = moneda === "USD" ? "US$" : moneda === "ARS" ? "$" : moneda || "$";
  return `${symbol} ${new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function formatNumber(
  value: number | null | undefined,
  maximumFractionDigits = 2
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Ocurrió un error inesperado.";
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
      {subtitle ? <p className="mt-2 text-xs leading-5 text-zinc-500">{subtitle}</p> : null}
    </article>
  );
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-zinc-300">
      {children}
    </label>
  );
}

export default function VaiMarketDashboard() {
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [provincias, setProvincias] = useState<GeoOption[]>([]);
  const [localidades, setLocalidades] = useState<GeoOption[]>([]);
  const [options, setOptions] = useState<MarketFilterOptionsResponse | null>(null);
  const [stats, setStats] = useState<MarketStatsResponse | null>(null);
  const [loadingProvincias, setLoadingProvincias] = useState(true);
  const [loadingLocalidades, setLoadingLocalidades] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const selectedCurrency = filters.moneda || "ARS";

  const buildRpcParams = useCallback((currentFilters: FiltersState) => ({
    p_tipo_operacion: currentFilters.tipo_operacion,
    p_provincia_georef_id: currentFilters.provincia_georef_id || null,
    p_localidad_georef_id: currentFilters.localidad_georef_id || null,
    p_zona_id: currentFilters.zona_id || null,
    p_tipologia: currentFilters.tipologia || null,
    p_dormitorios:
      currentFilters.dormitorios === "" ? null : Number(currentFilters.dormitorios),
    p_moneda: currentFilters.moneda || null,
    p_m2_cubiertos_desde: parseNullableNumber(currentFilters.m2_cubiertos_desde),
    p_m2_cubiertos_hasta: parseNullableNumber(currentFilters.m2_cubiertos_hasta),
    p_fecha_desde: currentFilters.fecha_desde || null,
    p_fecha_hasta: currentFilters.fecha_hasta || null,
  }), []);

  const cargarProvincias = useCallback(async () => {
    setLoadingProvincias(true);
    try {
      const response = await fetch("/api/geografia/provincias");
      if (!response.ok) throw new Error("No se pudieron cargar las provincias.");
      const payload = (await response.json()) as GeoOption[] | { provincias?: GeoOption[]; data?: GeoOption[] };
      setProvincias(Array.isArray(payload) ? payload : asArray(payload.provincias ?? payload.data));
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
      const response = await fetch(`/api/geografia/localidades?provincia=${encodeURIComponent(provinciaId)}`);
      if (!response.ok) throw new Error("No se pudieron cargar las localidades.");
      const payload = (await response.json()) as GeoOption[] | { localidades?: GeoOption[]; data?: GeoOption[] };
      setLocalidades(Array.isArray(payload) ? payload : asArray(payload.localidades ?? payload.data));
    } catch (requestError) {
      setLocalidades([]);
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingLocalidades(false);
    }
  }, []);

  const cargarOpciones = useCallback(async (currentFilters: FiltersState) => {
    setLoadingOptions(true);
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "get_vai_market_filter_options_v2",
        buildRpcParams(currentFilters)
      );
      if (rpcError) throw rpcError;
      const payload = (data ?? {}) as Partial<MarketFilterOptionsResponse>;
      setOptions({
        tipo_operacion: payload.tipo_operacion ?? currentFilters.tipo_operacion,
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
  }, [buildRpcParams]);

  const consultarEstadisticas = useCallback(async (currentFilters: FiltersState) => {
    setLoadingStats(true);
    setHasSearched(true);
    setError(null);
    try {
      const [statsResponse] = await Promise.all([
        supabase.rpc("get_vai_market_stats_v2", buildRpcParams(currentFilters)),
        cargarOpciones(currentFilters),
      ]);
      if (statsResponse.error) throw statsResponse.error;
      setStats((statsResponse.data ?? {
        hay_datos: false,
        mensaje: "No se recibieron estadísticas.",
      }) as MarketStatsResponse);
    } catch (requestError) {
      setStats(null);
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingStats(false);
    }
  }, [buildRpcParams, cargarOpciones]);

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

  function updateFilter<K extends keyof FiltersState>(key: K, value: FiltersState[K]) {
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
      if (key === "localidad_georef_id") next.zona_id = "";
      return next;
    });
  }

  function handleReset() {
    setFilters(INITIAL_FILTERS);
    setStats(null);
    setHasSearched(false);
    setError(null);
    cargarOpciones(INITIAL_FILTERS);
  }

  const loading = loadingStats || loadingOptions;

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 to-black p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-[#E6A930]/40 bg-[#E6A930]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#E6A930]">
                Inteligencia inmobiliaria
              </span>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">VAI Market Data</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
                Referencias construidas con operaciones reales cerradas y consolidadas de forma anónima.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-400">
              Muestra mínima: <strong className="text-white">{options?.muestra_minima ?? 3} operaciones</strong>
            </div>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Filtros de mercado</h2>
            <p className="mt-1 text-sm text-zinc-500">Cuanto mayor sea el nivel de detalle, menor puede ser la muestra disponible.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div>
              <FieldLabel htmlFor="market-tipo-operacion">Operación</FieldLabel>
              <select id="market-tipo-operacion" className={fieldClassName} value={filters.tipo_operacion} onChange={(event) => updateFilter("tipo_operacion", event.target.value as TipoOperacion)}>
                <option value="venta">Venta</option>
                <option value="alquiler">Alquiler</option>
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="market-provincia">Provincia</FieldLabel>
              <select id="market-provincia" className={fieldClassName} value={filters.provincia_georef_id} disabled={loadingProvincias} onChange={(event) => updateFilter("provincia_georef_id", event.target.value)}>
                <option value="">{loadingProvincias ? "Cargando provincias..." : "Todas las provincias"}</option>
                {availableProvincias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="market-localidad">Localidad</FieldLabel>
              <select id="market-localidad" className={fieldClassName} value={filters.localidad_georef_id} disabled={!filters.provincia_georef_id || loadingLocalidades} onChange={(event) => updateFilter("localidad_georef_id", event.target.value)}>
                <option value="">{loadingLocalidades ? "Cargando localidades..." : "Todas las localidades"}</option>
                {availableLocalidades.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="market-zona">Zona</FieldLabel>
              <select id="market-zona" className={fieldClassName} value={filters.zona_id} disabled={!filters.localidad_georef_id || loadingOptions || !options?.zonas.length} onChange={(event) => updateFilter("zona_id", event.target.value)}>
                <option value="">Todas las zonas</option>
                {options?.zonas.map((item) => <option key={item.id} value={item.id}>{item.nombre} ({item.operaciones ?? 0})</option>)}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="market-tipologia">Tipología</FieldLabel>
              <select id="market-tipologia" className={fieldClassName} value={filters.tipologia} onChange={(event) => updateFilter("tipologia", event.target.value)}>
                <option value="">Todas las tipologías</option>
                {options?.tipologias.map((item) => <option key={String(item.valor)} value={String(item.valor)}>{String(item.valor)} ({item.operaciones})</option>)}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="market-dormitorios">Dormitorios</FieldLabel>
              <select id="market-dormitorios" className={fieldClassName} value={filters.dormitorios} onChange={(event) => updateFilter("dormitorios", event.target.value)}>
                <option value="">Todos</option>
                {options?.dormitorios.map((item) => <option key={String(item.valor)} value={String(item.valor)}>{String(item.valor)} ({item.operaciones})</option>)}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="market-moneda">Moneda</FieldLabel>
              <select id="market-moneda" className={fieldClassName} value={filters.moneda} onChange={(event) => updateFilter("moneda", event.target.value)}>
                <option value="">Todas las monedas</option>
                {options?.monedas.map((item) => <option key={String(item.valor)} value={String(item.valor)}>{String(item.valor)} ({item.operaciones})</option>)}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="market-m2-desde">M² cubiertos desde</FieldLabel>
              <input id="market-m2-desde" className={fieldClassName} type="number" min="0" step="0.01" placeholder="Ej.: 40" value={filters.m2_cubiertos_desde} onChange={(event) => updateFilter("m2_cubiertos_desde", event.target.value)} />
            </div>

            <div>
              <FieldLabel htmlFor="market-m2-hasta">M² cubiertos hasta</FieldLabel>
              <input id="market-m2-hasta" className={fieldClassName} type="number" min="0" step="0.01" placeholder="Ej.: 120" value={filters.m2_cubiertos_hasta} onChange={(event) => updateFilter("m2_cubiertos_hasta", event.target.value)} />
            </div>

            <div>
              <FieldLabel htmlFor="market-fecha-desde">Fecha desde</FieldLabel>
              <input id="market-fecha-desde" className={fieldClassName} type="date" value={filters.fecha_desde} onChange={(event) => updateFilter("fecha_desde", event.target.value)} />
            </div>

            <div>
              <FieldLabel htmlFor="market-fecha-hasta">Fecha hasta</FieldLabel>
              <input id="market-fecha-hasta" className={fieldClassName} type="date" value={filters.fecha_hasta} onChange={(event) => updateFilter("fecha_hasta", event.target.value)} />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => consultarEstadisticas(filters)} disabled={loading} className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#E6A930] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#f0b83d] disabled:cursor-not-allowed disabled:opacity-60">
              {loadingStats ? "Analizando..." : "Consultar mercado"}
            </button>
            <button type="button" onClick={handleReset} disabled={loading} className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60">
              Limpiar filtros
            </button>
          </div>
        </section>

        {error ? <section className="mt-6 rounded-2xl border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-200"><strong>No se pudo completar la consulta.</strong><p className="mt-1">{error}</p></section> : null}

        {!hasSearched ? <section className="mt-6 rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/50 p-8 text-center"><h2 className="text-lg font-semibold">Preparado para consultar</h2><p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Elegí una combinación de filtros y presioná “Consultar mercado”. También podés hacer una consulta general.</p></section> : null}

        {hasSearched && loadingStats ? <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center"><p className="text-sm text-zinc-400">Procesando operaciones comparables…</p></section> : null}

        {hasSearched && !loadingStats && stats && !stats.hay_datos ? <section className="mt-6 rounded-3xl border border-amber-900/50 bg-amber-950/20 p-6"><h2 className="text-lg font-semibold text-amber-100">Muestra insuficiente</h2><p className="mt-2 text-sm leading-6 text-amber-200/80">{stats.mensaje ?? "No hay suficientes operaciones para mostrar una referencia confiable."}</p><p className="mt-3 text-xs text-amber-300/60">Probá quitar alguno de los filtros para ampliar la muestra.</p></section> : null}

        {hasSearched && !loadingStats && stats?.hay_datos ? (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Operaciones analizadas" value={formatNumber(stats.cantidad_operaciones, 0)} subtitle={stats.depuracion_extremos_aplicada ? `Base inicial: ${formatNumber(stats.cantidad_operaciones_base, 0)}. Se depuraron valores extremos.` : "Operaciones reales cerradas dentro de los filtros seleccionados."} />
              <StatCard title={filters.tipo_operacion === "venta" ? "Precio promedio" : "Alquiler promedio"} value={formatMoney(stats.valor_promedio, selectedCurrency)} />
              <StatCard title="Valor mediano" value={formatMoney(stats.valor_mediano, selectedCurrency)} subtitle="La mediana reduce el efecto de valores excepcionalmente altos o bajos." />
              <StatCard title="Valor promedio por m²" value={stats.valor_m2_promedio == null ? "—" : `${formatMoney(stats.valor_m2_promedio, selectedCurrency)}/m²`} subtitle={`${formatNumber(stats.cantidad_operaciones_con_m2, 0)} operaciones con superficie informada.`} />
              <StatCard title="Rango observado" value={`${formatMoney(stats.valor_minimo, selectedCurrency)} – ${formatMoney(stats.valor_maximo, selectedCurrency)}`} />
              <StatCard title="M² cubiertos promedio" value={stats.m2_cubiertos_promedio == null ? "—" : `${formatNumber(stats.m2_cubiertos_promedio)} m²`} />
              <StatCard title="Período analizado" value={`${formatDate(stats.fecha_desde)} – ${formatDate(stats.fecha_hasta)}`} />
              <StatCard title="Calidad de la referencia" value={(stats.cantidad_operaciones ?? 0) >= 10 ? "Muestra ampliada" : (stats.cantidad_operaciones ?? 0) >= 5 ? "Muestra intermedia" : "Muestra inicial"} subtitle={stats.cantidad_operaciones === 3 ? "Estimación basada en 3 operaciones reales cerradas." : "La precisión mejora a medida que se incorporan nuevas operaciones comparables."} />
            </section>

            {stats.depuracion_extremos_aplicada ? <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4 text-xs leading-5 text-zinc-500">Para reducir distorsiones, se excluyeron operaciones fuera del rango p5–p95: {formatMoney(stats.percentil_inferior, selectedCurrency)} – {formatMoney(stats.percentil_superior, selectedCurrency)}.</section> : null}
          </>
        ) : null}

        <section className="mt-6 rounded-3xl border border-[#E6A930]/25 bg-[#E6A930]/5 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#E6A930]">Datos agregados y privacidad</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-300">Los resultados se construyen con operaciones reales cerradas y datos agregados de forma anónima. No se muestran empresas, asesores, clientes, direcciones ni propiedades individuales.</p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">Las referencias son orientativas y no reemplazan una valuación profesional específica del inmueble.</p>
        </section>
      </div>
    </main>
  );
}
