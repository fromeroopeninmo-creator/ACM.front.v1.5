import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";

export const dynamic = "force-dynamic";

/**
 * Ruta histórica.
 *
 * El Valuador ahora vive dentro de los dashboards para quedar protegido por
 * sus layouts de autenticación y billing. Conservamos esta URL únicamente
 * como redirección segura para enlaces antiguos, favoritos e informes.
 */
export default async function LegacyACMFormsPage() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role =
    profile?.role ||
    (user.user_metadata as { role?: string } | null)?.role ||
    null;

  switch (role) {
    case "empresa":
      redirect("/dashboard/empresa/vai");
    case "asesor":
      redirect("/dashboard/asesor/vai");
    case "soporte":
      redirect("/dashboard/soporte");
    case "super_admin":
    case "super_admin_root":
      redirect("/dashboard/admin");
    default:
      redirect("/");
  }
}
