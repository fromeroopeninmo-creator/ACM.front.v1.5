export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

type ListParams = {
  q?: string;
  role?: "" | "super_admin" | "super_admin_root";
  page?: number;       // default 1
  pageSize?: number;   // default 20
};

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

type Paged<T> = {
  page: number;
  pageSize: number;
  total: number;
  items: T[];
};

type CreateBody = {
  email: string;
  role?: "super_admin" | "super_admin_root"; // default super_admin
  password?: string;                          // si no viene, se puede usar recovery_link
  generate_recovery_link?: boolean;           // si true, devuelve action_link
  nombre?: string;
  apellido?: string;
  telefono?: string;
};

function parseIntSafe(v: string | null, def: number): number {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : def;
}

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

/* ======================== GET: listar admins ======================== */
export async function GET(req: Request) {
  try {
    // Auth + autorización
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const callerId = auth?.user?.id ?? null;
    if (!callerId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    const callerRole = await resolveUserRole(callerId);
    const isRoot = callerRole === "super_admin_root";
    const isAdmin = isRoot || callerRole === "super_admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // Params
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const roleParam = (url.searchParams.get("role") || "") as "" | "super_admin" | "super_admin_root";
    const page = parseIntSafe(url.searchParams.get("page"), 1);
    const pageSize = parseIntSafe(url.searchParams.get("pageSize"), 20);
    const offset = (page - 1) * pageSize;

    // Filtro roles visibles por el caller:
    // - super_admin_root ve root + admins
    // - super_admin NO ve root (solo admins)
    const rolesVisibles = isRoot
      ? ["super_admin", "super_admin_root"]
      : ["super_admin"];

    let qProfiles = supabaseAdmin
      .from("profiles")
      .select("id, email, nombre, apellido, telefono, role, created_at, updated_at", { count: "exact" })
      .in("role", roleParam ? [roleParam] : rolesVisibles);

    if (q) {
      // búsqueda simple sobre email / nombre / apellido
      qProfiles = qProfiles.or(
        `email.ilike.%${q}%,nombre.ilike.%${q}%,apellido.ilike.%${q}%`
      );
    }

    // Orden por creado desc y paginación
    qProfiles = qProfiles
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data: rows, error, count } = await qProfiles;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const items: AdminRow[] = (rows || []).map((r: any) => ({
      id: String(r.id),
      email: String(r.email || ""),
      role: (r.role as "super_admin" | "super_admin_root") || "super_admin",
      nombre: r.nombre ?? null,
      apellido: r.apellido ?? null,
      telefono: r.telefono ?? null,
      created_at: r.created_at ? String(r.created_at) : null,
      updated_at: r.updated_at ? String(r.updated_at) : null,
    }));

    const resp: Paged<AdminRow> = {
      page,
      pageSize,
      total: count ?? items.length,
      items,
    };
    return NextResponse.json(resp, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado listando admins." },
      { status: 500 }
    );
  }
}

/* ======================== POST: crear/asegurar admin ======================== */
export async function POST(req: Request) {
  try {
    // Auth + autorización
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const callerId = auth?.user?.id ?? null;
    if (!callerId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    const callerRole = await resolveUserRole(callerId);
    const isRoot = callerRole === "super_admin_root";
    const isAdmin = isRoot || callerRole === "super_admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // Body
    const body = (await req.json()) as CreateBody;
    const email = (body.email || "").trim().toLowerCase();
    const targetRole: "super_admin" | "super_admin_root" = body.role || "super_admin";
    const password = body.password?.trim();
    const wantRecovery = body.generate_recovery_link === true;
    const nombre = body.nombre?.trim() || null;
    const apellido = body.apellido?.trim() || null;
    const telefono = body.telefono?.trim() || null;

    if (!email) {
      return NextResponse.json({ error: "Email es requerido." }, { status: 400 });
    }
    if (targetRole === "super_admin_root" && !isRoot) {
      return NextResponse.json(
        { error: "Solo super_admin_root puede crear/asegurar cuentas root." },
        { status: 403 }
      );
    }

    // Buscar usuario por email en Auth
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 400 });
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === email) || null;

    // Si piden recovery link
    if (wantRecovery) {
      let userId = existing?.id || null;

      if (!userId) {
        // crear user sin password, email confirmado
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
        });
        if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 });
        userId = created.user?.id || null;
        if (!userId) return NextResponse.json({ error: "No se pudo crear el usuario." }, { status: 500 });
      }

      // Upsert de profile con rol y metadatos
      const { error: profErr } = await supabaseAdmin.from("profiles").upsert(
        { id: userId, user_id: userId, email, role: targetRole, nombre, apellido, telefono },
        { onConflict: "id" }
      );
      if (profErr) return NextResponse.json({ error: profErr.message }, { status: 400 });

      // Generar action_link
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
      });
      if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 });

      const actionLink = (linkData as any)?.properties?.action_link ?? null;

      return NextResponse.json(
        {
          ok: true,
          mode: "recovery",
          email,
          role: targetRole,
          action_link: actionLink,
          message: "Envia el action_link al usuario para que fije su contraseña.",
        },
        { status: 200 }
      );
    }

    // De lo contrario, crear/actualizar con password
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Password requerido (mínimo 6 caracteres) o use generate_recovery_link:true." },
        { status: 400 }
      );
    }

    let userId = existing?.id || null;

    if (!userId) {
      // Crear nuevo usuario
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 });
      userId = created.user?.id || null;
      if (!userId) return NextResponse.json({ error: "No se pudo crear el usuario." }, { status: 500 });
    } else {
      // Actualizar password
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    // Upsert profile
    const { error: profErr } = await supabaseAdmin.from("profiles").upsert(
      { id: userId, user_id: userId, email, role: targetRole, nombre, apellido, telefono },
      { onConflict: "id" }
    );
    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 400 });

    return NextResponse.json(
      {
        ok: true,
        mode: "password",
        email,
        role: targetRole,
        user_id: userId,
        message: "Admin asegurado correctamente.",
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado creando/asegurando admin." },
      { status: 500 }
    );
  }
}
