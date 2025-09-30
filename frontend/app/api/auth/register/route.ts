import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const { email, password, fullName, matriculado, cpi } = await req.json();

    // Crear usuario en Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    // Si se creó bien, guardamos datos adicionales en la tabla profiles
    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: data.user.id,
          full_name: fullName || null,
          matriculado: matriculado || null,
          cpi: cpi || null,
        });

      if (profileError) throw profileError;
    }

    return NextResponse.json({ status: "ok", user: data.user });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err.message },
      { status: 400 }
    );
  }
}
