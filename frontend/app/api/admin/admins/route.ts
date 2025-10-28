// frontend/app/api/admin/admins/route.ts
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

type Paged<T> = { page: number; pageSize: number; total: number; items: T[] };

async function resolveUserRole(userId: string): Promise<Role | null> {
  const { data: p1 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (p1?.role) return p1.role as Role;

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

/* ========================= GET: listado =========================
   Filtros: q, role ("super_admin" | "super_admin_root" | "todos")
   Paginación: page, pageSize
   Orden: sortBy ("nombre" | "email" | "role" | "created_at"), sortDir ("asc" | "desc")
=================================================================*/
export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const role = (url.searchParams.get("role") ||
      "todos") as "super_admin" | "super_admin_root" | "todos";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const pageSizeRaw = parseInt(url.searchParams.get("pageSize") || "", 10);
    const pageSize = [10, 20, 50].includes(pageSizeRaw) ? pageSizeRaw : 10;
    const sortBy = (url.searchParams.get("sortBy") ||
      "created_at") as "nombre" | "email" | "role" | "created_at";
    const sortDir = (url.searchParams.get("sortDir") || "desc") as "asc" | "desc";

    let query = supabaseAdmin
      .from("profiles")
      .select(
        "id, email, role, nombre, apellido, telefono, created_at, updated_at",
        { count: "exact" }
      )
      .in("role", ["super_admin", "super_admin_root"] as Role[]);

    if (role !== "todos") query = query.eq("role", role);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    let rows: AdminRow[] =
      (data ?? []).map((r: any) => ({
        id: String(r.id),
        email: r.email || "",
        role: (r.role as "super_admin" | "super_admin_root") || "super_admin",
        nombre: r.nombre ?? null,
        apellido: r.apellido ?? null,
        telefono: r.telefono ?? null,
        created_at: r.created_at ? String(r.created_at) : null,
        updated_at: r.updated_at ? String(r.updated_at) : null,
      })) || [];

    // filtro q
    if (q) {
      rows = rows.filter((r) => {
        const h = `${r.nombre || ""} ${r.apellido || ""} ${r.email || ""}`.toLowerCase();
        return h.includes(q);
      });
    }

    // orden
    rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortBy) {
        case "nombre": {
          const an = `${a.nombre || ""} ${a.apellido || ""}`.trim();
          const bn = `${b.nombre || ""} ${b.apellido || ""}`.trim();
          return an.localeCompare(bn, "es") * dir;
        }
        case "email":
          return (a.email || "").localeCompare(b.email || "", "es") * dir;
        case "role":
          return a.role.localeCompare(b.role) * dir;
        case "created_at": {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return (ta - tb) * dir;
        }
        default:
          return 0;
      }
    });

    // paginación
    const total = count ?? rows.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = rows.slice(start, end);

    const resp: Paged<AdminRow> = {
      page,
      pageSize,
      total,
      items: pageItems,
    };
    return NextResponse.json(resp, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado listando admins." },
      { status: 500 }
    );
  }
}

/* ========================= POST: crear =========================
   Body:
   {
     email: string (req),
     role: "super_admin" | "super_admin_root" (req),
     nombre?: string, apellido?: string,
     password?: string,        // opcional: si viene, se crea con contraseña
     sendInvite?: boolean      // opcional: si true, genera link de invitación (signup)
   }
   Reglas:
   - admin puede crear "super_admin"
   - solo root puede crear "super_admin_root"
=================================================================*/
export async function POST(req: Request) {
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

    const body = await req.json();
    const email: string = (body.email || "").trim().toLowerCase();
    const role: "super_admin" | "super_admin_root" = body.role;
    const nombre: string | undefined = body.nombre?.trim() || undefined;
    const apellido: string | undefined = body.apellido?.trim() || undefined;
    const password: string | undefined = body.password?.trim() || undefined;
    const sendInvite: boolean = !!body.sendInvite;

    if (!email) return NextResponse.json({ error: "Email requerido." }, { status: 400 });
    if (!role) return NextResponse.json({ error: "Rol requerido." }, { status: 400 });

    if (role === "super_admin_root" && !isRoot) {
      return deny("Solo ROOT puede crear usuarios ROOT.");
    }

    // Si no hay password y tampoco sendInvite → error
    if (!password && !sendInvite) {
      return NextResponse.json(
        { error: "Password requerido (mínimo 6 caracteres) o marque 'enviar link de invitación'." },
        { status: 400 }
      );
    }
    if (password && password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    }

    let userId: string | null = null;
    let inviteLink: string | null = null;

    if (password) {
      // Crear con contraseña
      const { data: createRes, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role, nombre, apellido },
      });

      if (createErr) {
        // Errores comunes: email ya registrado, formato inválido, etc.
        const msg = createErr?.message || "No se pudo crear el usuario (password).";
        // Normalizamos el mensaje cuando es email duplicado
        if (msg.toLowerCase().includes("user already registered") || msg.toLowerCase().includes("already exists")) {
          return NextResponse.json({ error: "El email ya está registrado." }, { status: 400 });
        }
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      userId = createRes.user?.id ?? null;

      // Si además tildaste "enviar link de invitación": genero un recovery opcional
      if (sendInvite && createRes.user) {
        const { data: linkRes, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
        });
        if (!linkErr) {
          inviteLink =
            (linkRes as any)?.properties?.action_link ||
            (linkRes as any)?.action_link ||
            null;
        }
      }
    } else {
      // SIN contraseña → generamos link de SIGNUP (válido)
      const { data: linkRes, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "signup",
        email,
        options: { data: { role, nombre, apellido } },
      });
      if (linkErr) {
        const msg = linkErr?.message || "No se pudo generar el link de invitación.";
        // Si ya existía un usuario con ese email, devolvemos mensaje claro
        if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) {
          return NextResponse.json({ error: "El email ya está registrado." }, { status: 400 });
        }
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      inviteLink =
        (linkRes as any)?.properties?.action_link ||
        (linkRes as any)?.action_link ||
        null;

      userId = linkRes?.user?.id ?? null;
      // Nota: generateLink(type:"signup") típicamente retorna user.id creado.
      // Si no, igual seguimos: se crea al completar el flujo de signup.
    }

    // Si no tenemos userId (poco frecuente en signup), devolvemos el link y nota
    if (!userId) {
      return NextResponse.json(
        {
          ok: true,
          user_id: null,
          invite_link: inviteLink,
          note: "El usuario terminará de crearse al completar el signup desde el link.",
        },
        { status: 200 }
      );
    }

    // Upsert profile
    const upsert: any = {
      id: userId,
      user_id: userId,
      email,
      role,
      nombre: nombre ?? null,
      apellido: apellido ?? null,
    };
    const { error: profErr } = await supabaseAdmin.from("profiles").upsert(upsert, { onConflict: "id" });
    if (profErr) {
      // Si falla profile, borramos usuario recién creado para no dejarlo colgado
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      return NextResponse.json({ error: profErr.message }, { status: 400 });
    }

    return NextResponse.json(
      { ok: true, user_id: userId, invite_link: inviteLink },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado creando admin." },
      { status: 500 }
    );
  }
}
