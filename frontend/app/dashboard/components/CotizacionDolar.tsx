"use client";

import useSWR from "swr";

type Cotizacion = {
  casa: "oficial" | "blue";
  nombre: string;
  compra: number;
  venta: number;
  moneda: string;
  fechaActualizacion: string;
};

type CotizacionDolarResponse = {
  ok: boolean;
  fuente: string;
  fuenteUrl?: string;
  oficial: Cotizacion;
  blue: Cotizacion;
  consultadoEn: string;
};

const fetcher = async (url: string): Promise<CotizacionDolarResponse> => {
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      payload?.error || "No fue posible obtener la cotización del dólar.",
    );
  }

  return response.json();
};

function formatearMoneda(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatearFechaHora(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha informada";
  }

  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Cordoba",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function CotizacionCard({ cotizacion }: { cotizacion: Cotizacion }) {
  return (
    <article className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {cotizacion.nombre}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Actualizado: {formatearFechaHora(cotizacion.fechaActualizacion)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:min-w-[280px]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Compra
            </p>
            <p className="text-lg font-bold text-gray-900">
              {formatearMoneda(cotizacion.compra)}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Venta
            </p>
            <p className="text-lg font-bold text-gray-900">
              {formatearMoneda(cotizacion.venta)}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function CotizacionDolar() {
  const { data, error, isLoading, isValidating, mutate } =
    useSWR<CotizacionDolarResponse>(
      "/api/cotizaciones/dolar",
      fetcher,
      {
        refreshInterval: 300000,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 60000,
        shouldRetryOnError: true,
        errorRetryCount: 2,
        errorRetryInterval: 10000,
      },
    );

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Cotización del dólar
          </h2>
          <p className="text-sm text-gray-600">
            Valores de referencia para operaciones inmobiliarias.
          </p>
        </div>

        {data?.fuenteUrl ? (
          <a
            href={data.fuenteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-gray-500 underline underline-offset-2 hover:text-gray-800"
          >
            Fuente: {data.fuente}
          </a>
        ) : (
          <span className="text-xs font-medium text-gray-500">
            Fuente: DolarApi
          </span>
        )}
      </div>

      {isLoading && !data ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="h-[88px] animate-pulse rounded-xl bg-gray-100" />
          <div className="h-[88px] animate-pulse rounded-xl bg-gray-100" />
        </div>
      ) : error || !data?.ok ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-900">
            La cotización no está disponible temporalmente. El resto del
            dashboard continúa funcionando normalmente.
          </p>
          <button
            type="button"
            onClick={() => mutate()}
            className="self-start rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 sm:self-auto"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <CotizacionCard cotizacion={data.oficial} />
            <CotizacionCard cotizacion={data.blue} />
          </div>

          <div className="mt-3 flex flex-col gap-1 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Los valores son informativos y pueden variar según la fuente.
            </span>
            {isValidating ? (
              <span aria-live="polite">Actualizando cotización...</span>
            ) : (
              <span>Actualización automática cada 5 minutos.</span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
