import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function SoporteCuentaRedirect() {
  redirect("/dashboard/soporte/configuracion");
}
