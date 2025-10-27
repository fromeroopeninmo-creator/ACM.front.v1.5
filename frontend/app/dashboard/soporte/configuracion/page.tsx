import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function SoporteConfigPage() {
  // Guard de sesión + rol
  const supa = supabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supa
    .from("profiles")
    .select("id, role, nombre, apellido, email")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role || (user.user_metadata as any)?.role || null;
  const isSoporte = role === "soporte" || role === "super_admin" || role === "super_admin_root";
  if (!isSoporte) {
    switch (role) {
      case "empresa": redirect("/dashboard/empresa");
      case "asesor" : redirect("/dashboard/asesor");
      default: redirect("/");
    }
  }

  // Render placeholder (evita 404 y permite seguir)
  return (
    <main className="p-4 md:p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl md:text-2xl font-semibold">Configuración (Soporte)</h1>
        <p className="text-sm text-gray-500">
          Ajustes de tu cuenta de soporte. Próximamente: Perfil, Seguridad, Avatar y Preferencias.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
          <h2 className="text-base font-semibold">Perfil</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            {profile?.nombre || "—"} {profile?.apellido || ""} · {profile?.email || user.email}
          </p>
          <p className="text-xs text-gray-500 mt-2">Formulario de edición próximamente.</p>
        </div>

        <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
          <h2 className="text-base font-semibold">Seguridad</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Cambio de email / contraseña desde esta sección.
          </p>
          <p className="text-xs text-gray-500 mt-2">Acciones disponibles en la siguiente iteración.</p>
        </div>

        <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
          <h2 className="text-base font-semibold">Avatar</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Sube tu foto de perfil al bucket <code>avatars</code>.
          </p>
          <p className="text-xs text-gray-500 mt-2">Uploader en preparación.</p>
        </div>

        <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
          <h2 className="text-base font-semibold">Preferencias</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Idioma, tema y notificaciones.
          </p>
          <p className="text-xs text-gray-500 mt-2">Disponible pronto.</p>
        </div>
      </section>
    </main>
  );
}
