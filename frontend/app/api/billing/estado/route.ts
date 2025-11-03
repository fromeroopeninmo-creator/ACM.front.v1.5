// app/api/billing/estado/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

function toNum(x: any): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === "number") return x;
  if (typeof x === "string") return parseFloat(x) || 0;
  return Number(x) || 0;
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

async function resolveEmpresaIdForUser(userId: string, role: Role): Promise<string | null> {
  // 1) Empresas donde el usuario es dueño directo
  const { data: emp } = await supabaseAdmin
    .from("empresas")
    .select("id, user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (emp?.id) return emp.id as string;

  // 2) Perfil (empresa/asesor) con empresa asociada
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", userId)
    .maybeSingle();

  return (prof?.empresa_id as string) ?? null;
}

export async function GET(req: Request) {
  try {
    // Auth
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    // Role
    const role = await resolveUserRole(userId);
    if (!role) return NextResponse.json({ error: "Rol no encontrado." }, { status: 403 });

    // Params
    const url = new URL(req.url);
    const empresaIdParam = url.searchParams.get("empresaId");

    // Resolver empresaId según rol:
    // - empresa/asesor: su propia empresa (ignora empresaId param si se envía).
    // - super_admin/root: puede pasar empresaId (obligatorio si quiere ver otra); si no pasa, intenta propia (si tuviera).
    let empresaId: string | null = null;

    if (role === "empresa" || role === "asesor") {
      empresaId = await resolveEmpresaIdForUser(userId, role);
      if (!empresaId) {
        return NextResponse.json(
          { error: "No se pudo resolver la empresa del usuario." },
          { status: 400 }
        );
      }
    } else if (role === "super_admin" || role === "super_admin_root") {
      empresaId = empresaIdParam || (await resolveEmpresaIdForUser(userId, role));
      if (!empresaId) {
        return NextResponse.json(
          { error: "Falta 'empresaId' para consulta como admin." },
          { status: 400 }
        );
      }
    } else {
      // Soporte no debería usar billing (solo lectura vía admin si hiciera falta)
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // Verificar que la empresa exista (incluimos campos de suspensión)
    const { data: empRow, error: empErr } = await supabaseAdmin
      .from("empresas")
      .select(
        "id, nombre_comercial, razon_social, suspendida, suspendida_at, suspension_motivo"
      )
      .eq("id", empresaId)
      .maybeSingle();

    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 400 });
    if (!empRow) return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });

    const empresaInfo = {
      id: empRow.id as string,
      nombreComercial: (empRow as any).nombre_comercial ?? null,
      razonSocial: (empRow as any).razon_social ?? null,
      suspendida: Boolean((empRow as any).suspendida),
      suspendida_at: (empRow as any).suspendida_at ?? null,
      suspension_motivo: (empRow as any).suspension_motivo ?? null,
    };

    // Traer plan vigente (si hay activo; si no, el último por fecha_inicio)
    const { data: activo } = await supabaseAdmin
      .from("empresas_planes")
      .select("id, plan_id, fecha_inicio, fecha_fin, activo, max_asesores_override")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .maybeSingle();

    let planEP = activo;
    if (!planEP) {
      const { data: ultimo } = await supabaseAdmin
        .from("empresas_planes")
        .select("id, plan_id, fecha_inicio, fecha_fin, activo, max_asesores_override")
        .eq("empresa_id", empresaId)
        .order("fecha_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      planEP = ultimo ?? null;
    }

    // Si no hay ningún registro en empresas_planes
    if (!planEP) {
      // También consultamos estado de suscripción para "próximo plan" aunque no haya plan activo
      const { data: vEstado } = await supabaseAdmin
        .from("v_suscripcion_estado")
        .select("plan_proximo_id, plan_proximo_nombre, cambio_programado_para")
        .eq("empresa_id", empresaId)
        .maybeSingle();

      // Sin plan actual → no hay ciclo ni vencimiento
      return NextResponse.json(
        {
          empresa: empresaInfo,
          plan: null,
          ciclo: { inicio: null, fin: null, proximoCobro: null },
          suscripcion: null,
          proximoPlan: vEstado?.plan_proximo_id
            ? { id: vEstado.plan_proximo_id, nombre: vEstado.plan_proximo_nombre ?? "" }
            : null,
          cambioProgramadoPara: vEstado?.cambio_programado_para ?? null,
          estado: {
            suspendida: empresaInfo.suspendida,
            motivo: empresaInfo.suspension_motivo ?? null,
            plan_vencido: false,
            dias_desde_vencimiento: null,
            en_periodo_gracia: false,
          },
        },
        { status: 200 }
      );
    }

    // Datos del plan
    const { data: planRow, error: planErr } = await supabaseAdmin
      .from("planes")
      .select("id, nombre, precio, duracion_dias, max_asesores, precio_extra_por_asesor")
      .eq("id", planEP.plan_id)
      .maybeSingle();

    if (planErr) return NextResponse.json({ error: planErr.message }, { status: 400 });

    // IVA visual
    const precioNeto = toNum(planRow?.precio ?? 0);
    const iva = Math.round(precioNeto * 0.21 * 100) / 100;
    const totalConIVA = Math.round((precioNeto + iva) * 100) / 100;

    // Suscripción (última relevante por estado/fecha)
    const { data: susRow } = await supabaseAdmin
      .from("suscripciones")
      .select("estado, inicio, fin, externo_customer_id, externo_subscription_id")
      .eq("empresa_id", empresaId)
      .order("inicio", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Calcular próximo cobro (MEJORA: prioriza fecha_fin si existe)
    let proximoCobro: string | null = null;
    if (planEP.fecha_fin) {
      proximoCobro = new Date(planEP.fecha_fin as string).toISOString();
    } else if (planEP.fecha_inicio && planRow?.duracion_dias) {
      try {
        const base = new Date(planEP.fecha_inicio as string);
        const d = new Date(base.getTime());
        d.setDate(d.getDate() + Number(planRow.duracion_dias));
        proximoCobro = d.toISOString();
      } catch {
        proximoCobro = null;
      }
    }

    // Detectar vencimiento del plan (independiente de suspensión manual)
    const now = new Date();
    let plan_vencido = false;
    let dias_desde_vencimiento: number | null = null;
    let en_periodo_gracia = false;

    let refFin: Date | null = null;
    if (planEP.fecha_fin) {
      refFin = new Date(planEP.fecha_fin as string);
    } else if (proximoCobro) {
      refFin = new Date(proximoCobro);
    }

    if (refFin && !Number.isNaN(refFin.getTime())) {
      if (now > refFin) {
        plan_vencido = true;
        const diffMs = now.getTime() - refFin.getTime();
        dias_desde_vencimiento = Math.floor(diffMs / 86400000);
        en_periodo_gracia = dias_desde_vencimiento <= 2;
      }
    }

    // Leer "próximo plan" programado desde la vista (no rompe lo existente)
    const { data: vEstado } = await supabaseAdmin
      .from("v_suscripcion_estado")
      .select("plan_proximo_id, plan_proximo_nombre, cambio_programado_para")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    return NextResponse.json(
      {
        empresa: empresaInfo,
        plan: planRow
          ? {
              id: planRow.id,
              nombre: planRow.nombre,
              precioNeto,
              totalConIVA,
            }
          : null,
        ciclo: {
          inicio: planEP.fecha_inicio,
          fin: planEP.fecha_fin,
          proximoCobro,
        },
        suscripcion: susRow
          ? {
              estado: susRow.estado, // activa | suspendida | cancelada | pendiente
              externoCustomerId: susRow.externo_customer_id ?? null,
              externoSubscriptionId: susRow.externo_subscription_id ?? null,
            }
          : null,
        proximoPlan: vEstado?.plan_proximo_id
          ? { id: vEstado.plan_proximo_id, nombre: vEstado.plan_proximo_nombre ?? "" }
          : null,
        cambioProgramadoPara: vEstado?.cambio_programado_para ?? null,
        // NUEVO BLOQUE de estado consolidado para guards de front
        estado: {
          suspendida: empresaInfo.suspendida,
          motivo: empresaInfo.suspension_motivo ?? null,
          plan_vencido,
          dias_desde_vencimiento,
          en_periodo_gracia,
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
