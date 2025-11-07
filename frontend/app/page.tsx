// app/page.tsx  (SERVER COMPONENT)
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";

export default async function RootPage() {
  // Lee la sesión desde cookie en el SERVIDOR
  const supabase = supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Si NO hay sesión → redirige al login ANTES de renderizar
  if (!session) {
    redirect("/auth/login"); // login público
  }

  // Si hay sesión → ahora siempre enviamos al dashboard principal
  redirect("/dashboard");
}
