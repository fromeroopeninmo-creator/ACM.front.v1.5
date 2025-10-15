import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚙️ clave de administrador
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { empresaId, nombre, apellido, email, telefono, password } = body;

    if (!empresaId || !email || !password) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios." },
        { status: 400 }
      );
    }

    // 🔹 Crear usuario en Auth (como asesor)
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
      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      );
    }

    const userId = userData.user?.id;

    // 🔹 Insertar en tabla asesores
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
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Asesor creado correctamente.",
    });
  } catch (err) {
    console.error("💥 Error interno en /api/crear-asesor:", err);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
