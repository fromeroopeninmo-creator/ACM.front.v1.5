// frontend/app/dashboard/admin/configuracion/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import ConfiguracionAdminClient from "./ConfiguracionAdminClient";

export const dynamic = "force-dynamic";

/* ===================== Helpers (mismo patrón) ===================== */
function buildCookieHeader(): string {
  const jar = cookies();
  const all = jar.getAll();
  if (!all?.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

/* ===================== Page ===================== */
export default async function ConfiguracionAdminPage() {
  // 1) Guard de sesión + rol
  const supa = supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supa
    .from("profiles")
    .select("id, role, nombre, apellido, email, telefono, logobase64, primarycolor")
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

  // 2) Render: pasamos datos básicos al cliente (nombre/apellido/email/telefono + flags)
  const initial = {
    userId: user.id,
    role,
    isRoot: role === "super_admin_root",
    nombre: profile?.nombre ?? "",
    apellido: profile?.apellido ?? "",
    email: profile?.email ?? user.email ?? "",
    telefono: profile?.telefono ?? "",
  };

  const cookieHeader = buildCookieHeader();

  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Configuración de cuenta</h1>
          <p className="text-sm text-gray-500">
            Editá tus datos personales, cambiá email/contraseña y foto de perfil.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border p-0 bg-white dark:bg-neutral-900 overflow-hidden">
        <ConfiguracionAdminClient initial={initial} cookieHeader={cookieHeader} />
      </section>
    </main>
  );
}
