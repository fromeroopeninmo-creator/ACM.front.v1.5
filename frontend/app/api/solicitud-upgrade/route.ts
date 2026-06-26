// app/api/solicitud-upgrade/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role =
  | "empresa"
  | "asesor"
  | "soporte"
  | "super_admin"
  | "super_admin_root"
  | string;

function todayDateOnlyUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function isAdminLike(role?: Role | null): boolean {
  return (
    role === "soporte" ||
    role === "super_admin" ||
    role === "super_admin_root"
  );
}

async function resolveActorProfile(userId: string): Promise<{
  role: Role | null;
  empresa_id: string | null;
}> {
  const { data: p1, error: p1Err } = await supabase
    .from("profiles")
    .select("role, empresa_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!p1Err && p1) {
    return {
      role: (p1.role as Role) ?? null,
      empresa_id: (p1.empresa_id as string) ?? null,
    };
  }

  const { data: p2, error: p2Err } = await supabase
    .from("profiles")
    .select("role, empresa_id")
    .eq("id", userId)
    .maybeSingle();

  if (!p2Err && p2) {
    return {
      role: (p2.role as Role) ?? null,
      empresa_id: (p2.empresa_id as string) ?? null,
    };
  }

  return {
    role: null,
    empresa_id: null,
  };
}

async function resolveEmpresaIdForUser(userId: string): Promise<string | null> {
  const { data: prof } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (prof?.empresa_id) return prof.empresa_id as string;

  const { data: profById } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("id", userId)
    .maybeSingle();

  if (profById?.empresa_id) return profById.empresa_id as string;

  const { data: emp } = await supabase
    .from("empresas")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  return (emp?.id as string) ?? null;
}

/** Solo admins pueden pasar empresas.id o empresas.user_id y resolver empresas.id real */
async function resolverEmpresaIdAdmin(
  empresaIdOUserId: string
): Promise<string | null> {
  const id = String(empresaIdOUserId || "").trim();
  if (!id) return null;

  // 1) probar como empresas.id
  const { data: empPorId } = await supabase
    .from("empresas")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (empPorId?.id) return empPorId.id;

  // 2) probar como empresas.user_id
  const { data: empPorUser } = await supabase
    .from("empresas")
    .select("id")
    .eq("user_id", id)
    .maybeSingle();

  return empPorUser?.id ?? null;
}

function addDaysISO(dateISO: string, days: number) {
  const d = new Date(dateISO);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function tieneAcuerdoComercialVigente(empresaId: string) {
  const hoy = todayDateOnlyUTC();

  const { data, error } = await supabase
    .from("empresa_acuerdos_comerciales")
    .select("id, plan_id, fecha_inicio, fecha_fin, activo")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .lte("fecha_inicio", hoy)
    .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(
      "⚠️ No se pudo verificar acuerdo comercial vigente:",
      error.message
    );
    return false;
  }

  return !!data?.id;
}

export async function POST(request: Request) {
  try {
    const server = supabaseServer();
    const { data: auth, error: authErr } = await server.auth.getUser();

    if (authErr || !auth?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado." },
        { status: 401 }
      );
    }

    const actorUserId = auth.user.id;
    const actor = await resolveActorProfile(actorUserId);
    const role = actor.role;

    const allowedRoles: Role[] = [
      "empresa",
      "soporte",
      "super_admin",
      "super_admin_root",
    ];

    if (!role || !allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Acceso denegado." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const empresaIdBody =
      typeof body?.empresaId === "string" ? body.empresaId.trim() : "";

    const planId =
      typeof body?.planId === "string" ? body.planId.trim() : "";

    const maxAsesoresOverride = body?.maxAsesoresOverride;

    if (!planId) {
      return NextResponse.json(
        { error: "Falta dato obligatorio: planId." },
        { status: 400 }
      );
    }

    let empresaIdReal: string | null = null;

    if (role === "empresa") {
      /**
       * Seguridad:
       * Una empresa NO puede decidir por body qué empresa modificar.
       * La empresa se deriva exclusivamente del usuario autenticado.
       */
      empresaIdReal =
        actor.empresa_id || (await resolveEmpresaIdForUser(actorUserId));
    } else if (isAdminLike(role)) {
      /**
       * Soporte/Admin sí pueden operar sobre una empresa indicada.
       */
      if (!empresaIdBody) {
        return NextResponse.json(
          { error: "Falta empresaId para operar como admin/soporte." },
          { status: 400 }
        );
      }

      empresaIdReal = await resolverEmpresaIdAdmin(empresaIdBody);
    }

    if (!empresaIdReal) {
      return NextResponse.json(
        {
          error: isAdminLike(role)
            ? "Empresa no encontrada para el identificador provisto."
            : "No se pudo resolver la empresa del usuario autenticado.",
        },
        { status: 404 }
      );
    }

    const { data: empresaRow, error: empresaErr } = await supabase
      .from("empresas")
      .select("id, nombre_comercial, suspendida, suspension_motivo")
      .eq("id", empresaIdReal)
      .maybeSingle();

    if (empresaErr) {
      console.error("❌ Error verificando empresa:", empresaErr);
      return NextResponse.json(
        { error: "No se pudo verificar la empresa." },
        { status: 500 }
      );
    }

    if (!empresaRow) {
      return NextResponse.json(
        { error: "Empresa no encontrada." },
        { status: 404 }
      );
    }

    /**
     * Importante:
     * Este endpoint viejo activaba planes directamente.
     * Para empresas normales, eso saltea checkout/webhook/prorrateo.
     * Por seguridad, las empresas deben usar /api/billing/change-plan o /api/billing/checkout.
     */
    if (role === "empresa") {
      return NextResponse.json(
        {
          error:
            "Este flujo fue reemplazado por el flujo seguro de billing. Para cambiar de plan, utilizá el portal de planes.",
          next: "/dashboard/empresa/planes",
        },
        { status: 409 }
      );
    }

    /**
     * Admin/soporte pueden usar este endpoint como herramienta operativa/manual.
     * Igual bloqueamos acuerdos comerciales vigentes para evitar pisar condiciones pactadas.
     */
    const acuerdoVigente = await tieneAcuerdoComercialVigente(empresaIdReal);

    if (acuerdoVigente) {
      return NextResponse.json(
        {
          error:
            "La empresa posee un acuerdo comercial vigente. Los cambios de plan/cupo deben gestionarse desde el módulo administrativo de acuerdos.",
        },
        { status: 409 }
      );
    }

    // Traer plan destino
    const { data: plan, error: planError } = await supabase
      .from("planes")
      .select(
        "id, nombre, nombre_comercial, duracion_dias, max_asesores, tipo_plan, tier_plan, es_trial, es_desarrollo"
      )
      .eq("id", planId)
      .maybeSingle();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "No se encontró el plan solicitado." },
        { status: 404 }
      );
    }

    if ((plan as any).es_trial) {
      return NextResponse.json(
        {
          error:
            "No se puede activar Trial desde solicitud-upgrade. El Trial se asigna únicamente desde onboarding/bootstrap.",
        },
        { status: 409 }
      );
    }

    const tipoPlan = String((plan as any).tipo_plan || "").toLowerCase();
    const tierPlan = String((plan as any).tier_plan || "").toLowerCase();
    const nombrePlan = String(
      (plan as any).nombre_comercial || (plan as any).nombre || ""
    ).toLowerCase();

    let override: number | null = null;

    // Validación para personalizados (override 21..50)
    const esPersonalizado =
      tierPlan === "personalizado" ||
      nombrePlan.includes("personalizado");

    if (esPersonalizado) {
      const ov = Number(maxAsesoresOverride);

      if (!Number.isFinite(ov) || ov < 21 || ov > 50) {
        return NextResponse.json(
          {
            error:
              "Para planes personalizados, maxAsesoresOverride debe estar entre 21 y 50.",
          },
          { status: 400 }
        );
      }

      override = ov;
    }

    // Plan actual (para decidir si ya está y si coincide el override)
    const { data: planActual, error: planActualErr } = await supabase
      .from("empresas_planes")
      .select("id, plan_id, activo, max_asesores_override")
      .eq("empresa_id", empresaIdReal)
      .eq("activo", true)
      .order("fecha_inicio", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (planActualErr) {
      console.error("❌ Error leyendo plan actual:", planActualErr);
      return NextResponse.json(
        { error: "No se pudo leer el plan actual de la empresa." },
        { status: 500 }
      );
    }

    if (planActual && planActual.plan_id === plan.id) {
      const mismoOverride =
        !esPersonalizado ||
        Number((planActual as any).max_asesores_override ?? null) === override;

      if (mismoOverride) {
        return NextResponse.json({
          success: true,
          message:
            esPersonalizado && override !== null
              ? `✅ La empresa ya está en "${plan.nombre}" con ${override} asesores.`
              : `✅ La empresa ya está en el plan "${plan.nombre}".`,
        });
      }
      // si es el mismo plan pero cambió el override, seguimos para actualizar
    }

    // Fechas
    const hoy = new Date();
    const fecha_inicio = hoy.toISOString().slice(0, 10);
    const dur = Number((plan as any).duracion_dias) || 30;
    const fecha_fin = addDaysISO(fecha_inicio, dur);

    const now = new Date().toISOString();

    // Desactivar planes previos activos
    const { error: deactivateErr } = await supabase
      .from("empresas_planes")
      .update({ activo: false, updated_at: now })
      .eq("empresa_id", empresaIdReal)
      .eq("activo", true);

    if (deactivateErr) {
      console.error("❌ Error al desactivar plan previo:", deactivateErr);
      return NextResponse.json(
        { error: "No se pudo desactivar el plan anterior." },
        { status: 500 }
      );
    }

    // Insertar nuevo plan activo (con override si corresponde)
    const insertPayload: any = {
      empresa_id: empresaIdReal,
      plan_id: plan.id,
      fecha_inicio,
      fecha_fin,
      activo: true,
      created_at: now,
      updated_at: now,
    };

    if (override !== null) {
      insertPayload.max_asesores_override = override;
    }

    const { data: nuevoPlan, error: insertErr } = await supabase
      .from("empresas_planes")
      .insert([insertPayload])
      .select(
        "id, empresa_id, plan_id, fecha_inicio, fecha_fin, activo, max_asesores_override"
      )
      .maybeSingle();

    if (insertErr || !nuevoPlan) {
      console.error("❌ Error al insertar nuevo plan:", insertErr);
      return NextResponse.json(
        { error: "No se pudo activar el nuevo plan." },
        { status: 500 }
      );
    }

    // Actualizar empresas.plan_activo_id y limpiar suspensión de billing/manual solo si admin está activando plan
    const { error: updEmpErr } = await supabase
      .from("empresas")
      .update({
        plan_activo_id: plan.id,
        suspendida: false,
        suspendida_at: null,
        suspension_motivo: null,
        updated_at: now,
      })
      .eq("id", empresaIdReal);

    if (updEmpErr) {
      console.warn(
        "⚠️ No se pudo actualizar empresas.plan_activo_id/suspensión:",
        updEmpErr?.message
      );
    }

    // Log histórico
    const { error: logErr } = await supabase
      .from("solicitudes_upgrade")
      .insert([
        {
          empresa_id: empresaIdReal,
          plan_id: plan.id,
          estado: "aprobada_auto",
          comentario_admin:
            override !== null
              ? `Cambio automático por ${role} con override (${override} asesores).`
              : `Cambio automático por ${role} (sin override).`,
          notificado: false,
          fecha_solicitud: now,
        },
      ]);

    if (logErr) {
      console.warn(
        "⚠️ No se pudo registrar el log de solicitud:",
        logErr?.message
      );
    }

    return NextResponse.json({
      success: true,
      message:
        override !== null
          ? `✅ Plan "${plan.nombre}" activado correctamente. Cupo: ${override} asesores.`
          : `✅ Plan "${plan.nombre}" activado correctamente.`,
      data: nuevoPlan,
      empresa_id: empresaIdReal,
      operated_by: {
        user_id: actorUserId,
        role,
      },
      plan: {
        id: plan.id,
        nombre: plan.nombre,
        tipo_plan: tipoPlan || null,
        tier_plan: tierPlan || null,
      },
    });
  } catch (err) {
    console.error("💥 Error interno en /api/solicitud-upgrade:", err);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
