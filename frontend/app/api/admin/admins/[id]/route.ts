export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

type AdminRow = {
  id: string;
  email: string;
  role: "super_admin" | "super_admin_root";
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type UpdateBody = {
  // Campos editables
  email?: string;                                 // cambiar email (mantiene email_confirm=true)
  role?: "super_admin" | "super_admin_root";      // solo root puede asignar root
  nombre?: string | null;
  apellido?: string | null;
  telefono?: string | null;
};

async function resolveUserRole(userId: string): Promise<Role | null> {
  // Primero por profiles.user_id
  const { data: p1 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (p1?.role) return p1.role as Role;

  // Fallback profiles.id
  const { data: p2 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return (p2?.role as Role) ?? null;
}

function deny(msg: string, status = 403) {
  return NextResponse.json({ error: msg }, { status });
}

/* ======================== GET: obtener un admin ======================== */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Auth
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const callerId = auth?.user?.id ?? null;
    if (!callerId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const callerRole = await resolveUserRole(callerId);
    const isRoot = callerRole === "super_admin_root";
    const isAdmin = isRoot || callerRole === "super_admin";
    if (!isAdmin) return deny("Acceso denegado.");

    const userId = params.id;

    // Traer profile
    const { data: prof, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, nombre, apellido, telefono, role, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!prof) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

    // Autorización por destino
    const targetRole = (prof.role as Role) || "empresa";
    const isTargetRoot = targetRole === "super_admin_root";
    if (!isRoot && isTargetRoot) return deny("No autorizado para ver usuarios root.");

    if (targetRole !== "super_admin" && targetRole !== "super_admin_root") {
      return deny("Solo se gestionan perfiles admin/root en este endpoint.");
    }

    const resp: AdminRow = {
      id: String(prof.id),
      email: String(prof.email || ""),
      role: (prof.role as "super_admin" | "super_admin_root") || "super_admin",
      nombre: prof.nombre ?? null,
      apellido: prof.apellido ?? null,
      telefono: prof.telefono ?? null,
      created_at: prof.created_at ? String(prof.created_at) : null,
      updated_at: prof.updated_at ? String(prof.updated_at) : null,
    };

    return NextResponse.json(resp, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado obteniendo admin." },
      { status: 500 }
    );
  }
}

/* ======================== PUT: actualizar un admin ======================== */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Auth
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const callerId = auth?.user?.id ?? null;
    if (!callerId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const callerRole = await resolveUserRole(callerId);
    const isRoot = callerRole === "super_admin_root";
    const isAdmin = isRoot || callerRole === "super_admin";
    if (!isAdmin) return deny("Acceso denegado.");

    const userId = params.id;
    const body = (await req.json()) as UpdateBody;

    // Traer profile destino
    const { data: prof, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role")
      .eq("id", userId)
      .maybeSingle();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });
    if (!prof) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

    const targetRoleCurrent = (prof.role as Role) || "empresa";
    const isTargetRoot = targetRoleCurrent === "super_admin_root";

    // Autorización por destino
    if (!isRoot && isTargetRoot) {
      return deny("No autorizado para modificar usuarios root.");
    }

    // Solo se gestiona admin/root aquí
    if (targetRoleCurrent !== "super_admin" && targetRoleCurrent !== "super_admin_root") {
      return deny("Solo se gestionan perfiles admin/root en este endpoint.");
    }

    // Cambios a aplicar
    const nextEmail = body.email?.trim().toLowerCase();
    const nextRole = body.role || undefined;
    const nextNombre = body.nombre === undefined ? undefined : (body.nombre ?? null);
    const nextApellido = body.apellido === undefined ? undefined : (body.apellido ?? null);
    const nextTelefono = body.telefono === undefined ? undefined : (body.telefono ?? null);

    // Reglas de role:
    // - Solo root puede asignar o mantener super_admin_root
    // - Un admin puede editar admins, pero NO promover a root ni tocar roots
    if (nextRole) {
      if (nextRole === "super_admin_root" && !isRoot) {
        return deny("Solo super_admin_root puede asignar rol root.");
      }
    }

    // 1) Si cambia email → actualizar en Auth y en profiles
    if (nextEmail && nextEmail !== prof.email) {
      // Actualizar email en Auth
      const { error: authUpdErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: nextEmail,
        email_confirm: true, // lo dejamos confirmado para no cortar acceso
      });
      if (authUpdErr) return NextResponse.json({ error: authUpdErr.message }, { status: 400 });
    }

    // 2) Upsert de profile con los cambios
    const toUpsert: any = { id: userId, user_id: userId };
    if (nextEmail) toUpsert.email = nextEmail;
    if (nextRole) toUpsert.role = nextRole; // validado arriba
    if (nextNombre !== undefined) toUpsert.nombre = nextNombre;
    if (nextApellido !== undefined) toUpsert.apellido = nextApellido;
    if (nextTelefono !== undefined) toUpsert.telefono = nextTelefono;

    if (Object.keys(toUpsert).length > 2) {
      const { error: upErr } = await supabaseAdmin.from("profiles").upsert(toUpsert, { onConflict: "id" });
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado actualizando admin." },
      { status: 500 }
    );
  }
}

/* ======================== DELETE: eliminar un admin ======================== */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Auth
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const callerId = auth?.user?.id ?? null;
    if (!callerId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const callerRole = await resolveUserRole(callerId);
    const isRoot = callerRole === "super_admin_root";
    const isAdmin = isRoot || callerRole === "super_admin";
    if (!isAdmin) return deny("Acceso denegado.");

    const userId = params.id;

    if (callerId === userId) {
      return NextResponse.json({ error: "No podés eliminarte a vos mismo." }, { status: 400 });
    }

    // Traer role del destino
    const { data: prof, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });
    if (!prof) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

    const targetRole = (prof.role as Role) || "empresa";
    const isTargetRoot = targetRole === "super_admin_root";

    if (!isRoot && isTargetRoot) {
      return deny("No autorizado para eliminar usuarios root.");
    }
    if (targetRole !== "super_admin" && targetRole !== "super_admin_root") {
      return deny("Solo se gestionan perfiles admin/root en este endpoint.");
    }

    // 1) Borrar en Auth
    const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delAuthErr) return NextResponse.json({ error: delAuthErr.message }, { status: 400 });

    // 2) Borrar en profiles (defensivo)
    const { error: delProfErr } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
    if (delProfErr) {
      // No cortamos si falla borrar el perfil: ya no tiene auth
      // Pero informamos por si hay políticas que dependen del row
      return NextResponse.json(
        { ok: true, warning: `Usuario eliminado en auth, pero profiles: ${delProfErr.message}` },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado eliminando admin." },
      { status: 500 }
    );
  }
}
