// app/api/soporte/plan-visual-toggle/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

async function resolveUserRole(userId: string): Promise<Role | null> {
  // 1) Por user_id (principal)
  const { data: p1 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (p1?.role) return p1.role as Role;

  // 2) Fallback por id (en algunos setups profiles.id === auth.users.id)
  const { data: p2 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return (p2?.role as Role) ?? null;
}

export async function POST(req: Request) {
  try {
    // 1) Autenticación
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const actorId = auth?.user?.id ?? null;
    if (!actorId) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // 2) Autorización
    const role = await resolveUserRole(actorId);
    const allowed: Role[] = ["soporte", "super_admin", "super_admin_root"];
    if (!role || !allowed.includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // 3) Body
    const body = await req.json().catch(() => null as any);
    const empresaId: string | undefined = body?.empresaId;
    const activo: boolean | undefined = body?.activo;

    if (!empresaId || typeof empresaId !== "string") {
      return NextResponse.json({ error: "Falta 'empresaId'." }, { status: 400 });
    }
    if (typeof activo !== "boolean") {
      return NextResponse.json({ error: "Falta 'activo' (boolean)." }, { status: 400 });
    }

    // 4) Verificar que la empresa exista
    const { data: empresa, error: empErr } = await supabaseAdmin
      .from("empresas")
      .select("id, razon_social, nombre_comercial")
      .eq("id", empresaId)
      .maybeSingle();
    if (empErr) {
      return NextResponse.json({ error: empErr.message }, { status: 400 });
    }
    if (!empresa) {
      return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
    }

    // 5) Obtener el plan actualmente activo (si existe)
    const { data: planVigente } = await supabaseAdmin
      .from("empresas_planes")
      .select("id, plan_id, activo, fecha_inicio, fecha_fin")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .maybeSingle();

    // 6) Toggle visual
    let affectedId: string | null = null;

    if (activo === false) {
      // Desactivar todos los planes activos de esa empresa (por seguridad)
      const { error: updErr } = await supabaseAdmin
        .from("empresas_planes")
        .update({ activo: false })
        .eq("empresa_id", empresaId)
        .eq("activo", true);

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 });
      }
    } else {
      // activo === true
      if (planVigente?.id) {
        // Ya hay uno activo -> no hacemos nada (idempotente)
        affectedId = planVigente.id;
      } else {
        // No hay activo: activar el más reciente por fecha_inicio
        const { data: ultimoPlan, error: lastErr } = await supabaseAdmin
          .from("empresas_planes")
          .select("id")
          .eq("empresa_id", empresaId)
          .order("fecha_inicio", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastErr) {
          return NextResponse.json({ error: lastErr.message }, { status: 400 });
        }
        if (!ultimoPlan) {
          return NextResponse.json(
            { error: "La empresa no tiene registros en empresas_planes para activar." },
            { status: 404 }
          );
        }

        const { error: actErr } = await supabaseAdmin
          .from("empresas_planes")
          .update({ activo: true })
          .eq("id", ultimoPlan.id);

        if (actErr) {
          return NextResponse.json({ error: actErr.message }, { status: 400 });
        }
        affectedId = ultimoPlan.id;
      }
    }

    // 7) Traer snapshot actualizado (vista de soporte)
    const { data: snapshot, error: snapErr } = await supabaseAdmin
      .from("v_empresas_soporte")
      .select(
        "empresa_id, empresa_nombre, cuit, plan_nombre, max_asesores, max_asesores_override, plan_activo, fecha_inicio, fecha_fin"
      )
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (snapErr) {
      return NextResponse.json({ error: snapErr.message }, { status: 400 });
    }

    // 8) Registrar acción de soporte
    const empresaNombre = snapshot?.empresa_nombre ?? empresa?.nombre_comercial ?? empresa?.razon_social ?? "";
    const descripcion =
      activo
        ? `Reactivación visual de plan para empresa "${empresaNombre}".`
        : `Suspensión visual de plan para empresa "${empresaNombre}".`;

    await supabaseAdmin.from("acciones_soporte").insert({
      soporte_id: actorId,
      empresa_id: empresaId,
      descripcion,
      // timestamp/updated_at con default now()
    });

    // 9) Respuesta
    return NextResponse.json(
      {
        ok: true,
        empresaId,
        empresasPlanesId: affectedId,
        estado: {
          activo: snapshot?.plan_activo ?? false,
          planNombre: snapshot?.plan_nombre ?? null,
          fechaInicio: snapshot?.fecha_inicio ?? null,
          fechaFin: snapshot?.fecha_fin ?? null,
          maxAsesores: snapshot?.max_asesores ?? null,
          override: snapshot?.max_asesores_override ?? null,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
