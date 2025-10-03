import { redirect } from "next/navigation";

export default function RootPage() {
  // 🚀 Al entrar en "/", te manda directo al login
  redirect("/auth/login");
}
