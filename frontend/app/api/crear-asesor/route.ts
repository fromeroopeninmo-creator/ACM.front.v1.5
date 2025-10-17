import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚙️ Service Role (server-side)
);

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

    // 1) Crear usuario en Auth como "asesor"
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
