// app/api/admin/planes/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

function toNum(x: any): number | null {
  if (x === null || x === undefined || x === "") return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x === "string") {
    const n = parseFloat(x);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

async function resolveUserRole(userId: string): Promise<Role | null> {
  // Preferente: profiles.user_id
  const { data: p1 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (p1?.role) return p1.role as Role;

  // Fallback: profiles.id
  const { data: p2 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (p2?.role as Role) ?? null;
}

/**
 * PUT /api/admin/planes/[id]
 * Edita un plan (service-role) + registra auditoría
 * Body: cualquier subset de { nombre, precio, duracion_dias, max_asesores, precio_extra_por_asesor }
 */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const role = await resolveUserRole(userId);
    const allowed: Role[] = ["super_admin", "super_admin_root"];
    if (!role || !allowed.includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    const planId = params?.id;
    if (!planId) return NextResponse.json({ error: "Falta 'id'." }, { status: 400 });

    const body = await req.json().catch(() => null as any);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body inválido." }, { status: 400 });
    }

    // Traer valores actuales (para auditoría)
    const { data: before, error: getErr } = await supabaseAdmin
      .from("planes")
      .select("id, nombre, precio, duracion_dias, max_asesores, precio_extra_por_asesor")
      .eq("id", planId)
      .maybeSingle();

    if (getErr) return NextResponse.json({ error: getErr.message }, { status: 400 });
    if (!before) return NextResponse.json({ error: "Plan no encontrado." }, { status: 404 });

    // Preparar cambios (solo campos presentes en body)
    const patch: any = {};
    if ("nombre" in body) {
      if (!body.nombre || typeof body.nombre !== "string") {
        return NextResponse.json({ error: "Campo 'nombre' inválido." }, { status: 400 });
      }
      patch.nombre = body.nombre;
    }
    if ("precio" in body) {
      const n = toNum(body.precio);
      if (n === null || n < 0) return NextResponse.json({ error: "Campo 'precio' inválido." }, { status: 400 });
      patch.precio = n;
    }
    if ("duracion_dias" in body) {
      const n = Number(body.duracion_dias);
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json({ error: "Campo 'duracion_dias' inválido." }, { status: 400 });
      }
      patch.duracion_dias = n;
    }
    if ("max_asesores" in body) {
      const n = Number(body.max_asesores);
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json({ error: "Campo 'max_asesores' inválido." }, { status: 400 });
      }
      patch.max_asesores = n;
    }
    if ("precio_extra_por_asesor" in body) {
      const n = toNum(body.precio_extra_por_asesor);
      if (n === null || n < 0) {
        return NextResponse.json({ error: "Campo 'precio_extra_por_asesor' inválido." }, { status: 400 });
      }
      patch.precio_extra_por_asesor = n;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No hay cambios para aplicar." }, { status: 400 });
    }

    // Update
    const { data: after, error: updErr } = await supabaseAdmin
      .from("planes")
      .update(patch)
      .eq("id", planId)
      .select("id, nombre, precio, duracion_dias, max_asesores, precio_extra_por_asesor")
      .maybeSingle();

    if (updErr) {
      // nombre unique, etc.
      const msg = updErr.message || "";
      const status = msg.toLowerCase().includes("unique") ? 409 : 400;
      return NextResponse.json({ error: msg }, { status });
    }
    if (!after) {
      return NextResponse.json({ error: "No se pudo actualizar el plan." }, { status: 400 });
    }

    // Auditoría
    await supabaseAdmin.from("auditoria_planes").insert({
      actor_id: userId,
      actor_role: role,
      action: "update",
      plan_id: planId,
      valores_antes: {
        nombre: before.nombre,
        precio: before.precio,
        duracion_dias: before.duracion_dias,
        max_asesores: before.max_asesores,
        precio_extra_por_asesor: before.precio_extra_por_asesor,
      },
      valores_despues: {
        nombre: after.nombre,
        precio: after.precio,
        duracion_dias: after.duracion_dias,
        max_asesores: after.max_asesores,
        precio_extra_por_asesor: after.precio_extra_por_asesor,
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/planes/[id]
 * Elimina un plan (service-role) + registra auditoría
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const role = await resolveUserRole(userId);
    const allowed: Role[] = ["super_admin", "super_admin_root"];
    if (!role || !allowed.includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    const planId = params?.id;
    if (!planId) return NextResponse.json({ error: "Falta 'id'." }, { status: 400 });

    // Traer valores actuales (para auditoría)
    const { data: before, error: getErr } = await supabaseAdmin
      .from("planes")
      .select("id, nombre, precio, duracion_dias, max_asesores, precio_extra_por_asesor")
      .eq("id", planId)
      .maybeSingle();

    if (getErr) return NextResponse.json({ error: getErr.message }, { status: 400 });
    if (!before) return NextResponse.json({ error: "Plan no encontrado." }, { status: 404 });

    // Intentar borrar
    const { error: delErr } = await supabaseAdmin.from("planes").delete().eq("id", planId);

    if (delErr) {
      // Manejar FK en uso
      const msg = delErr.message || "";
      const status = msg.toLowerCase().includes("foreign key") ? 409 : 400;
      return NextResponse.json({ error: msg }, { status });
    }

    // Auditoría
    await supabaseAdmin.from("auditoria_planes").insert({
      actor_id: userId,
      actor_role: role,
      action: "delete",
      plan_id: planId,
      valores_antes: {
        nombre: before.nombre,
        precio: before.precio,
        duracion_dias: before.duracion_dias,
        max_asesores: before.max_asesores,
        precio_extra_por_asesor: before.precio_extra_por_asesor,
      },
      valores_despues: null,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
