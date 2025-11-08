"use client";

import {
  useEffect,
  useMemo,
  useState,
  useDeferredValue,
} from "react";
import { useRouter } from "next/navigation";

type Estado = "borrador" | "final";
type TipoInforme = "valuacion" | "factibilidad";

type DatosJSON = {
  clientName?: string;
  propertyType?: string;
  nombreProyecto?: string;
  // otros campos posibles que no usamos acá...
};

type Informe = {
  id: string;
  titulo: string | null;
  estado: Estado;
  tipo_informe: TipoInforme | null;
  created_at?: string | null;

  autor_nombre?: string | null;
  asesor_email?: string | null;
  cliente?: string | null;
  tipologia?: string | null;

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
  // ahora este es el filtro de TIPO DE INFORME: valuacion / factibilidad
  const [fTipo, setFTipo] = useState<string>("valuacion"); // por defecto Valuaciones
  const [fDesde, setFDesde] = useState<string>(""); // yyyy-mm-dd
  const [fHasta, setFHasta] = useState<string>("");
  const [q, setQ] = useState<string>(""); // búsqueda rápida

  // Para que escribir en filtros no congele la UI en listas grandes
  const dq = useDeferredValue(q);
  const dAsesor = useDeferredValue(fAsesor);
  const dTipo = useDeferredValue(fTipo);
  const dDesde = useDeferredValue(fDesde);
  const dHasta = useDeferredValue(fHasta);

  // eliminación
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ---------------- fetch ----------------
  const fetchInformes = async () => {
    setLoading(true);
    setErr(null);
    try {
      // 1) Informes de VALUACIÓN (VAI clásicos)
      const resV = await fetch(
        "/api/informes/list?scope=empresa&limit=100",
        { cache: "no-store" }
      );
      if (!resV.ok) {
        const j = await resV.json().catch(() => ({}));
        throw new Error(
          j?.error || "Error cargando informes de valuación"
        );
      }
      const jV = await resV.json();
      const arrVRaw: any[] = Array.isArray(jV?.informes)
        ? jV.informes
        : [];

      const valuaciones: Informe[] = arrVRaw.map((inf: any): Informe => ({
        id: inf.id,
        titulo: inf.titulo ?? null,
        estado: (inf.estado as Estado) ?? "final",
        tipo_informe: "valuacion",
        created_at: inf.created_at ?? null,
        autor_nombre: inf.autor_nombre ?? null,
        asesor_email: inf.asesor_email ?? null,
        cliente: inf.cliente ?? null,
        tipologia:
          inf.tipologia ??
          inf.datos_json?.propertyType ??
          null,
        datos_json: (inf.datos_json as DatosJSON) ?? null,
      }));

      // 2) Informes de FACTIBILIDAD
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
      const arrFRaw: any[] = Array.isArray(jF?.informes)
        ? jF.informes
        : [];

      const factibilidades: Informe[] = arrFRaw.map(
        (inf: any): Informe => ({
          id: inf.id,
          titulo:
            inf.titulo ??
            "Informe de factibilidad constructiva",
          estado: (inf.estado as Estado) ?? "final",
          tipo_informe: "factibilidad",
          created_at: inf.created_at ?? null,
          autor_nombre: inf.autor_nombre ?? null,
          asesor_email: inf.asesor_email ?? null,
          cliente: inf.cliente ?? null,
          tipologia: inf.tipologia ?? null,
          datos_json: (inf.datos_json as DatosJSON) ?? null,
        })
      );

      // 3) Fusionar
      setItems([...valuaciones, ...factibilidades]);
    } catch (e: any) {
      setErr(e?.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInformes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- helpers de visualización ----------------
  const getCreadoPor = (inf: Informe) => {
    if (inf.autor_nombre && inf.autor_nombre.trim())
      return inf.autor_nombre;
    if (inf.asesor_email && inf.asesor_email.trim())
      return inf.asesor_email;
    return "Empresa";
  };

  const getCliente = (inf: Informe) => {
    if (inf.cliente && inf.cliente.trim()) return inf.cliente;
    return inf.datos_json?.clientName || "—";
  };

  const getTipoEtiqueta = (inf: Informe) => {
    if (inf.tipo_informe === "factibilidad")
      return "Factibilidad";
    return "Valuación VAI";
  };

  const getFechaISO = (inf: Informe) => {
    if (!inf.created_at) return null;
    return new Date(inf.created_at);
  };

  const getRutaVerEditar = (inf: Informe) => {
    if (inf.tipo_informe === "factibilidad") {
      return `/vai/factibilidad?id=${encodeURIComponent(
        inf.id
      )}`;
    }
    // default: valuación
    return `/vai/acmforms?id=${encodeURIComponent(inf.id)}`;
  };

  // ---------------- opciones de filtros dinámicas ----------------
  const asesoresOpts = useMemo(() => {
    const s = new Set<string>();
    items.forEach((inf) => {
      const name = getCreadoPor(inf);
      if (name) s.add(name);
    });
    return [
      "__ALL__",
      ...Array.from(s).sort((a, b) => a.localeCompare(b)),
    ];
  }, [items]);

  // Tipo de informe: fijo
  const tiposOpts: string[] = [
    "__ALL__",
    "valuacion",
    "factibilidad",
  ];

  const tipoLabel = (v: string) => {
    if (v === "valuacion") return "Valuaciones";
    if (v === "factibilidad") return "Factibilidad";
    return "Todos";
  };

  // ---------------- filtrado cliente ----------------
  const filtered = useMemo(() => {
    const desde = dDesde ? new Date(`${dDesde}T00:00:00`) : null;
    const hasta = dHasta ? new Date(`${dHasta}T23:59:59`) : null;
    const qnorm = dq.trim().toLowerCase();

    return items.filter((inf) => {
      // asesor
      if (dAsesor !== "__ALL__") {
        if (getCreadoPor(inf) !== dAsesor) return false;
      }
      // tipo de informe
      if (dTipo !== "__ALL__") {
        if (inf.tipo_informe !== dTipo) return false;
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
        const tipoTxt = getTipoEtiqueta(inf).toLowerCase();
        const hay =
          (getCreadoPor(inf) || "")
            .toLowerCase()
            .includes(qnorm) ||
          (getCliente(inf) || "")
            .toLowerCase()
            .includes(qnorm) ||
          tipoTxt.includes(qnorm) ||
          (inf.titulo || "")
            .toLowerCase()
            .includes(qnorm);
        if (!hay) return false;
      }
      return true;
    });
  }, [items, dAsesor, dTipo, dDesde, dHasta, dq]);

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
    if (!inf?.id) return;
    const ok = confirm(
      "¿Eliminar este informe? Esta acción no se puede deshacer."
    );
    if (!ok) return;

    // endpoint según tipo
    const endpoint =
      inf.tipo_informe === "factibilidad"
        ? "/api/factibilidad/delete"
        : "/api/informes/delete";

    try {
      setDeletingId(inf.id);
      const res = await fetch(
        `${endpoint}?id=${encodeURIComponent(inf.id)}`,
        {
          method: "DELETE",
        }
      );
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

  // ---------------- UI ----------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white shadow-sm rounded-xl p-6">
        <h1 className="text-xl md:text-2xl font-bold">
          Informes
        </h1>
        <p className="text-gray-600">
          Listado de informes de Valuación VAI y Factibilidad
          Constructiva cargados por tu empresa y sus asesores.
        </p>
      </section>

      {/* Filtros */}
      <section className="bg-white shadow-sm rounded-xl p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Asesor / Creado por */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">
              Creado por
            </label>
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

          {/* Tipo de informe */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">
              Tipo
            </label>
            <select
              value={fTipo}
              onChange={(e) => setFTipo(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              {tiposOpts.map((opt) => (
                <option key={opt} value={opt}>
                  {tipoLabel(opt)}
                </option>
              ))}
            </select>
          </div>

          {/* Desde */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">
              Desde
            </label>
            <input
              type="date"
              value={fDesde}
              onChange={(e) => setFDesde(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            />
          </div>

          {/* Hasta */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={fHasta}
              onChange={(e) => setFHasta(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            />
          </div>

          {/* Búsqueda rápida */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Cliente, asesor, tipo, título…"
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
                  <th className="p-3 text-left">Creado por</th>
                  <th className="p-3 text-left">Cliente</th>
                  <th className="p-3 text-left">Tipo</th>
                  <th className="p-3 text-left">Fecha</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((inf) => {
                  const creadoPor = getCreadoPor(inf);
                  const cliente = getCliente(inf);
                  const tipo = getTipoEtiqueta(inf);
                  const fechaTxt = inf.created_at
                    ? new Date(
                        inf.created_at
                      ).toLocaleString("es-AR")
                    : "—";

                  return (
                    <tr
                      key={inf.id}
                      className="border-t"
                    >
                      <td className="p-3">
                        {creadoPor}
                      </td>
                      <td className="p-3">
                        {cliente}
                      </td>
                      <td className="p-3">
                        {tipo}
                      </td>
                      <td className="p-3">
                        {fechaTxt}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() =>
                              router.push(
                                getRutaVerEditar(inf)
                              )
                            }
                            className="px-3 py-1 text-sm rounded bg-gray-100 text-gray-800 hover:bg-gray-200"
                          >
                            Ver/Editar
                          </button>

                          <button
                            onClick={() =>
                              onDelete(inf)
                            }
                            disabled={
                              deletingId === inf.id
                            }
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
