// frontend/app/dashboard/soporte/empresas/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function SoporteEmpresasAliasPage() {
  // Guard simple para respetar roles (mismo criterio que el resto del módulo)
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
    .single();

  if (!profile || profile.role !== "soporte") {
    // Redirecciones coherentes con tus guards
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

  // Esta ruta es un alias: redirige al listado real
  redirect("/dashboard/soporte");
}
