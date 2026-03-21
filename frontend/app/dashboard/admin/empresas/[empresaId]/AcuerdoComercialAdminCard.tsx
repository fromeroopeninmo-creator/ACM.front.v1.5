"use client";

import { useMemo, useState } from "react";

type AcuerdoComercial = {
  activo: boolean;
  id?: string | null;
  tipo?: string | null;
  precio_base_neto?: number | null;
  precio_neto_final?: number | null;
  precio_total_final?: number | null;
  modo_iva?: string | null;
  iva_pct?: number | null;
  iva_importe?: number | null;
  max_asesores_plan?: number | null;
  max_asesores_final?: number | null;
  precio_extra_por_asesor_plan?: number | null;
  precio_extra_por_asesor_final?: number | null;
  pricing_source?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  motivo?: string | null;
  observaciones?: string | null;
} | null;

type Props = {
  empresaId: string;
  acuerdoActual: AcuerdoComercial;
};

type TipoAcuerdo =
  | "descuento_pct"
  | "precio_fijo"
  | "precio_fijo_con_cupo"
  | "descuento_con_cupo";

type ModoIVA = "sumar_al_neto" | "incluido_en_precio" | "no_aplica";

type HistorialItem = {
  id: string;
  activo: boolean;
  tipo_acuerdo: string | null;
  descuento_pct: number | null;
  precio_neto_fijo: number | null;
  max_asesores_override: number | null;
  precio_extra_por_asesor_override: number | null;
  modo_iva: string | null;
  iva_pct: number | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  motivo: string | null;
  observaciones: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDateOnly(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString();
}

function fmtMoney(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtModoIVA(v?: string | null) {
  switch (v) {
    case "sumar_al_neto":
      return "Sumar al neto";
    case "incluido_en_precio":
      return "Incluido en precio";
    case "no_aplica":
      return "No aplica";
    default:
      return "—";
  }
}

function fmtTipoAcuerdo(v?: string | null) {
  switch (v) {
    case "descuento_pct":
      return "Descuento %";
    case "precio_fijo":
      return "Precio fijo";
    case "precio_fijo_con_cupo":
      return "Precio fijo + cupo";
    case "descuento_con_cupo":
      return "Descuento + cupo";
    default:
      return "—";
  }
}

export default function AcuerdoComercialAdminCard({
  empresaId,
  acuerdoActual,
}: Props) {
  const initialTipo = (acuerdoActual?.tipo as TipoAcuerdo | undefined) ?? "precio_fijo";

  const [mode, setMode] = useState<"none" | "create" | "edit" | "historial">("none");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);

  const [tipoAcuerdo, setTipoAcuerdo] = useState<TipoAcuerdo>(initialTipo);
  const [descuentoPct, setDescuentoPct] = useState<string>(
    acuerdoActual?.tipo?.includes("descuento")
      ? String(acuerdoActual?.precio_neto_final ? "" : "")
      : ""
  );
  const [precioNetoFijo, setPrecioNetoFijo] = useState<string>(
    acuerdoActual?.precio_neto_final != null ? String(acuerdoActual.precio_neto_final) : ""
  );
  const [maxAsesoresOverride, setMaxAsesoresOverride] = useState<string>(
    acuerdoActual?.max_asesores_final != null ? String(acuerdoActual.max_asesores_final) : ""
  );
  const [precioExtraPorAsesorOverride, setPrecioExtraPorAsesorOverride] = useState<string>(
    acuerdoActual?.precio_extra_por_asesor_final != null
      ? String(acuerdoActual.precio_extra_por_asesor_final)
      : ""
  );
  const [modoIva, setModoIva] = useState<ModoIVA>(
    (acuerdoActual?.modo_iva as ModoIVA | undefined) ?? "sumar_al_neto"
  );
  const [ivaPct, setIvaPct] = useState<string>(
    acuerdoActual?.iva_pct != null ? String(acuerdoActual.iva_pct) : "21"
  );
  const [fechaInicio, setFechaInicio] = useState<string>(
    acuerdoActual?.fecha_inicio || todayDateOnly()
  );
  const [fechaFin, setFechaFin] = useState<string>(acuerdoActual?.fecha_fin || "");
  const [motivo, setMotivo] = useState<string>(acuerdoActual?.motivo || "");
  const [observaciones, setObservaciones] = useState<string>(
    acuerdoActual?.observaciones || ""
  );

  const isEdit = !!acuerdoActual?.id;

  const visibleFields = useMemo(() => {
    return {
      showDescuento:
        tipoAcuerdo === "descuento_pct" || tipoAcuerdo === "descuento_con_cupo",
      showPrecioFijo:
        tipoAcuerdo === "precio_fijo" || tipoAcuerdo === "precio_fijo_con_cupo",
      showCupo:
        tipoAcuerdo === "precio_fijo_con_cupo" || tipoAcuerdo === "descuento_con_cupo",
    };
  }, [tipoAcuerdo]);

  async function handleSubmit() {
    try {
      setLoading(true);
      setErrorMsg(null);
      setMessage(null);

      const payload: Record<string, any> = {
        tipo_acuerdo: tipoAcuerdo,
        descuento_pct: visibleFields.showDescuento && descuentoPct !== "" ? Number(descuentoPct) : null,
        precio_neto_fijo: visibleFields.showPrecioFijo && precioNetoFijo !== "" ? Number(precioNetoFijo) : null,
        max_asesores_override: visibleFields.showCupo && maxAsesoresOverride !== "" ? Number(maxAsesoresOverride) : null,
        precio_extra_por_asesor_override:
          precioExtraPorAsesorOverride !== "" ? Number(precioExtraPorAsesorOverride) : null,
        modo_iva: modoIva,
        iva_pct: ivaPct !== "" ? Number(ivaPct) : 21,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin || null,
        motivo: motivo || null,
        observaciones: observaciones || null,
      };

      const url = isEdit && acuerdoActual?.id
        ? `/api/admin/empresas/${encodeURIComponent(empresaId)}/acuerdo-comercial/${encodeURIComponent(acuerdoActual.id)}`
        : `/api/admin/empresas/${encodeURIComponent(empresaId)}/acuerdo-comercial`;

      const method = isEdit && acuerdoActual?.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "No se pudo guardar el acuerdo comercial.");
      }

      setMessage(isEdit ? "Acuerdo comercial actualizado correctamente." : "Acuerdo comercial creado correctamente.");
      setMode("none");
      window.location.reload();
    } catch (e: any) {
      setErrorMsg(e?.message || "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDesactivar() {
    if (!acuerdoActual?.id) return;

    const ok = window.confirm(
      "¿Seguro que querés desactivar el acuerdo comercial activo?"
    );
    if (!ok) return;

    try {
      setLoading(true);
      setErrorMsg(null);
      setMessage(null);

      const res = await fetch(
        `/api/admin/empresas/${encodeURIComponent(empresaId)}/acuerdo-comercial/${encodeURIComponent(acuerdoActual.id)}/desactivar`,
        {
          method: "POST",
        }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "No se pudo desactivar el acuerdo comercial.");
      }

      setMessage("Acuerdo comercial desactivado correctamente.");
      window.location.reload();
    } catch (e: any) {
      setErrorMsg(e?.message || "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function handleHistorial() {
    try {
      setLoading(true);
      setErrorMsg(null);
      setMessage(null);

      const res = await fetch(
        `/api/admin/empresas/${encodeURIComponent(empresaId)}/acuerdo-comercial/historial?limit=20`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "No se pudo cargar el historial.");
      }

      setHistorial(Array.isArray(json?.items) ? json.items : []);
      setMode("historial");
    } catch (e: any) {
      setErrorMsg(e?.message || "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            setMessage(null);
            setMode(isEdit ? "edit" : "create");
          }}
          className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800"
        >
          {isEdit ? "Editar acuerdo" : "Crear acuerdo"}
        </button>

        {isEdit ? (
          <button
            type="button"
            onClick={handleDesactivar}
            disabled={loading}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-red-50 disabled:opacity-50"
          >
            Desactivar
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleHistorial}
          disabled={loading}
          className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
        >
          Ver historial
        </button>
      </div>

      {message ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      {errorMsg ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {(mode === "create" || mode === "edit") && (
        <div className="rounded-xl border p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo de acuerdo</label>
              <select
                value={tipoAcuerdo}
                onChange={(e) => setTipoAcuerdo(e.target.value as TipoAcuerdo)}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              >
                <option value="precio_fijo">Precio fijo</option>
                <option value="descuento_pct">Descuento %</option>
                <option value="precio_fijo_con_cupo">Precio fijo + cupo</option>
                <option value="descuento_con_cupo">Descuento + cupo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Modo IVA</label>
              <select
                value={modoIva}
                onChange={(e) => setModoIva(e.target.value as ModoIVA)}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              >
                <option value="sumar_al_neto">Sumar al neto</option>
                <option value="incluido_en_precio">Incluido en precio</option>
                <option value="no_aplica">No aplica</option>
              </select>
            </div>

            {visibleFields.showPrecioFijo ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Precio neto fijo</label>
                <input
                  type="number"
                  step="0.01"
                  value={precioNetoFijo}
                  onChange={(e) => setPrecioNetoFijo(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
                />
              </div>
            ) : null}

            {visibleFields.showDescuento ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Descuento %</label>
                <input
                  type="number"
                  step="0.01"
                  value={descuentoPct}
                  onChange={(e) => setDescuentoPct(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
                />
              </div>
            ) : null}

            {visibleFields.showCupo ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cupo override</label>
                <input
                  type="number"
                  step="1"
                  value={maxAsesoresOverride}
                  onChange={(e) => setMaxAsesoresOverride(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
                />
              </div>
            ) : null}

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Precio extra por asesor override
              </label>
              <input
                type="number"
                step="0.01"
                value={precioExtraPorAsesorOverride}
                onChange={(e) => setPrecioExtraPorAsesorOverride(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">IVA %</label>
              <input
                type="number"
                step="0.01"
                value={ivaPct}
                onChange={(e) => setIvaPct(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Motivo</label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear acuerdo"}
            </button>

            <button
              type="button"
              onClick={() => setMode("none")}
              className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {mode === "historial" && (
        <div className="rounded-xl border p-3">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Historial de acuerdos</h4>
            <button
              type="button"
              onClick={() => setMode("none")}
              className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Cerrar
            </button>
          </div>

          {historial.length === 0 ? (
            <div className="text-sm text-gray-500">Sin historial.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-neutral-900">
                  <tr className="text-left">
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Neto fijo</th>
                    <th className="px-3 py-2">Desc. %</th>
                    <th className="px-3 py-2">IVA</th>
                    <th className="px-3 py-2">Vigencia</th>
                    <th className="px-3 py-2">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2">
                        {item.activo ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{fmtTipoAcuerdo(item.tipo_acuerdo)}</td>
                      <td className="px-3 py-2">{fmtMoney(item.precio_neto_fijo)}</td>
                      <td className="px-3 py-2">
                        {item.descuento_pct != null ? `${item.descuento_pct}%` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {fmtModoIVA(item.modo_iva)}
                        {item.iva_pct != null ? ` (${item.iva_pct}%)` : ""}
                      </td>
                      <td className="px-3 py-2">
                        {fmtDateOnly(item.fecha_inicio)} — {fmtDateOnly(item.fecha_fin)}
                      </td>
                      <td className="px-3 py-2">{item.motivo || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
