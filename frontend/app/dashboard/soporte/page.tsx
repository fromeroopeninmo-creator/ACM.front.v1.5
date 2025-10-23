// frontend/app/dashboard/soporte/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import { listEmpresas, type Paged, type EmpresaListItem } from "#lib/soporteApi";
import EmpresaTable from "@/dashboard/soporte/EmpresasTable";

export const dynamic = "force-dynamic";

function buildCookieHeader(): string {
  const jar = cookies();
  const all = jar.getAll();
  if (!all?.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

export default async function SoportePage() {
  // 1) Validar sesión y rol
  const supa = supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // ⛑️ Ajuste mínimo: traigo nombre y apellido para mostrar "Soporte: …"
  const { data: profile } = await supa
    .from("profiles")
    .select("id, role, nombre, apellido")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "soporte") {
    switch (profile?.role) {
      case "empresa":
        redirect("/dashboard/empresa");
      case "asesor":
        redirect("/dashboard/asesor");
      case "super_admin":
      case "super_admin_root":
        redirect("/dashboard/admin");
      default:
        redirect("/");
    }
  }

  // 2) Primer fetch SSR de la lista (página 1)
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
          <h1 className="text-xl md:text-2xl font-semibold">Dashboard de Soporte</h1>
          <p className="text-sm text-gray-500">
            Empresas · búsqueda, filtros y acciones (auditadas)
          </p>
        </div>

        {/* Lado derecho: etiqueta de rol para Soporte */}
        <div className="text-sm text-gray-700 dark:text-gray-200">
          <span className="font-medium">Soporte:</span>{" "}
          {(profile?.nombre || "") + " " + (profile?.apellido || "")}
        </div>
      </header>

      <section className="bg-white dark:bg-neutral-900 rounded-2xl shadow p-4 md:p-5">
        <EmpresaTable initialData={initialData} />
      </section>
    </main>
  );
}
