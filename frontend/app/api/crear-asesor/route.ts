import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Role =
  | "empresa"
  | "asesor"
  | "soporte"
  | "super_admin"
  | "super_admin_root"
  | string;

type ActorProfile = {
  role: Role | null;
  empresa_id: string | null;
};

function normalizarTexto(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function normalizarEmail(value: string | null | undefined): string {
  return normalizarTexto(value);
}

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

// 🧮 Fallback conservador por si faltara max_asesores en BD
function getLimiteFallback(plan: {
  nombre?: string | null;
  nombre_comercial?: string | null;
  tipo_plan?: string | null;
  tier_plan?: string | null;
  es_trial?: boolean | null;
}): number {
  if (plan?.es_trial) return 0;

  const nombre = normalizarTexto(plan?.nombre);
  const nombreComercial = normalizarTexto(plan?.nombre_comercial);
  const tipoPlan = normalizarTexto(plan?.tipo_plan);
  const tierPlan = normalizarTexto(plan?.tier_plan);

  if (tipoPlan === "trial" || nombre === "trial" || nombreComercial === "trial") {
    return 0;
  }

  if (tipoPlan === "core" || tipoPlan === "combo" || tipoPlan === "tracker_only") {
    switch (tierPlan) {
      case "inicial":
        return 4;
      case "pro":
        return 10;
      case "premium":
        return 20;
      case "personalizado":
        return 50;
      default:
        break;
    }
  }

  if (nombre.includes("desarrollo") || nombreComercial.includes("desarrollo")) {
    return 50;
  }

  if (nombre.includes("personalizado") || nombreComercial.includes("personalizado")) {
    return 50;
  }

  if (nombre.includes("premium") || nombreComercial.includes("premium")) {
    return 20;
  }

  if (nombre === "pro" || nombreComercial === "pro") {
    return 10;
  }

  if (nombre === "inicial" || nombreComercial === "inicial") {
    return 4;
  }

  return 0;
}

async function resolveActorProfile(userId: string): Promise<ActorProfile> {
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
  // 1) Perfil vinculado
  const { data: prof } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (prof?.empresa_id) return prof.empresa_id as string;

  // 2) Fallback por id de profile
  const { data: profById } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("id", userId)
    .maybeSingle();

  if (profById?.empresa_id) return profById.empresa_id as string;

  // 3) Dueño directo de empresa
  const { data: emp } = await supabase
    .from("empresas")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  return (emp?.id as string) ?? null;
}

export async function POST(req: Request) {
  let createdUserId: string | null = null;

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

    const body = await req.json().catch(() => null as any);

    const empresaIdBody =
      typeof body?.empresaId === "string" ? body.empresaId.trim() : "";

    const nombre =
      typeof body?.nombre === "string" ? body.nombre.trim() : "";

    const apellido =
      typeof body?.apellido === "string" ? body.apellido.trim() : "";

    const email = normalizarEmail(body?.email);
    const telefono =
      typeof body?.telefono === "string" ? body.telefono.trim() : "";

    const password =
      typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios (email, password)." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }

    let empresaId: string | null = null;

    if (role === "empresa") {
      // Seguridad: una empresa NO puede decidir por body a qué empresa crear asesores.
      empresaId = actor.empresa_id || (await resolveEmpresaIdForUser(actorUserId));
    } else if (isAdminLike(role)) {
      // Admin / soporte sí pueden operar sobre una empresa explícita.
      empresaId = empresaIdBody || null;
    }

    if (!empresaId) {
      return NextResponse.json(
        {
          error: isAdminLike(role)
            ? "Falta empresaId para crear el asesor."
            : "No se pudo resolver la empresa del usuario autenticado.",
        },
        { status: 400 }
      );
    }

    const { data: empresaRow, error: empresaErr } = await supabase
      .from("empresas")
      .select("id, nombre_comercial, suspendida, suspension_motivo")
      .eq("id", empresaId)
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

    if (role === "empresa" && empresaRow.suspendida) {
      return NextResponse.json(
        {
          error:
            empresaRow.suspension_motivo ||
            "La cuenta se encuentra suspendida. No se pueden crear asesores.",
        },
        { status: 403 }
      );
    }

    // Evitar duplicados claros antes de crear usuario Auth.
    const { data: asesorExistente, error: asesorExistenteErr } = await supabase
      .from("asesores")
      .select("id, activo, empresa_id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (asesorExistenteErr) {
      console.warn("⚠️ Error verificando asesor existente:", asesorExistenteErr);
    }

    if (asesorExistente?.id) {
      return NextResponse.json(
        {
          error:
            asesorExistente.empresa_id === empresaId
              ? "Ya existe un asesor registrado con ese email en esta empresa."
              : "Ya existe un asesor registrado con ese email.",
        },
        { status: 409 }
      );
    }

    // 0) Verificar límite efectivo de asesores
    // prioridad:
    // 1) empresa_acuerdos_comerciales.max_asesores_override vigente
    // 2) empresas_planes.max_asesores_override
    // 3) planes.max_asesores
    // 4) fallback conservador
    // ------------------------------------------------

    const { data: empresaPlan, error: empresaPlanErr } = await supabase
      .from("empresas_planes")
      .select("id, plan_id, max_asesores_override")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .order("fecha_inicio", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (empresaPlanErr) {
      console.error("❌ Error buscando plan activo de la empresa:", empresaPlanErr);
      return NextResponse.json(
        { error: "No se pudo obtener el plan activo de la empresa." },
        { status: 500 }
      );
    }

    if (!empresaPlan?.plan_id) {
      return NextResponse.json(
        { error: "La empresa no tiene un plan activo configurado." },
        { status: 409 }
      );
    }

    const hoy = todayDateOnlyUTC();

    const { data: acuerdosData, error: acuerdoErr } = await supabase
      .from("empresa_acuerdos_comerciales")
      .select("id, plan_id, max_asesores_override, fecha_inicio, fecha_fin")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .lte("fecha_inicio", hoy)
      .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
      .order("fecha_inicio", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(25);

    if (acuerdoErr) {
      console.warn(
        "⚠️ No se pudo leer acuerdo comercial activo; se continúa con plan operativo:",
        acuerdoErr
      );
    }

    const acuerdos = Array.isArray(acuerdosData) ? acuerdosData : [];

    const acuerdoActivo =
      acuerdos.find((a: any) => a.plan_id === empresaPlan.plan_id) ||
      acuerdos.find((a: any) => a.plan_id == null) ||
      acuerdos[0] ||
      null;

    const planIdFuente = acuerdoActivo?.plan_id || empresaPlan.plan_id;

    const { data: planRow, error: planErr } = await supabase
      .from("planes")
      .select(
        "id, nombre, nombre_comercial, tipo_plan, tier_plan, max_asesores, es_trial"
      )
      .eq("id", planIdFuente)
      .maybeSingle();

    if (planErr) {
      console.error("❌ Error leyendo datos del plan:", planErr);
      return NextResponse.json(
        { error: "No se pudo leer la información del plan actual." },
        { status: 500 }
      );
    }

    if (!planRow) {
      return NextResponse.json(
        { error: "Plan activo no encontrado en la tabla de planes." },
        { status: 409 }
      );
    }

    let limiteAsesores: number;

    if (
      acuerdoActivo?.max_asesores_override !== null &&
      acuerdoActivo?.max_asesores_override !== undefined &&
      Number.isFinite(Number(acuerdoActivo.max_asesores_override))
    ) {
      limiteAsesores = Number(acuerdoActivo.max_asesores_override);
    } else if (
      empresaPlan.max_asesores_override !== null &&
      empresaPlan.max_asesores_override !== undefined &&
      Number.isFinite(Number(empresaPlan.max_asesores_override))
    ) {
      limiteAsesores = Number(empresaPlan.max_asesores_override);
    } else if (
      planRow.max_asesores !== null &&
      planRow.max_asesores !== undefined &&
      Number.isFinite(Number(planRow.max_asesores))
    ) {
      limiteAsesores = Number(planRow.max_asesores);
    } else {
      limiteAsesores = getLimiteFallback(planRow);
    }

    const { count: asesoresCount, error: asesoresCountErr } = await supabase
      .from("asesores")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("activo", true);

    if (asesoresCountErr) {
      console.error("❌ Error contando asesores activos:", asesoresCountErr);
      return NextResponse.json(
        { error: "No se pudo obtener la cantidad de asesores actuales." },
        { status: 500 }
      );
    }

    const actuales = asesoresCount || 0;

    if (limiteAsesores >= 0 && actuales >= limiteAsesores) {
      const nombrePlan =
        planRow.nombre_comercial?.trim() || planRow.nombre || "tu plan actual";

      return NextResponse.json(
        {
          error: `Has alcanzado el límite de asesores activos para ${nombrePlan} (${actuales}/${limiteAsesores}).`,
        },
        { status: 403 }
      );
    }

    // 1) Crear usuario en Auth como "asesor"
    // --------------------------------------
    const { data: userData, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nombre,
          apellido,
          telefono,
          role: "asesor",
          empresa_id: empresaId,
        },
      });

    if (createError) {
      console.error("❌ Error creando usuario auth:", createError);
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    const userId = userData.user?.id;
    createdUserId = userId ?? null;

    if (!userId) {
      return NextResponse.json(
        { error: "No se pudo obtener el id del usuario creado." },
        { status: 500 }
      );
    }

    // 2) UPSERT en profiles
    // ---------------------
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        [
          {
            id: userId,
            user_id: userId,
            email,
            nombre: nombre || null,
            apellido: apellido || null,
            telefono: telefono || null,
            role: "asesor",
            empresa_id: empresaId,
          },
        ],
        { onConflict: "id" }
      );

    if (profileError) {
      console.error("❌ Error upsert profiles:", profileError);
      await supabase.auth.admin.deleteUser(userId);
      createdUserId = null;

      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    // 3) Insertar en tabla asesores
    // -----------------------------
    const { error: insertError } = await supabase.from("asesores").insert([
      {
        id: userId,
        empresa_id: empresaId,
        nombre,
        apellido,
        email,
        telefono,
        activo: true,
        fecha_creacion: new Date().toISOString(),
      },
    ]);

    if (insertError) {
      console.error("❌ Error insertando asesor en tabla:", insertError);
      await supabase.auth.admin.deleteUser(userId);
      await supabase.from("profiles").delete().eq("id", userId);
      createdUserId = null;

      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Asesor creado correctamente.",
      user_id: userId,
      empresa_id: empresaId,
      cupo: {
        actuales: actuales + 1,
        limite: limiteAsesores,
      },
    });
  } catch (err) {
    console.error("💥 Error interno en /api/crear-asesor:", err);

    if (createdUserId) {
      try {
        await supabase.auth.admin.deleteUser(createdUserId);
        await supabase.from("profiles").delete().eq("id", createdUserId);
      } catch (cleanupErr) {
        console.warn("⚠️ Error limpiando usuario creado parcialmente:", cleanupErr);
      }
    }

    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
