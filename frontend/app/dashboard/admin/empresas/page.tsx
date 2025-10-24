// app/dashboard/admin/empresas/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import { listEmpresas, type Paged, type EmpresaListItem } from "#lib/soporteApi";
import EmpresasTable from "@/dashboard/soporte/EmpresasTable";

export const dynamic = "force-dynamic";

function buildCookieHeader(): string {
  const jar = cookies();
  const all = jar.getAll();
  if (!all?.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

export default async function AdminEmpresasPage() {
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

  // 2) Primer fetch SSR (misma API que Soporte; Admin también está autorizado)
  const cookieHeader = buildCookieHeader();
  const initialData: Paged<EmpresaListItem> = await listEmpresas(
    { page: 1, pageSize: 10, estado: "todos" },
    { headers: { cookie: cookieHeader } }
  );

  // 3) Render
  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Empresas (Administración)</h1>
          <p className="text-sm text-gray-500">
            Lista de empresas con filtros, búsqueda y acceso a detalle.
          </p>
        </div>
      </header>

      <section className="bg-white dark:bg-neutral-900 rounded-2xl shadow p-4 md:p-5">
        <EmpresasTable initialData={initialData} />
      </section>
    </main>
  );
}
