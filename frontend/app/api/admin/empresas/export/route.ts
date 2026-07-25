export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function assertAdmin() {
  const server = supabaseServer();
  const { data: { user } } = await server.auth.getUser();
  if (!user?.id) return false;
  const { data } = await admin.from("profiles").select("role").or(`id.eq.${user.id},user_id.eq.${user.id}`).limit(1).maybeSingle();
  return data?.role === "super_admin" || data?.role === "super_admin_root";
}

export async function GET() {
  try {
    if (!(await assertAdmin())) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });

    const { data: empresas, error } = await admin
      .from("empresas")
      .select("id, user_id, id_usuario, nombre_comercial, razon_social, cuit, telefono, localidad, provincia, suspendida, created_at, eliminada_at")
      .is("eliminada_at", null)
      .order("nombre_comercial", { ascending: true });
    if (error) throw new Error(error.message);

    const ownerIds = Array.from(new Set((empresas ?? []).flatMap((e: any) => [e.user_id, e.id_usuario]).filter(Boolean).map(String)));
    const owners = ownerIds.length
      ? await admin.from("profiles").select("id, user_id, email, nombre, apellido, telefono").or(ownerIds.map((id) => `id.eq.${id},user_id.eq.${id}`).join(","))
      : { data: [], error: null } as any;
    if (owners.error) throw new Error(owners.error.message);
    const ownerMap = new Map<string, any>();
    for (const p of owners.data ?? []) {
      if (p.id) ownerMap.set(String(p.id), p);
      if (p.user_id) ownerMap.set(String(p.user_id), p);
    }

    const { data: advisorRows, error: advisorError } = await admin.from("profiles").select("empresa_id").eq("role", "asesor");
    if (advisorError) throw new Error(advisorError.message);
    const counts = new Map<string, number>();
    for (const row of advisorRows ?? []) if (row.empresa_id) counts.set(String(row.empresa_id), (counts.get(String(row.empresa_id)) ?? 0) + 1);

    const header = ["Empresa ID", "Nombre comercial", "Razón social", "CUIT", "Titular", "Email", "Teléfono", "Localidad", "Provincia", "Estado", "Asesores", "Fecha alta"];
    const lines = [header.map(csvCell).join(",")];
    for (const e of empresas ?? []) {
      const owner = ownerMap.get(String(e.user_id ?? e.id_usuario ?? ""));
      lines.push([
        e.id,
        e.nombre_comercial,
        e.razon_social,
        e.cuit,
        [owner?.nombre, owner?.apellido].filter(Boolean).join(" "),
        owner?.email,
        e.telefono ?? owner?.telefono,
        e.localidad,
        e.provincia,
        e.suspendida ? "Suspendida" : "Activa",
        counts.get(String(e.id)) ?? 0,
        e.created_at,
      ].map(csvCell).join(","));
    }

    return new NextResponse("\uFEFF" + lines.join("\r\n"), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="empresas-vai-prop-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error interno." }, { status: 500 });
  }
}
