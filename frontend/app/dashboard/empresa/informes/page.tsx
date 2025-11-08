"use client";

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { useRouter } from "next/navigation";

type Estado = "borrador" | "final";

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

  // metadata que puede o no venir plana desde el API:
  autor_nombre?: string | null; // ideal si el API lo envía
  asesor_email?: string | null; // fallback
  cliente?: string | null; // si lo expone el API
  tipologia?: string | null; // si lo expone el API

  // fallback si el API no expone campos planos:
  datos_json?: DatosJSON | null;

  // NUEVO: tipo de informe si el backend lo envía
  tipo_informe?: "valuacion" | "factibilidad" | null;
};

export default function EmpresaInformesPage() {
  const router = useRouter();

  // ---------------- state ----------------
  const [items, setItems] = useState<Informe[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // filtros
  const [fAsesor, setFAsesor] = useState<string>("__ALL__");
  // 🔹 ahora este filtro es "Tipo de informe"
  const [fTipo, setFTipo] = useState<string>("valuacion"); // default: Valuaciones
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
      const res = await fetch("/api/informes/list?scope=empresa&limit=100", {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Error cargando informes");
      }
      const j = await res.json();
      const arr: Informe[] = Array.isArray(j?.informes) ? j.informes : [];
      setItems(arr);
    } catch (e: any) {
      setErr(e.message || "Error desconocido");
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

  // 🔹 NUEVO: tipo de informe (valuación vs factibilidad)
  const getTipoInforme = (inf: Informe): "valuacion" | "factibilidad" => {
    if (inf.tipo_informe === "factibilidad") return "factibilidad";
    if (inf.tipo_informe === "valuacion") return "valuacion";

    // fallback heurístico por título
    const titulo = (inf.titulo || "").toLowerCase();
    if (titulo.includes("factibilidad")) return "factibilidad";

    // fallback por estructura de datos_json (si el API no mandara tipo_informe)
    const dj: any = inf.datos_json || {};
    if (
      dj.FOS !== undefined ||
      dj.FOT !== undefined ||
      dj.superficieLote !== undefined
    ) {
      return "factibilidad";
    }

    // por defecto, lo tratamos como valuación
    return "valuacion";
  };

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

  // 🔹 Tipos de informe: fijo (Valuaciones / Factibilidad / Todos)
  const tiposOpts = useMemo(
    () => ["__ALL__", "valuacion", "factibilidad"],
    []
  );

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

      // tipo de informe (valuación / factibilidad)
      if (dTipo !== "__ALL__") {
        const tipoInf = getTipoInforme(inf);
        if (dTipo === "valuacion" && tipoInf !== "valuacion") return false;
        if (dTipo === "factibilidad" && tipoInf !== "factibilidad") return false;
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
  const onDelete = async (id: string) => {
    if (!id) return;
    const ok = confirm("¿Eliminar este informe? Esta acción no se puede deshacer.");
    if (!ok) return;

    try {
      setDeletingId(id);
      const res = await fetch(`/api/informes/delete?id=${encodeURIComponent(id)}`, {
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

  // 🔹 Ver/Editar según tipo de informe
  const onView = (inf: Informe) => {
    const tipo = getTipoInforme(inf);
    if (tipo === "factibilidad") {
      router.push(`/vai/factibilidad?id=${inf.id}`);
    } else {
      router.push(`/vai/acmforms?id=${inf.id}`);
    }
  };

  // ---------------- UI ----------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white shadow-sm rounded-xl p-6">
        <h1 className="text-xl md:text-2xl font-bold">Informes</h1>
        <p className="text-gray-600">
          Listado de informes cargados por tu empresa y sus asesores.
        </p>
      </section>

      {/* Filtros */}
      <section className="bg-white shadow-sm rounded-xl p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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

          {/* Tipo de informe (Valuaciones / Factibilidad) */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Tipo</label>
            <select
              value={fTipo}
              onChange={(e) => setFTipo(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              {tiposOpts.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "__ALL__"
                    ? "Todos"
                    : opt === "valuacion"
                    ? "Valuaciones"
                    : "Factibilidad"}
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
                      <td className="p-3">{creadoPor}</td>
                      <td className="p-3">{cliente}</td>
                      <td className="p-3">{tipologia}</td>
                      <td className="p-3">{fechaTxt}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => onView(inf)}
                            className="px-3 py-1 text-sm rounded bg-gray-100 text-gray-800 hover:bg-gray-200"
                          >
                            Ver/Editar
                          </button>

                          <button
                            onClick={() => onDelete(inf.id)}
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
