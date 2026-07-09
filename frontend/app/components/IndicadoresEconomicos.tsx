"use client";

import { useEffect, useMemo, useState } from "react";

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

type IndicadoresResponse = {
  ok?: boolean;
  generatedAt?: string;
  fuentePrincipal?: string;
  fuenteSecundaria?: string;
  indicadores?: Indicador[];
  error?: string;
};

const ORDER: Indicador["codigo"][] = [
  "IPC_MENSUAL",
  "IPC_INTERANUAL",
  "ICL",
  "UVA",
  "CER",
];

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const datePart = value.includes("T") ? value.split("T")[0] : value;
  const [year, month, day] = datePart.split("-").map(Number);

  if (!year || !month || !day) return value;

  return new Date(year, month - 1, day, 12).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getTone(codigo: Indicador["codigo"]): string {
  if (codigo === "IPC_MENSUAL" || codigo === "IPC_INTERANUAL") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  if (codigo === "ICL") {
    return "border-blue-200 bg-blue-50 text-blue-900";
  }

  if (codigo === "UVA") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  return "border-slate-200 bg-slate-50 text-slate-900";
}

export default function IndicadoresEconomicos() {
  const [data, setData] = useState<IndicadoresResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchIndicadores = async () => {
      try {
        setError(null);
        const res = await fetch("/api/indicadores/economicos", {
          cache: "no-store",
        });

        const payload = (await res.json().catch(() => null)) as
          | IndicadoresResponse
          | null;

        if (!res.ok || !payload) {
          throw new Error("No se pudieron cargar los indicadores.");
        }

        if (!cancelled) {
          setData(payload);
        }
      } catch (err) {
        console.error("Error cargando indicadores económicos:", err);
        if (!cancelled) {
          setError("No se pudieron cargar los indicadores económicos.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchIndicadores();

    const timer = setInterval(fetchIndicadores, 1000 * 60 * 60);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const indicadores = useMemo(() => {
    const rows = Array.isArray(data?.indicadores) ? data.indicadores : [];
    return [...rows].sort(
      (a, b) => ORDER.indexOf(a.codigo) - ORDER.indexOf(b.codigo)
    );
  }, [data]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Indicadores económicos
          </h2>
          <p className="text-sm text-slate-500">
            IPC, ICL, UVA y CER para seguimiento de ajustes.
          </p>
        </div>

        <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
          Autoactualizable
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[92px] animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {indicadores.map((item) => (
              <article
                key={item.codigo}
                className={`rounded-xl border p-3 ${getTone(item.codigo)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-75">
                      {item.nombre}
                    </p>
                    <p className="mt-1 text-xl font-bold leading-tight">
                      {item.valorFormateado || "—"}
                    </p>
                  </div>

                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold opacity-80">
                    {item.fuente}
                  </span>
                </div>

                <p className="mt-2 line-clamp-2 text-xs leading-4 opacity-75">
                  {item.descripcion}
                </p>
                <p className="mt-1 text-[11px] opacity-60">
                  Fecha dato: {formatDate(item.fecha)}
                </p>
              </article>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-4 text-slate-400">
            Fuentes: BCRA / ArgentinaDatos. Última consulta: {formatDate(data?.generatedAt)}.
          </p>
        </>
      )}
    </section>
  );
}
