"use client";

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { useRouter } from "next/navigation";

type Estado = "borrador" | "final";
type TipoInforme = "VAI" | "FACT";

type DatosJSON = {
  clientName?: string;
  propertyType?: string;
  // factibilidad podría tener otros campos
  nombreProyecto?: string;
  cliente?: string;
};

type Informe = {
  id: string;
  titulo: string | null;
  estado: Estado;
  created_at?: string | null;

  // metadata (opcional) que el API puede mandar plano
  autor_nombre?: string | null;
  asesor_email?: string | null;
  cliente?: string | null;
  tipologia?: string | null;

  datos_json?: DatosJSON | null;

  // NUEVO: para distinguir VAI vs FACT
  tipo_informe: TipoInforme;
};

export default function EmpresaInformesPage() {
  const router = useRouter();

  // ---------------- state ----------------
  const [items, setItems] = useState<Informe[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // filtros
  const [fAsesor, setFAsesor] = useState<string>("__ALL__");
  // Por defecto: Valuaciones (VAI)
  const [fTipoInforme, setFTipoInforme] = useState<"__ALL__" | TipoInforme>("VAI");
  const [fDesde, setFDesde] = useState<string>(""); // yyyy-mm-dd
  const [fHasta, setFHasta] = useState<string>("");
  const [q, setQ] = useState<string>(""); // búsqueda rápida

  const dq = useDeferredValue(q);
  const dAsesor = useDeferredValue(fAsesor);
  const dTipoInf = useDeferredValue(fTipoInforme);
  const dDesde = useDeferredValue(fDesde);
  const dHasta = useDeferredValue(fHasta);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ---------------- fetch unificado ----------------
  const fetchInformes = async () => {
    setLoading(true);
    setErr(null);
    try {
      let valuaciones: Informe[] = [];
      let factibilidades: Informe[] = [];

      // 1) VAI (ACM)
      try {
        const resV = await fetch("/api/informes/list?scope=empresa&limit=100", {
          cache: "no-store",
        });
        if (!resV.ok) {
          const j = await resV.json().catch(() => ({}));
          console.warn("Error cargando valuaciones:", j?.error || resV.statusText);
        } else {
          const j = await resV.json().catch(() => null as any);
          const raw = Array.isArray(j?.informes) ? j.informes : [];
          valuaciones = raw.map((r: any): Informe => ({
            id: r.id,
            titulo: r.titulo ?? null,
            estado: (r.estado as Estado) ?? "borrador",
            created_at: r.created_at ?? r.fecha_creacion ?? null,
            autor_nombre: r.autor_nombre ?? null,
            asesor_email: r.asesor_email ?? null,
            cliente:
              r.cliente ??
              r.datos_json?.clientName ??
              r.datos_json?.cliente ??
              null,
            tipologia:
              r.tipologia ??
              r.datos_json?.propertyType ??
              null,
            datos_json: r.datos_json ?? null,
            tipo_informe: "VAI",
          }));
        }
      } catch (e) {
        console.warn("Fallo fetch /api/informes/list", e);
      }

      // 2) FACT (Factibilidad)
      try {
        const resF = await fetch("/api/factibilidad/list?scope=empresa&limit=100", {
          cache: "no-store",
        });
        if (!resF.ok) {
          const j = await resF.json().catch(() => ({}));
          console.warn("Error cargando factibilidades:", j?.error || resF.statusText);
        } else {
          const j = await resF.json().catch(() => null as any);
          const raw = Array.isArray(j?.informes) ? j.informes : [];
          factibilidades = raw.map((r: any): Informe => ({
            id: r.id,
            titulo:
              r.titulo ??
              r.datos_json?.nombreProyecto ??
              "Informe de Factibilidad",
            estado: (r.estado as Estado) ?? "borrador",
            created_at: r.created_at ?? r.fecha_creacion ?? null,
            autor_nombre: r.autor_nombre ?? null,
            asesor_email: r.asesor_email ?? null,
            cliente:
              r.cliente ??
              r.datos_json?.cliente ??
              r.datos_json?.clientName ??
              null,
            // Para mostrar algo en la columna "Tipología"
            tipologia: r.tipologia ?? "Factibilidad",
            datos_json: r.datos_json ?? null,
            tipo_informe: "FACT",
          }));
        }
      } catch (e) {
        console.warn("Fallo fetch /api/factibilidad/list", e);
      }

      // 3) Fusionar
      setItems([...valuaciones, ...factibilidades]);
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
    return inf.datos_json?.clientName || inf.datos_json?.cliente || "—";
  };

  const getTipologia = (inf: Informe) => {
    if (inf.tipologia && inf.tipologia.trim()) return inf.tipologia;
    return inf.datos_json?.propertyType || "—";
  };

  const getFechaISO = (inf: Informe) => {
    if (!inf.created_at) return null;
    return new Date(inf.created_at);
  };

  // ---------------- opciones de filtros dinámicas ----------------
  const asesoresOpts = useMemo(() => {
    const s = new Set<string>();
    items.forEach((inf) => {
      const name = getCreadoPor(inf);
      if (name) s.add(name);
    });
    return ["__ALL__", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [items]);

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

      // tipo de informe (VAI / FACT / todos)
      if (dTipoInf !== "__ALL__") {
        if (inf.tipo_informe !== dTipoInf) return false;
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
    const ok = confirm("¿Eliminar este informe? Esta acción no se puede deshacer.");
    if (!ok) return;

    try {
      setDeletingId(inf.id);

      const endpoint =
        inf.tipo_informe === "FACT"
          ? `/api/factibilidad/delete?id=${encodeURIComponent(inf.id)}`
          : `/api/informes/delete?id=${encodeURIComponent(inf.id)}`;

      const res = await fetch(endpoint, {
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

  // ---------------- UI ----------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white shadow-sm rounded-xl p-6">
        <h1 className="text-xl md:text-2xl font-bold">Informes</h1>
        <p className="text-gray-600">
          Listado de informes de valuación y factibilidad cargados por tu empresa y sus asesores.
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

          {/* Tipo de informe (VAI / FACT) */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Tipo de informe</label>
            <select
              value={fTipoInforme}
              onChange={(e) => setFTipoInforme(e.target.value as any)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="VAI">Valuaciones</option>
              <option value="FACT">Factibilidad</option>
              <option value="__ALL__">Todos</option>
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
          <p className="text-gray-600">No hay informes con los filtros seleccionados.</p>
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
                  const tipoLabel =
                    inf.tipo_informe === "FACT" ? "Factibilidad" : "Valuación";

                  return (
                    <tr key={inf.id} className="border-t">
                      <td className="p-3">{tipoLabel}</td>
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
                            {deletingId === inf.id ? "Eliminando..." : "Eliminar"}
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
