// frontend/app/dashboard/soporte/logs/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function SoporteLogsPage() {
  // Guard de sesión + rol (mismo criterio que el resto del módulo)
  const supa = supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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

  // Placeholder MVP sin llamados a /api — Sólo para que el link del sidebar funcione.
  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Registro (Soporte)</h1>
          <p className="text-sm text-gray-500">
            Bitácora y auditoría centralizada — próximamente.
          </p>
        </div>
        <a
          href="/dashboard/soporte"
          className="text-sm px-3 py-2 rounded-xl border hover:bg-gray-50 dark:hover:bg-neutral-800"
        >
          ← Volver
        </a>
      </header>

      <section className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Esta vista mostrará el historial global de acciones de soporte (todas las
          empresas), con filtros por fecha, soporte y tipo de acción.
        </p>
        <ul className="list-disc pl-5 mt-2 text-sm text-gray-600 dark:text-gray-300">
          <li>Filtro por rango de fechas</li>
          <li>Filtro por agente de soporte</li>
          <li>Filtro por tipo de acción</li>
          <li>Paginación y exportación (CSV)</li>
        </ul>
      </section>
    </main>
  );
}
