// frontend/app/dashboard/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function DashboardIndexRedirect() {
  const supa = supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supa
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role || "empresa";

  switch (role) {
    case "empresa":
      redirect("/dashboard/empresa");
    case "asesor":
      redirect("/dashboard/asesor");
    case "soporte":
      redirect("/dashboard/soporte");
    case "super_admin":
    case "super_admin_root":
      redirect("/dashboard/admin");
    default:
      redirect("/");
  }
}
