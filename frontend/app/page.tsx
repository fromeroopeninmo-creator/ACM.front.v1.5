// app/page.tsx  (SERVER COMPONENT)
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import LandingPage from "./landing/LandingPage"; // 👈 nuevo componente

export default async function RootPage() {
  // Leer sesión desde cookie en el servidor
  const supabase = supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Si hay sesión → mandar al dashboard
  if (session) {
    redirect("/dashboard");
  }

  // Si NO hay sesión → mostrar la landing pública
  return <LandingPage />;
}
