import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚙️ Service Role (server-side)
);

// 🧮 Lógica de límites por plan (fallback si la base no trae max_asesores)
function getLimitePorNombrePlan(nombrePlanRaw: string | null | undefined): number {
  const nombrePlan = (nombrePlanRaw || "").trim().toLowerCase();

  switch (nombrePlan) {
    case "trial":
    case "prueba":
      return 0; // no permite asesores
    case "inicial":
      return 4;
    case "pro":
      return 10;
    case "premium":
      return 20;
    case "personalizado":
    case "desarrollo":
      return 50; // límite “hard” por defecto si no hay override
    default:
      // si llegamos acá, mejor ser conservadores
      return 0;
  }
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

    // 0) Verificar límite de asesores según plan activo
    // ------------------------------------------------

    // 0.1) Buscar plan activo de la empresa
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

    // 0.2) Leer los datos del plan
    const { data: planRow, error: planErr } = await supabase
      .from("planes")
      .select("id, nombre, max_asesores")
      .eq("id", empresaPlan.plan_id)
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

    // 0.3) Calcular límite efectivo:
    //     prioridad:
    //     1) max_asesores_override de empresas_planes (personalizado)
    //     2) max_asesores de la tabla planes
    //     3) fallback por nombre del plan
    let limiteAsesores: number;

    if (typeof empresaPlan.max_asesores_override === "number") {
      limiteAsesores = empresaPlan.max_asesores_override;
    } else if (typeof planRow.max_asesores === "number") {
      limiteAsesores = planRow.max_asesores;
    } else {
      limiteAsesores = getLimitePorNombrePlan(planRow.nombre);
    }

    // 0.4) Contar asesores activos actuales
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

    // 0.5) Chequear límite
    if (limiteAsesores >= 0 && actuales >= limiteAsesores) {
      const nombrePlan = planRow.nombre || "tu plan actual";
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

    // 2) UPSERT en profiles (clave para heredar empresa_id en el frontend con RLS)
    // ----------------------------------------------------------------------------
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
      // cleanup: borrar user auth creado para no dejarlo huérfano
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    // 3) Insertar en tabla asesores (tu tabla operativa)
    // --------------------------------------------------
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
      // cleanup: borrar user auth y profile
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
