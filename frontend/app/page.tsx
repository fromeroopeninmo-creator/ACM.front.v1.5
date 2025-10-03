// app/page.tsx  (SERVER COMPONENT)
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import ACMForm from "@/components/ACMForm";

export default async function RootPage() {
  // Lee la sesión desde cookie en el SERVIDOR
  const supabase = supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Si NO hay sesión → redirige al login ANTES de renderizar (sin pantalla en blanco)
  if (!session) {
    redirect("/auth/login"); // si tu login real es /auth/login, cambiá SOLO esta ruta
  }

  // Si hay sesión → renderiza el dashboard directamente
  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-center text-primary">
        VMI - Valoración de Mercado Inmobiliario
      </h1>
      <div className="bg-white shadow-lg rounded-lg p-6">
        <ACMForm />
      </div>
    </div>
  );
}
