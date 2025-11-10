"use client";

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Estado = "borrador" | "final";
type TipoInforme = "VAI" | "FACT";

type DatosJSON = {
  clientName?: string;
  propertyType?: string;
  // en factibilidad podrías tener otros campos, pero no los usamos acá
};

type Informe = {
  id: string;
  titulo: string | null;
  estado: Estado;
  created_at?: string | null;

  // JSON embebido
  datos_json?: DatosJSON | null;

  // metadatos planos opcionales
  cliente?: string | null;
  tipologia?: string | null;

  // tipo de informe: VAI (valuación) o FACT (factibilidad)
  tipo_informe?: TipoInforme | null;
};

export default function AsesorInformesPage() {
  const router = useRouter();

  // ---------- state ----------
  const [items, setItems] = useState<Informe[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // filtros
  // 🔹 Tipo global: Valuaciones / Factibilidad / Todos
  const [fTipoInforme, setFTipoInforme] = useState<string>("VAI"); // por defecto VAI
  const [fDesde, setFDesde] = useState<string>(""); // yyyy-mm-dd
  const [fHasta, setFHasta] = useState<string>("");
  const [q, setQ] = useState<string>(""); // búsqueda rápida

  // para que escribir en filtros no congele en listas grandes
  const dq = useDeferredValue(q);
  const dTipoInforme = useDeferredValue(fTipoInforme);
  const dDesde = useDeferredValue(fDesde);
  const dHasta = useDeferredValue(fHasta);

  // eliminar
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ---------- fetch ----------
  const fetchInformes = async () => {
    setLoading(true);
    setErr(null);
    try {
      // 1) Valuaciones (VAI)
      const resV = await fetch("/api/informes/list?scope=asesor&limit=100", {
        cache: "no-store",
      });
      if (!resV.ok) {
        const j = await resV.json().catch(() => ({}));
        throw new Error(j?.error || "Error cargando informes de valuación");
      }
      const jV = await resV.json();
      const arrVRaw: any[] = Array.isArray(jV?.informes)
        ? jV.informes
        : jV?.items || [];

      const valuaciones: Informe[] = arrVRaw.map((inf: any) => ({
        id: inf.id,
        titulo: inf.titulo ?? "Informe VAI",
        estado: (inf.estado as Estado) || "borrador",
        created_at: inf.created_at ?? inf.fecha_creacion ?? null,
        datos_json: inf.datos_json ?? null,
        cliente:
          inf.cliente ??
          inf.datos_json?.clientName ??
          inf.datos_json?.cliente ??
          null,
        tipologia:
          inf.tipologia ??
          inf.datos_json?.propertyType ??
          inf.datos_json?.tipologia ??
          null,
        tipo_informe: "VAI",
      }));

      // 2) Factibilidades (FACT)
      let factibilidades: Informe[] = [];
      try {
        const resF = await fetch(
          "/api/factibilidad/list?scope=asesor&limit=100",
          { cache: "no-store" }
        );
        if (resF.ok) {
          const jF = await resF.json();
          const arrFRaw: any[] = Array.isArray(jF?.informes)
            ? jF.informes
            : [];

          factibilidades = arrFRaw.map((f: any) => {
            const dj = f.datos_json ?? null;

            return {
              id: f.id,
              titulo:
                f.titulo ||
                dj?.titulo ||
                "Informe de Factibilidad Constructiva",
              estado: "borrador" as Estado, // no tenemos columna estado en factibilidad
              created_at: f.created_at ?? null,
              datos_json: dj,
              // por ahora no tenemos cliente directo, lo dejamos en "—" en UI
              cliente: null,
              // usamos zona como pseudo tipología, si querés mostrar algo
              tipologia: dj?.zona ?? f.zona ?? null,
              tipo_informe: "FACT",
            };
          });
        }
      } catch (e) {
        console.warn("No se pudieron cargar factibilidades:", e);
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

  // ---------- helpers de visualización ----------
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

  // ---------- filtrado ----------
  const filtered = useMemo(() => {
    const desde = dDesde ? new Date(`${dDesde}T00:00:00`) : null;
    const hasta = dHasta ? new Date(`${dHasta}T23:59:59`) : null;

    const qnorm = dq.trim().toLowerCase();

    return items.filter((inf) => {
      // Tipo global: Valuaciones / Factibilidad / Todos
      if (dTipoInforme !== "__ALL__") {
        const t: string = inf.tipo_informe || "VAI";
        if (t !== dTipoInforme) return false;
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
          (getCliente(inf) || "").toLowerCase().includes(qnorm) ||
          (getTipologia(inf) || "").toLowerCase().includes(qnorm) ||
          (inf.titulo || "").toLowerCase().includes(qnorm);
        if (!hay) return false;
      }
      return true;
    });
  }, [items, dTipoInforme, dDesde, dHasta, dq]);

  // orden por fecha desc
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const da = getFechaISO(a)?.getTime() ?? 0;
      const db = getFechaISO(b)?.getTime() ?? 0;
      return db - da;
    });
  }, [filtered]);

  // ---------- acciones ----------
  const onDelete = async (inf: Informe) => {
    if (!inf.id) return;
    const ok = confirm("¿Eliminar este informe? Esta acción no se puede deshacer.");
    if (!ok) return;

    try {
      setDeletingId(inf.id);

      const isFact = inf.tipo_informe === "FACT";
      const url = isFact
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

  const goToEdit = (inf: Informe) => {
    if (inf.tipo_informe === "FACT") {
      router.push(`/vai/factibilidad?id=${inf.id}`);
    } else {
      router.push(`/vai/acmforms?id=${inf.id}`);
    }
  };

  // ---------- UI ----------
  return (
    <div className="space-y-6">
      {/* Header + CTA */}
      <section className="bg-white shadow-sm rounded-xl p-6 flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold">Informes</h1>
        <Link
          href="/vai/acmforms"
          className="px-6 py-3 text-white font-semibold rounded-lg shadow transition text-center bg-blue-600 hover:bg-blue-700"
        >
          ➕ Nuevo Informe de Valuación
        </Link>
      </section>

      {/* Filtros */}
      <section className="bg-white shadow-sm rounded-xl p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Tipo de informe */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Tipo</label>
            <select
              value={fTipoInforme}
              onChange={(e) => setFTipoInforme(e.target.value)}
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
              placeholder="Cliente, tipología, título…"
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
                  <th className="p-3 text-left">Cliente</th>
                  <th className="p-3 text-left">Tipología</th>
                  <th className="p-3 text-left">Fecha</th>
                  <th className="p-3 text-left">Tipo</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((inf) => {
                  const cliente = getCliente(inf);
                  const tipologia = getTipologia(inf);
                  const fechaTxt = inf.created_at
                    ? new Date(inf.created_at).toLocaleString("es-AR")
                    : "—";
                  const tipoLabel =
                    inf.tipo_informe === "FACT" ? "Factibilidad" : "Valuación";

                  return (
                    <tr key={inf.id} className="border-t">
                      <td className="p-3">{cliente}</td>
                      <td className="p-3">{tipologia}</td>
                      <td className="p-3">{fechaTxt}</td>
                      <td className="p-3">{tipoLabel}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => goToEdit(inf)}
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
                            {deletingId === inf.id ? "Eliminando…" : "Eliminar"}
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
