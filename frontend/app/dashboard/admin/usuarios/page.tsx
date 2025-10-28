// frontend/app/dashboard/admin/usuarios/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import UsuariosClient from "./UsuariosClient";

export const dynamic = "force-dynamic";

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
  if (envUrl) return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  return "http://localhost:3000";
}

export default async function AdminUsuariosPage() {
  // Guard de sesión + rol
  const supa = supabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supa
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role || (user.user_metadata as any)?.role || null;
  const isRoot = role === "super_admin_root";
  const isAdmin = role === "super_admin" || isRoot;

  if (!isAdmin) {
    switch (role) {
      case "soporte": redirect("/dashboard/soporte");
      case "empresa": redirect("/dashboard/empresa");
      case "asesor" : redirect("/dashboard/asesor");
      default: redirect("/");
    }
  }

  // SSR fetch del listado
  const cookieHeader = buildCookieHeader();
  const base = getBaseUrl();
  let initial: { items: any[] };

  try {
    const res = await fetch(`${base}/api/admin/admins`, {
      method: "GET",
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GET /api/admin/admins → ${res.status} ${res.statusText} ${body}`.trim());
    }
    initial = await res.json();
  } catch (e: any) {
    // Render de error simple
    return (
      <main className="p-4 md:p-6 space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Usuarios (Admins & Soporte)</h1>
          <p className="text-sm text-gray-500">Error al cargar usuarios.</p>
        </header>
        <section className="rounded-2xl border bg-red-50 text-red-700 p-4">
          {e?.message || String(e)}
        </section>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl md:text-2xl font-semibold">Usuarios (Admins & Soporte)</h1>
        <p className="text-sm text-gray-500">
          Gestioná roles, e-mails y enlaces de reseteo de contraseña.
        </p>
      </header>

      <UsuariosClient initial={initial} isRoot={isRoot} />
    </main>
  );
}
