"use client";

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { useRouter } from "next/navigation";

type Estado = "borrador" | "final";
type TipoInforme = "VAI" | "FACT";

type DatosJSON = {
  clientName?: string;
  propertyType?: string;
  // otros campos que no usamos acá...
};

type Informe = {
  id: string;
  titulo: string | null;
  estado: Estado;
  created_at?: string | null;

  // tipo de informe (valuación / factibilidad)
  tipo_informe: TipoInforme;

  // metadata que puede o no venir plana desde el API:
  autor_nombre?: string | null; // ideal si el API lo envía
  asesor_email?: string | null; // fallback
  cliente?: string | null; // si lo expone el API
  tipologia?: string | null; // si lo expone el API (tipo propiedad)

  // fallback si el API no expone campos planos:
  datos_json?: DatosJSON | null;
};

export default function EmpresaInformesPage() {
  const router = useRouter();

  // ---------------- state ----------------
  const [items, setItems] = useState<Informe[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // filtros
  const [fAsesor, setFAsesor] = useState<string>("__ALL__");
  const [fTipoInf, setFTipoInf] = useState<"__ALL__" | TipoInforme>("VAI"); // por defecto: Valuaciones
  const [fDesde, setFDesde] = useState<string>(""); // yyyy-mm-dd
  const [fHasta, setFHasta] = useState<string>("");
  const [q, setQ] = useState<string>(""); // búsqueda rápida

  // Para que escribir en filtros no congele la UI en listas grandes
  const dq = useDeferredValue(q);
  const dAsesor = useDeferredValue(fAsesor);
  const dTipoInf = useDeferredValue(fTipoInf);
  const dDesde = useDeferredValue(fDesde);
  const dHasta = useDeferredValue(fHasta);

  // eliminación
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ---------------- helpers de visualización ----------------
  const getCreadoPor = (inf: Informe) => {
    if (inf.autor_nombre && inf.autor_nombre.trim()) return inf.autor_nombre;
    if (inf.asesor_email && inf.asesor_email.trim()) return inf.asesor_email;
    return "Empresa";
  };

  const getCliente = (inf: Informe) => {
    if (inf.cliente && inf.cliente.trim()) return inf.cliente;
    return inf.datos_json?.clientName || "—";
  };

  const getTipologia = (inf: Informe) => {
    if (inf.tipologia && inf.tipologia.trim()) return inf.tipologia;
    return inf.datos_json?.propertyType || "—";
  };

  const getFechaISO = (inf: Informe) => {
    if (!inf.created_at) return null;
    return new Date(inf.created_at);
  };

  // ---------------- fetch combinado ----------------
  const fetchInformes = async () => {
    setLoading(true);
    setErr(null);
    try {
      // 1) Valuaciones (informes VAI)
      const resV = await fetch(
        "/api/informes/list?scope=empresa&limit=100",
        { cache: "no-store" }
      );
      if (!resV.ok) {
        const j = await resV.json().catch(() => ({}));
        throw new Error(j?.error || "Error cargando informes VAI");
      }
      const jV = await resV.json();

      const valRaw: any[] = Array.isArray(jV?.informes) ? jV.informes : [];

      const valuaciones: Informe[] = valRaw.map((inf: any) => ({
        id: inf.id,
        titulo: inf.titulo ?? "Informe VAI",
        estado: (inf.estado as Estado) || "borrador",
        created_at: inf.created_at ?? inf.fecha_creacion ?? null,

        tipo_informe: "VAI",

        autor_nombre: inf.autor_nombre ?? null,
        asesor_email: inf.asesor_email ?? null,
        cliente:
          inf.cliente ??
          inf.datos_json?.clientName ??
          null,
        tipologia:
          inf.tipologia ??
          inf.datos_json?.propertyType ??
          null,
        datos_json: inf.datos_json ?? null,
      }));

      // 2) Factibilidad
      const resF = await fetch(
        "/api/factibilidad/list?scope=empresa&limit=100",
        { cache: "no-store" }
      );
      if (!resF.ok) {
        const j = await resF.json().catch(() => ({}));
        throw new Error(
          j?.error || "Error cargando informes de factibilidad"
        );
      }
      const jF = await resF.json();

      const facRaw: any[] = Array.isArray(jF?.informes) ? jF.informes : [];

      const factibilidades: Informe[] = facRaw.map((inf: any) => ({
        id: inf.id,
        titulo: inf.titulo ?? "Informe de Factibilidad",
        estado: (inf.estado as Estado) || "borrador",
        created_at: inf.created_at ?? inf.fecha_creacion ?? null,

        tipo_informe: "FACT",

        autor_nombre: inf.autor_nombre ?? null,
        asesor_email: inf.asesor_email ?? null,
        cliente:
          inf.cliente ??
          inf.datos_json?.clientName ??
          null,
        tipologia:
          inf.tipologia ??
          inf.datos_json?.propertyType ??
          null,
        datos_json: inf.datos_json ?? null,
      }));

      // 3) Fusionar
      setItems([...valuaciones, ...factibilidades]);
    } catch (e: any) {
      setErr(e.message || "Error desconocido");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInformes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- opciones de filtros dinámicas ----------------
  const asesoresOpts = useMemo(() => {
    const s = new Set<string>();
    items.forEach((inf) => {
      const name = getCreadoPor(inf);
      if (name) s.add(name);
    });
    return ["__ALL__", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // ---------------- filtrado cliente ----------------
  const filtered = useMemo(() => {
    const desde = dDesde ? new Date(`${dDesde}T00:00:00`) : null;
    const hasta = dHasta ? new Date(`${dHasta}T23:59:59`) : null;
    const qnorm = dq.trim().toLowerCase();

    return items.filter((inf) => {
      // Tipo de informe (Valuaciones / Factibilidad / Todos)
      if (dTipoInf !== "__ALL__" && inf.tipo_informe !== dTipoInf) {
        return false;
      }

      // asesor
      if (dAsesor !== "__ALL__") {
        if (getCreadoPor(inf) !== dAsesor) return false;
      }

      // fechas
      if (desde || hasta) {
        const dt = getFechaISO(inf);
        if (!dt) return false;
        if (desde && dt < desde) return false;
        if (hasta && dt > hasta) return false;
      }

      // búsqueda rápida
      if (qnorm) {
        const hay =
          (getCreadoPor(inf) || "").toLowerCase().includes(qnorm) ||
          (getCliente(inf) || "").toLowerCase().includes(qnorm) ||
          (getTipologia(inf) || "").toLowerCase().includes(qnorm) ||
          (inf.titulo || "").toLowerCase().includes(qnorm);
        if (!hay) return false;
      }
      return true;
    });
  }, [items, dAsesor, dTipoInf, dDesde, dHasta, dq]);

  // orden por fecha desc
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const da = getFechaISO(a)?.getTime() ?? 0;
      const db = getFechaISO(b)?.getTime() ?? 0;
      return db - da;
    });
  }, [filtered]);

  // ---------------- acciones ----------------
  const onDelete = async (inf: Informe) => {
    if (!inf.id) return;
    const ok = confirm(
      "¿Eliminar este informe? Esta acción no se puede deshacer."
    );
    if (!ok) return;

    try {
      setDeletingId(inf.id);

      const url =
        inf.tipo_informe === "FACT"
          ? `/api/factibilidad/delete?id=${encodeURIComponent(inf.id)}`
          : `/api/informes/delete?id=${encodeURIComponent(inf.id)}`;

      const res = await fetch(url, {
        method: "DELETE",
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "No se pudo eliminar");
      }
      await fetchInformes();
    } catch (e: any) {
      alert(e?.message || "Error eliminando");
    } finally {
      setDeletingId(null);
    }
  };

  const onVerEditar = (inf: Informe) => {
    if (inf.tipo_informe === "FACT") {
      router.push(`/dashboard/empresa/factibilidad?id=${inf.id}`);
    } else {
      router.push(`/vai/acmforms?id=${inf.id}`);
    }
  };

  const labelTipoInforme = (ti: TipoInforme) =>
    ti === "VAI" ? "Valuación" : "Factibilidad";

  // ---------------- UI ----------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white shadow-sm rounded-xl p-6">
        <h1 className="text-xl md:text-2xl font-bold">Informes</h1>
        <p className="text-gray-600">
          Listado de informes de valuación (VAI) y factibilidad cargados por tu
          empresa y sus asesores.
        </p>
      </section>

      {/* Filtros */}
      <section className="bg-white shadow-sm rounded-xl p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Tipo de informe */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">
              Tipo de informe
            </label>
            <select
              value={fTipoInf}
              onChange={(e) =>
                setFTipoInf(e.target.value as "__ALL__" | TipoInforme)
              }
              className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="VAI">Valuaciones</option>
              <option value="FACT">Factibilidad</option>
              <option value="__ALL__">Todos</option>
            </select>
          </div>

          {/* Asesor / Creado por */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Creado por</label>
            <select
              value={fAsesor}
              onChange={(e) => setFAsesor(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              {asesoresOpts.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "__ALL__" ? "Todos" : opt}
                </option>
              ))}
            </select>
          </div>

          {/* Desde */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Desde</label>
            <input
              type="date"
              value={fDesde}
              onChange={(e) => setFDesde(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            />
          </div>

          {/* Hasta */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Hasta</label>
            <input
              type="date"
              value={fHasta}
              onChange={(e) => setFHasta(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            />
          </div>

          {/* Búsqueda rápida */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Buscar</label>
            <input
              type="text"
              placeholder="Cliente, asesor, tipología, título…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      {/* Tabla */}
      <section className="bg-white shadow-sm rounded-xl p-4 md:p-6">
        {loading ? (
          <p className="text-gray-500">Cargando…</p>
        ) : err ? (
          <p className="text-red-600">❌ {err}</p>
        ) : sorted.length === 0 ? (
          <p className="text-gray-600">
            No hay informes con los filtros seleccionados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded-lg">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Tipo</th>
                  <th className="p-3 text-left">Creado por</th>
                  <th className="p-3 text-left">Cliente</th>
                  <th className="p-3 text-left">Tipología</th>
                  <th className="p-3 text-left">Fecha</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((inf) => {
                  const creadoPor = getCreadoPor(inf);
                  const cliente = getCliente(inf);
                  const tipologia = getTipologia(inf);
                  const fechaTxt = inf.created_at
                    ? new Date(inf.created_at).toLocaleString("es-AR")
                    : "—";

                  return (
                    <tr key={inf.id} className="border-t">
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {labelTipoInforme(inf.tipo_informe)}
                        </span>
                      </td>
                      <td className="p-3">{creadoPor}</td>
                      <td className="p-3">{cliente}</td>
                      <td className="p-3">{tipologia}</td>
                      <td className="p-3">{fechaTxt}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => onVerEditar(inf)}
                            className="px-3 py-1 text-sm rounded bg-gray-100 text-gray-800 hover:bg-gray-200"
                          >
                            Ver/Editar
                          </button>

                          <button
                            onClick={() => onDelete(inf)}
                            disabled={deletingId === inf.id}
                            className="px-3 py-1 text-sm rounded bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 disabled:opacity-60"
                            title="Eliminar"
                          >
                            {deletingId === inf.id
                              ? "Eliminando..."
                              : "Eliminar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* <div className="text-xs text-gray-500 mt-2">Mostrando {sorted.length} informes</div> */}
          </div>
        )}
      </section>
    </div>
  );
}
