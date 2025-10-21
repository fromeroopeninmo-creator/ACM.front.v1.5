// app/api/informes/delete/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

const BUCKET = "informes";

// --- Admin client (bypass RLS para borrar la fila una vez autorizamos en código) ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function DELETE(req: Request) {
  try {
    // 0) id por query
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Falta 'id'." }, { status: 400 });
    }

    // 1) Usuario autenticado (desde cookies)
    const server = supabaseServer();
    const { data: auth, error: authErr } = await server.auth.getUser();
    if (authErr) {
      return NextResponse.json({ error: `Auth error: ${authErr.message}` }, { status: 401 });
    }
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // 2) Traer informe por SERVICE_ROLE (evitamos 404 de RLS)
    const { data: inf, error: infErr } = await supabaseAdmin
      .from("informes")
      .select("id, empresa_id, autor_id")
      .eq("id", id)
      .maybeSingle();

    if (infErr) {
      return NextResponse.json({ error: `Error obteniendo informe: ${infErr.message}` }, { status: 500 });
    }
    if (!inf) {
      return NextResponse.json({ error: "Informe inexistente." }, { status: 404 });
    }

    // 3) Resolver rol
    let role: Role = ((user.user_metadata as any)?.role || "empresa") as Role;
    if (!["empresa", "asesor", "soporte", "super_admin", "super_admin_root"].includes(role)) {
      role = "empresa";
    }

    // 4) Autorización
    // Empresa: puede borrar cualquier informe de SU empresa.
    // Asesor: solo informes propios (autor_id === user.id).
    // Soporte/super_admin: pueden borrar cualquiera.

    if (role === "empresa") {
      // Resolver empresa del usuario
      const { data: emp, error: empErr } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (empErr) {
        return NextResponse.json({ error: `No se pudo resolver empresa del usuario: ${empErr.message}` }, { status: 400 });
      }
      if (!emp?.id || emp.id !== inf.empresa_id) {
        return NextResponse.json({ error: "Acceso denegado: informe no pertenece a su empresa." }, { status: 403 });
      }
      // OK
    } else if (role === "asesor") {
      if (inf.autor_id !== user.id) {
        return NextResponse.json({ error: "Acceso denegado: solo podés borrar tus propios informes." }, { status: 403 });
      }
      // (Opcional) podrías validar también que el asesor tenga empresa_id coincidente, pero no es requisito acá.
    } else {
      // soporte / super_admin / super_admin_root → OK
    }

    // 5) Borrar archivos del Storage (carpeta empresa_id/informe_id/)
    // Usamos el client "server" (con la sesión del usuario) porque tus policies de Storage ya permiten operar en ese path.
    // Si tus policies no lo permiten, cambiá a supabaseAdmin.storage.* y ajustá las policies en consecuencia.
    const prefix = `${inf.empresa_id}/${inf.id}`;
    // Listamos el contenido del folder (nivel actual)
    const { data: files, error: listErr } = await server.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000 });

    if (listErr) {
      // No abortamos por fallo de listado; seguiremos con el delete de la fila.
      // Pero informamos en response por si querés rastrear.
      console.warn("Storage list error:", listErr.message);
    } else if (Array.isArray(files) && files.length > 0) {
      // Construimos paths absolutos a borrar
      const paths = files.map((f) => `${prefix}/${f.name}`);
      const { error: delErr } = await server.storage.from(BUCKET).remove(paths);
      if (delErr) {
        // Tampoco abortamos; pero lo notificamos
        console.warn("Storage remove error:", delErr.message);
      }
    }
    // Si hay subcarpetas, podrías repetir list/remove para cada folder detectado.
    // En tu estructura actual, guardamos directamente en empresaId/informeId/archivo.jpg (sin subniveles).

    // 6) Borrar fila en DB (bypass RLS)
    const { error: dbDelErr } = await supabaseAdmin
      .from("informes")
      .delete()
      .eq("id", id);

    if (dbDelErr) {
      return NextResponse.json({ error: `Error borrando informe en DB: ${dbDelErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted: id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
