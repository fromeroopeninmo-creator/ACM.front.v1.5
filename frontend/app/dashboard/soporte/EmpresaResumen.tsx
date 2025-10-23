// frontend/app/dashboard/soporte/EmpresaResumen.tsx
"use client";

type EmpresaResumenProps = {
  empresa: {
    id: string;
    razon_social: string;
    cuit: string;
    condicion_fiscal?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    localidad?: string | null;
    provincia?: string | null;
    logo_url?: string | null;
    color?: string | null;
    plan?: {
      id: string;
      nombre: string;
      max_asesores: number;
      duracion_dias?: number | null;
      precio?: number | null;
    } | null;
    override?: {
      max_asesores_override?: number | null;
      fecha_inicio?: string | null;
      fecha_fin?: string | null;
      activo?: boolean | null;
    } | null;
  };
  metrics: {
    asesores_count: number;
    informes_30d: number;
    ultima_actividad_at?: string | null;
  };
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

function fmtDateOnly(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString();
}

function fmtNumber(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR").format(n);
}

function fmtMoney(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function EmpresaResumen({ empresa, metrics }: EmpresaResumenProps) {
  return (
    <section className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
      <div className="flex items-start gap-4">
        {/* Logo */}
        <div className="w-16 h-16 rounded-xl border flex items-center justify-center overflow-hidden bg-white dark:bg-neutral-950">
          {empresa.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={empresa.logo_url}
              alt="Logo empresa"
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-xs text-gray-400">Sin logo</span>
          )}
        </div>

        {/* Datos de cabecera */}
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{empresa.razon_social}</h2>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <div>CUIT: {empresa.cuit}</div>
            <div>
              {[empresa.direccion, empresa.localidad, empresa.provincia]
                .filter(Boolean)
                .join(", ") || "—"}
            </div>
            <div>Condición fiscal: {empresa.condicion_fiscal || "—"}</div>
            <div>Teléfono: {empresa.telefono || "—"}</div>
          </div>
        </div>

        {/* Color corporativo */}
        <div className="shrink-0">
          <div className="text-xs text-gray-500 mb-1">Color corporativo</div>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md border"
              style={{ backgroundColor: empresa.color || "#e5e7eb" }}
              title={empresa.color || "—"}
            />
            <code className="text-xs">{empresa.color || "—"}</code>
          </div>
        </div>
      </div>

      {/* Plan + override + métricas */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border p-3">
          <div className="text-xs text-gray-500">Plan</div>
          <div className="font-medium">{empresa.plan?.nombre || "—"}</div>
          <dl className="mt-2 text-sm space-y-1">
            <div className="flex justify-between">
              <dt>Cupo base</dt>
              <dd>{fmtNumber(empresa.plan?.max_asesores)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Duración</dt>
              <dd>
                {empresa.plan?.duracion_dias
                  ? `${empresa.plan?.duracion_dias} días`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Precio neto</dt>
              <dd>{fmtMoney(empresa.plan?.precio ?? null)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border p-3">
          <div className="text-xs text-gray-500">Override</div>
          <dl className="mt-1 text-sm space-y-1">
            <div className="flex justify-between">
              <dt>Cupo override</dt>
              <dd>{fmtNumber(empresa.override?.max_asesores_override)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Vigencia</dt>
              <dd>
                {fmtDateOnly(empresa.override?.fecha_inicio)} —{" "}
                {fmtDateOnly(empresa.override?.fecha_fin)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Estado</dt>
              <dd>{empresa.override?.activo ? "Activo" : "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border p-3">
          <div className="text-xs text-gray-500">Métricas</div>
          <dl className="mt-1 text-sm space-y-1">
            <div className="flex justify-between">
              <dt>Asesores</dt>
              <dd>{fmtNumber(metrics.asesores_count)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Informes (30 días)</dt>
              <dd>{fmtNumber(metrics.informes_30d)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Última actividad</dt>
              <dd>{fmtDate(metrics.ultima_actividad_at)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
