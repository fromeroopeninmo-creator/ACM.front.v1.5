import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚙️ Service Role (server-side)
);

function normalizarTexto(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { empresaId, nombre, apellido, email, telefono, password } = body;

    if (!empresaId || !email || !password) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios (empresaId, email, password)." },
        { status: 400 }
      );
    }

    // 0) Verificar límite efectivo de asesores
    // prioridad:
    // 1) empresa_acuerdos_comerciales.max_asesores_override
    // 2) empresas_planes.max_asesores_override
    // 3) planes.max_asesores
    // 4) fallback conservador
    // ------------------------------------------------

    const { data: empresaPlan, error: empresaPlanErr } = await supabase
      .from("empresas_planes")
      .select("plan_id, max_asesores_override")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
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

    let acuerdoActivo: {
      plan_id?: string | null;
      max_asesores_override?: number | null;
    } | null = null;

    const { data: acuerdoData, error: acuerdoErr } = await supabase
      .from("empresa_acuerdos_comerciales")
      .select("plan_id, max_asesores_override")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .maybeSingle();

    if (acuerdoErr) {
      console.warn(
        "⚠️ No se pudo leer acuerdo comercial activo; se continúa con plan operativo:",
        acuerdoErr
      );
    } else if (acuerdoData) {
      acuerdoActivo = acuerdoData;
    }

    const planIdFuente = acuerdoActivo?.plan_id || empresaPlan.plan_id;

    const { data: planRow, error: planErr } = await supabase
      .from("planes")
      .select("id, nombre, nombre_comercial, tipo_plan, tier_plan, max_asesores, es_trial")
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

    if (typeof acuerdoActivo?.max_asesores_override === "number") {
      limiteAsesores = acuerdoActivo.max_asesores_override;
    } else if (typeof empresaPlan.max_asesores_override === "number") {
      limiteAsesores = empresaPlan.max_asesores_override;
    } else if (typeof planRow.max_asesores === "number") {
      limiteAsesores = planRow.max_asesores;
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
          nombre: nombre || "",
          apellido: apellido || "",
          telefono: telefono || "",
          role: "asesor",
          empresa_id: empresaId,
        },
      });

    if (createError) {
      console.error("❌ Error creando usuario auth:", createError);
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    const userId = userData.user?.id;
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
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Asesor creado correctamente.",
      user_id: userId,
    });
  } catch (err) {
    console.error("💥 Error interno en /api/crear-asesor:", err);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
