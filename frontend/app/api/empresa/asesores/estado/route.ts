// frontend/app/api/empresa/asesores/estado/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ADMIN_ROLES = new Set([
  "soporte",
  "super_admin",
  "super_admin_root",
]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorJson(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function todayDateOnlyUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function fallbackLimit(plan: {
  nombre?: string | null;
  nombre_comercial?: string | null;
  tier_plan?: string | null;
  es_trial?: boolean | null;
}): number {
  if (plan.es_trial === true) return 0;

  const value = `${plan.nombre || ""} ${plan.nombre_comercial || ""} ${
    plan.tier_plan || ""
  }`.toLowerCase();

  if (value.includes("broker") || value.includes("inicial")) return 0;
  if (value.includes("equipo") || value.includes("pro")) return 5;
  if (value.includes("team pro") || value.includes("premium")) return 10;
  if (value.includes("enterprise") || value.includes("personalizado")) return 50;

  return 0;
}

function createAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getAuthenticatedContext(req: Request) {
  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) {
    return {
      error: errorJson("Faltan variables de entorno de Supabase.", 500),
    } as const;
  }

  const token = getBearerToken(req);
  if (!token) {
    return {
      error: errorJson("No autenticado. Falta token Bearer.", 401),
    } as const;
  }

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !authData.user) {
    return {
      error: errorJson("Sesión inválida o expirada.", 401),
    } as const;
  }

  const authUser = authData.user;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, user_id, role, empresa_id, email")
    .or(`id.eq.${authUser.id},user_id.eq.${authUser.id}`)
    .limit(1)
    .maybeSingle();

  if (profileError) {
    console.error("asesores/estado profile", profileError);
    return {
      error: errorJson("No se pudo validar el perfil del usuario.", 500),
    } as const;
  }

  if (!profile) {
    return {
      error: errorJson("No existe perfil asociado al usuario.", 403),
    } as const;
  }

  return { supabaseAdmin, authUser, profile } as const;
}

async function resolveEmpresaForCompany(
  supabaseAdmin: ReturnType<typeof createClient>,
  authUserId: string,
  profileEmpresaId: string | null
): Promise<string | null> {
  if (profileEmpresaId) {
    const { data } = await supabaseAdmin
      .from("empresas")
      .select("id")
      .eq("id", profileEmpresaId)
      .maybeSingle();

    if (data?.id) return data.id;
  }

  const { data } = await supabaseAdmin
    .from("empresas")
    .select("id")
    .eq("user_id", authUserId)
    .maybeSingle();

  return data?.id || null;
}

async function getEffectiveLimit(
  supabaseAdmin: ReturnType<typeof createClient>,
  empresaId: string
): Promise<{ limit: number; planName: string }> {
  const { data: empresaPlan, error: empresaPlanError } = await supabaseAdmin
    .from("empresas_planes")
    .select("id, plan_id, max_asesores_override")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (empresaPlanError || !empresaPlan?.plan_id) {
    throw new Error("La empresa no tiene un plan activo configurado.");
  }

  const today = todayDateOnlyUTC();

  const { data: agreements, error: agreementError } = await supabaseAdmin
    .from("empresa_acuerdos_comerciales")
    .select("id, plan_id, max_asesores_override, fecha_inicio, fecha_fin")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .lte("fecha_inicio", today)
    .or(`fecha_fin.is.null,fecha_fin.gte.${today}`)
    .order("fecha_inicio", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(25);

  if (agreementError) {
    console.warn("asesores/estado acuerdo", agreementError);
  }

  const agreementRows = Array.isArray(agreements) ? agreements : [];
  const agreement =
    agreementRows.find((item) => item.plan_id === empresaPlan.plan_id) ||
    agreementRows.find((item) => item.plan_id == null) ||
    agreementRows[0] ||
    null;

  const planId = agreement?.plan_id || empresaPlan.plan_id;

  const { data: plan, error: planError } = await supabaseAdmin
    .from("planes")
    .select(
      "id, nombre, nombre_comercial, tier_plan, max_asesores, es_trial"
    )
    .eq("id", planId)
    .maybeSingle();

  if (planError || !plan) {
    throw new Error("No se pudo leer la información del plan actual.");
  }

  let limit: number;

  if (
    agreement?.max_asesores_override !== null &&
    agreement?.max_asesores_override !== undefined &&
    Number.isFinite(Number(agreement.max_asesores_override))
  ) {
    limit = Number(agreement.max_asesores_override);
  } else if (
    empresaPlan.max_asesores_override !== null &&
    empresaPlan.max_asesores_override !== undefined &&
    Number.isFinite(Number(empresaPlan.max_asesores_override))
  ) {
    limit = Number(empresaPlan.max_asesores_override);
  } else if (
    plan.max_asesores !== null &&
    plan.max_asesores !== undefined &&
    Number.isFinite(Number(plan.max_asesores))
  ) {
    limit = Number(plan.max_asesores);
  } else {
    limit = fallbackLimit(plan);
  }

  return {
    limit,
    planName:
      String(plan.nombre_comercial || "").trim() ||
      String(plan.nombre || "").trim() ||
      "el plan actual",
  };
}

export async function GET(req: NextRequest) {
  try {
    const context = await getAuthenticatedContext(req);
    if ("error" in context) return context.error;

    const { supabaseAdmin, authUser, profile } = context;
    const role = String(profile.role || "");

    if (role !== "asesor") {
      return errorJson(
        "Esta consulta de acceso está disponible únicamente para asesores.",
        403
      );
    }

    const normalizedEmail = String(authUser.email || profile.email || "")
      .trim()
      .toLowerCase();

    let query = supabaseAdmin
      .from("asesores")
      .select("id, empresa_id, activo, email")
      .limit(1);

    if (normalizedEmail) {
      query = query.or(
        `id.eq.${authUser.id},email.ilike.${normalizedEmail}`
      );
    } else {
      query = query.eq("id", authUser.id);
    }

    const { data: advisor, error: advisorError } = await query.maybeSingle();

    if (advisorError) {
      console.error("GET asesores/estado", advisorError);
      return errorJson("No se pudo validar el estado del asesor.", 500);
    }

    if (!advisor) {
      return NextResponse.json(
        {
          activo: false,
          motivo: "asesor_no_registrado",
        },
        { status: 200, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const sameCompany =
      !profile.empresa_id || advisor.empresa_id === profile.empresa_id;

    const active = advisor.activo === true && sameCompany;

    return NextResponse.json(
      {
        activo: active,
        motivo: active
          ? null
          : sameCompany
          ? "asesor_desactivado"
          : "empresa_desincronizada",
        asesor_id: advisor.id,
        empresa_id: advisor.empresa_id,
      },
      { status: 200, headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("GET asesores/estado unexpected", error);
    return errorJson("Error inesperado al validar el acceso.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await getAuthenticatedContext(req);
    if ("error" in context) return context.error;

    const { supabaseAdmin, authUser, profile } = context;
    const role = String(profile.role || "");
    const isAdminLike = ADMIN_ROLES.has(role);

    if (role !== "empresa" && !isAdminLike) {
      return errorJson("Rol no autorizado para administrar asesores.", 403);
    }

    const body = await req.json().catch(() => null);
    const asesorId = body?.asesor_id;
    const requestedEmpresaId = body?.empresa_id;
    const active = body?.activo;

    if (!isUuid(asesorId)) {
      return errorJson("asesor_id no es válido.", 400);
    }

    if (typeof active !== "boolean") {
      return errorJson("activo debe ser booleano.", 400);
    }

    const { data: advisor, error: advisorError } = await supabaseAdmin
      .from("asesores")
      .select("id, empresa_id, nombre, apellido, email, activo")
      .eq("id", asesorId)
      .maybeSingle();

    if (advisorError) {
      console.error("POST asesores/estado advisor", advisorError);
      return errorJson("No se pudo validar el asesor indicado.", 500);
    }

    if (!advisor) return errorJson("Asesor no encontrado.", 404);

    let empresaId: string | null = null;

    if (role === "empresa") {
      empresaId = await resolveEmpresaForCompany(
        supabaseAdmin,
        authUser.id,
        profile.empresa_id
      );

      if (!empresaId) {
        return errorJson("No se encontró empresa asociada al usuario.", 403);
      }

      if (advisor.empresa_id !== empresaId) {
        return errorJson("El asesor no pertenece a tu empresa.", 403);
      }
    } else {
      if (requestedEmpresaId && !isUuid(requestedEmpresaId)) {
        return errorJson("empresa_id no es válido.", 400);
      }

      empresaId = requestedEmpresaId || advisor.empresa_id;

      if (advisor.empresa_id !== empresaId) {
        return errorJson("El asesor no pertenece a la empresa indicada.", 400);
      }
    }

    if (advisor.activo === active) {
      return NextResponse.json(
        {
          ok: true,
          asesor_id: advisor.id,
          activo: advisor.activo,
          sin_cambios: true,
        },
        { status: 200 }
      );
    }

    if (active) {
      let effective;

      try {
        effective = await getEffectiveLimit(supabaseAdmin, empresaId);
      } catch (limitError) {
        return errorJson(
          limitError instanceof Error
            ? limitError.message
            : "No se pudo validar el cupo disponible.",
          409
        );
      }

      const { count, error: countError } = await supabaseAdmin
        .from("asesores")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("activo", true);

      if (countError) {
        return errorJson(
          "No se pudo contar la cantidad de asesores activos.",
          500
        );
      }

      const current = count || 0;

      if (effective.limit >= 0 && current >= effective.limit) {
        return errorJson(
          `No hay cupo disponible para reactivar al asesor. ${effective.planName}: ${current}/${effective.limit} asesores activos.`,
          409
        );
      }
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("asesores")
      .update({ activo: active })
      .eq("id", advisor.id)
      .eq("empresa_id", empresaId)
      .select("id, empresa_id, activo")
      .single();

    if (updateError) {
      console.error("POST asesores/estado update", updateError);
      return errorJson("No se pudo actualizar el estado del asesor.", 500);
    }

    if (!active) {
      const normalizedEmail = String(advisor.email || "").trim().toLowerCase();

      const { data: advisorProfile, error: advisorProfileError } =
        await supabaseAdmin
          .from("profiles")
          .select("id, user_id")
          .or(
            normalizedEmail
              ? `id.eq.${advisor.id},user_id.eq.${advisor.id},email.ilike.${normalizedEmail}`
              : `id.eq.${advisor.id},user_id.eq.${advisor.id}`
          )
          .limit(1)
          .maybeSingle();

      if (advisorProfileError) {
        console.warn("asesores/estado profile asesor", advisorProfileError);
      }

      const authUserId = advisorProfile?.user_id || advisorProfile?.id || advisor.id;

      try {
        const adminAuth = supabaseAdmin.auth.admin as unknown as {
          signOut?: (
            userId: string,
            scope?: "global" | "local" | "others"
          ) => Promise<{ error: unknown }>;
        };

        if (typeof adminAuth.signOut === "function") {
          const { error: signOutError } = await adminAuth.signOut(
            authUserId,
            "global"
          );

          if (signOutError) {
            console.warn("asesores/estado signOut", signOutError);
          }
        }
      } catch (signOutError) {
        console.warn("asesores/estado signOut unexpected", signOutError);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        asesor_id: updated.id,
        empresa_id: updated.empresa_id,
        activo: updated.activo,
        mensaje: active
          ? "Asesor reactivado correctamente."
          : "Asesor desactivado. Su historial fue conservado.",
      },
      { status: 200, headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("POST asesores/estado unexpected", error);
    return errorJson("Error inesperado al actualizar el asesor.", 500);
  }
}
