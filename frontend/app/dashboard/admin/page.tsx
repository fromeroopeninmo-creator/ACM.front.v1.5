import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";
import AdminDashboardClient from "./AdminDashboardClient";
export const dynamic="force-dynamic";
export default async function Page(){const s=supabaseServer();const{data:{user}}=await s.auth.getUser();if(!user)redirect("/login");const{data:p}=await s.from("profiles").select("role").or(`id.eq.${user.id},user_id.eq.${user.id}`).limit(1).maybeSingle();const role=p?.role??(user.user_metadata as any)?.role;if(role!=="super_admin"&&role!=="super_admin_root")redirect("/");return <AdminDashboardClient/>;}
