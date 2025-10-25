import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import CashflowEmpresaClient from "./CashflowEmpresaClient";

export const dynamic = "force-dynamic";

/* ===================== Helpers (igual patrón que otras pages) ===================== */
function pad2(n: number) { return String(n).padStart(2, "0"); }
function currentMonthRangeLocal(): { desde: string; hasta: string; label: string } {
  // Usamos fechas locales para alinear con el cliente
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1);
  const last  = new Date(y, m + 1, 0);
  const desde = `${first.getFullYear()}-${pad2(first.getMonth()+1)}-${pad2(first.getDate())}`;
  const hasta = `${last.getFullYear()}-${pad2(last.getMonth()+1)}-${pad2(last.getDate())}`;
  const label = `${pad2(first.getMonth()+1)}/${first.getFullYear()}`;
  return { desde, hasta, label };
}
function buildCookieHeader(): string {
  const jar = cookies();
  const all = jar.getAll();
  if (!all?.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

/* ===================== Page ===================== */
export default async function CashflowEmpresaPage({
  params,
  searchParams,
}: {
  params: { empresaId: string };
  searchParams: { desde?: string; hasta?: string };
}) {
  // 1) Guard de sesión + rol
  const supa = supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) redirect("/login");

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

  // 2) Parámetros de fecha (fallback al mes actual)
  const { desde: dDef, hasta: hDef, label } = currentMonthRangeLocal();
  const desde = (searchParams.desde || dDef)!;
  const hasta = (searchParams.hasta || hDef)!;

  // 3) Render (todo el data fetching adentro del cliente para evitar SSR digests)
  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Cashflow / Detalle de empresa</h1>
          <p className="text-sm text-gray-500">
            Período: <strong>{desde}</strong> → <strong>{hasta}</strong> (por defecto {label})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/admin/cashflow/empresas/${encodeURIComponent(params.empresaId)}/export?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800"
            title="Descargar CSV (Excel) con los movimientos del período"
          >
            Descargar CSV
          </a>
          <a
            href={`/dashboard/admin/cashflow?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800"
          >
            ← Volver al listado
          </a>
        </div>
      </header>

      <CashflowEmpresaClient
        empresaId={params.empresaId}
        initialDesde={desde}
        initialHasta={hasta}
      />
    </main>
  );
}
