import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  plan?: string;
  estado?: "activo" | "inactivo" | "";
  page?: string;
  pageSize?: string;
};

type EmpresaRow = {
  id: string;
  razon_social: string | null;
  cuit: string | null;
  plan_nombre: string | null;
  max_asesores: number | null;
  max_asesores_override: number | null;
  plan_activo: boolean | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  logo_url?: string | null;
  color?: string | null;

  acuerdo_comercial_activo?: boolean;
  acuerdo_comercial_id?: string | null;
  acuerdo_comercial_tipo?: string | null;
  acuerdo_comercial_modo_iva?: string | null;
  acuerdo_comercial_iva_pct?: number | null;
  acuerdo_comercial_precio_neto_fijo?: number | null;
  acuerdo_comercial_descuento_pct?: number | null;
  acuerdo_comercial_max_asesores_override?: number | null;
  acuerdo_comercial_precio_extra_por_asesor_override?: number | null;
  acuerdo_comercial_fecha_inicio?: string | null;
  acuerdo_comercial_fecha_fin?: string | null;
};

type ApiResponse = {
  items: EmpresaRow[];
  page: number;
  pageSize: number;
  total: number;
};

function fmtNumber(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR").format(n);
}

function fmtDateOnly(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString();
}

function buildCookieHeader(): string {
  const jar = cookies();
  const all = jar.getAll();
  if (!all?.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

function getBaseUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL;

  if (envUrl) {
    return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  }
  return "http://localhost:3000";
}

function buildListadoUrl(params: {
  q?: string | null;
  plan?: string | null;
  estado?: string | null;
  page: number;
  pageSize: number;
}) {
  const usp = new URLSearchParams();
  if (params.q) usp.set("q", params.q);
  if (params.plan) usp.set("plan", params.plan);
  if (params.estado) usp.set("estado", params.estado);
  usp.set("page", String(params.page));
  usp.set("pageSize", String(params.pageSize));
  return `/dashboard/admin/empresas?${usp.toString()}`;
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
      return "Acuerdo";
  }
}

function renderAcuerdoBadges(e: EmpresaRow) {
  const badges: Array<JSX.Element> = [];

  if (e.acuerdo_comercial_activo) {
    badges.push(
      <span
        key="activo"
        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-blue-100 text-blue-700"
      >
        Acuerdo activo
      </span>
    );

    if (e.acuerdo_comercial_modo_iva === "no_aplica") {
      badges.push(
        <span
          key="sin-iva"
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-purple-100 text-purple-700"
        >
          Sin IVA
        </span>
      );
    }

    if (e.acuerdo_comercial_tipo) {
      badges.push(
        <span
          key="tipo"
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-slate-100 text-slate-700"
        >
          {fmtTipoAcuerdo(e.acuerdo_comercial_tipo)}
        </span>
      );
    }

    if (
      e.acuerdo_comercial_precio_neto_fijo != null &&
      e.acuerdo_comercial_precio_neto_fijo >= 0
    ) {
      badges.push(
        <span
          key="precio-fijo"
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700"
        >
          Precio fijo
        </span>
      );
    }

    if (
      e.acuerdo_comercial_descuento_pct != null &&
      e.acuerdo_comercial_descuento_pct > 0
    ) {
      badges.push(
        <span
          key="descuento"
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"
        >
          {e.acuerdo_comercial_descuento_pct}% off
        </span>
      );
    }

    if (
      e.acuerdo_comercial_max_asesores_override != null &&
      e.acuerdo_comercial_max_asesores_override > 0
    ) {
      badges.push(
        <span
          key="cupo-especial"
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700"
        >
          Cupo especial
        </span>
      );
    }
  }

  if (badges.length === 0) {
    return <span className="text-xs text-gray-500">—</span>;
  }

  return <div className="flex flex-wrap gap-1.5">{badges}</div>;
}

export default async function AdminEmpresasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // 1) Guard de sesión + rol
  const supa = supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supa
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role || (user.user_metadata as any)?.role || null;
  const isAdmin = role === "super_admin" || role === "super_admin_root";

  if (!isAdmin) {
    switch (role) {
      case "soporte":
        redirect("/dashboard/soporte");
      case "empresa":
        redirect("/dashboard/empresa");
      case "asesor":
        redirect("/dashboard/asesor");
      default:
        redirect("/");
    }
  }

  // 2) Filtros + paginación desde URL
  const q = (searchParams.q || "").trim() || null;
  const plan = (searchParams.plan || "").trim() || null;
  const estado = (searchParams.estado || "") as "activo" | "inactivo" | "";
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const pageSize = [10, 20, 50].includes(parseInt(searchParams.pageSize || "", 10))
    ? parseInt(searchParams.pageSize!, 10)
    : 10;

  // 3) Fetch al endpoint admin/soporte enriquecido
  const cookieHeader = buildCookieHeader();
  const baseUrl = getBaseUrl();

  const apiUrl = new URL(`${baseUrl}/api/soporte/empresas`);
  if (q) apiUrl.searchParams.set("q", q);
  if (plan) apiUrl.searchParams.set("plan", plan);
  if (estado) apiUrl.searchParams.set("estado", estado);
  apiUrl.searchParams.set("page", String(page));
  apiUrl.searchParams.set("pageSize", String(pageSize));

  let items: EmpresaRow[] = [];
  let total = 0;
  let errorMsg: string | null = null;

  try {
    const res = await fetch(apiUrl.toString(), {
      method: "GET",
      headers: {
        cookie: cookieHeader,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Error al cargar empresas: ${res.status} ${res.statusText} ${body}`.trim()
      );
    }

    const json = (await res.json()) as ApiResponse;

    items = Array.isArray(json.items) ? json.items : [];
    total = Number(json.total ?? 0);
  } catch (e: any) {
    errorMsg = e?.message || "Error al cargar empresas.";
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 4) Render
  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Empresas (Administración)</h1>
          <p className="text-sm text-gray-500">
            Listado general, filtros y acceso al detalle. Incluye resumen de acuerdos comerciales activos.
          </p>
        </div>
      </header>

      {/* Filtros */}
      <section className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
        <form className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Buscar</label>
            <input
              name="q"
              defaultValue={q || ""}
              placeholder="Razón social o CUIT"
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Plan</label>
            <input
              name="plan"
              defaultValue={plan || ""}
              placeholder="Ej: Premium"
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Estado</label>
            <select
              name="estado"
              defaultValue={estado || ""}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-neutral-950"
            >
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-xl border px-4 py-2 text-sm bg-gray-50 hover:bg-gray-100"
            >
              Aplicar
            </button>
            <a
              href="/dashboard/admin/empresas"
              className="rounded-xl border px-4 py-2 text-sm bg-white hover:bg-gray-50"
            >
              Limpiar
            </a>
          </div>
        </form>
      </section>

      {/* Tabla */}
      <section className="rounded-2xl border p-0 overflow-hidden bg-white dark:bg-neutral-900">
        {errorMsg ? (
          <div className="p-4 text-red-700">{errorMsg}</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-900">
                <tr className="text-left">
                  <th className="px-3 py-2">Razón social</th>
                  <th className="px-3 py-2">CUIT</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Cupo (base → override)</th>
                  <th className="px-3 py-2">Acuerdo comercial</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Inicio</th>
                  <th className="px-3 py-2">Fin</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                      Sin resultados.
                    </td>
                  </tr>
                ) : (
                  items.map((e) => {
                    const cupoBase = e.max_asesores ?? 0;
                    const cupoOv = e.max_asesores_override ?? 0;
                    const cupo =
                      cupoOv > 0 ? `${cupoBase} → ${cupoOv}` : `${cupoBase}`;

                    return (
                      <tr key={e.id} className="border-t">
                        <td className="px-3 py-2">{e.razon_social || "—"}</td>
                        <td className="px-3 py-2">{e.cuit || "—"}</td>
                        <td className="px-3 py-2">{e.plan_nombre || "—"}</td>
                        <td className="px-3 py-2">{cupo}</td>
                        <td className="px-3 py-2">{renderAcuerdoBadges(e)}</td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              e.plan_activo
                                ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700"
                                : "inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"
                            }
                          >
                            {e.plan_activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-3 py-2">{fmtDateOnly(e.fecha_inicio)}</td>
                        <td className="px-3 py-2">{fmtDateOnly(e.fecha_fin)}</td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/dashboard/admin/empresas/${encodeURIComponent(e.id)}`}
                            className="text-blue-600 hover:underline"
                            title="Ver detalle de la empresa (vista Admin)"
                          >
                            Ver detalle
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Paginación */}
      <section className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {`Mostrando ${items.length} de ${total} • Página ${page} de ${totalPages}`}
        </p>
        <div className="flex items-center gap-2">
          <a
            href={buildListadoUrl({
              q,
              plan,
              estado,
              page: Math.max(1, page - 1),
              pageSize,
            })}
            className={`rounded-xl border px-3 py-1 text-sm ${
              page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-gray-50"
            }`}
          >
            Anterior
          </a>
          <a
            href={buildListadoUrl({
              q,
              plan,
              estado,
              page: Math.min(totalPages, page + 1),
              pageSize,
            })}
            className={`rounded-xl border px-3 py-1 text-sm ${
              page >= totalPages ? "pointer-events-none opacity-50" : "hover:bg-gray-50"
            }`}
          >
            Siguiente
          </a>
        </div>
      </section>
    </main>
  );
}
