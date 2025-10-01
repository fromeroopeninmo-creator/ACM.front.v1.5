import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";


export async function POST(req: Request) {
  try {
    const { email, password, matriculado_name, cpi } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { status: "error", message: "Email y password son requeridos" },
        { status: 400 }
      );
    }

    // Crear usuario en Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { status: "error", message: error.message },
        { status: 400 }
      );
    }

    const user = data.user;
    if (!user) {
      return NextResponse.json(
        { status: "error", message: "No se pudo crear el usuario" },
        { status: 400 }
      );
    }

    // Insertar registro en profiles
    const { error: profileError } = await supabase.from("profiles").insert([
      {
        id: user.id,
        matriculado_name: matriculado_name || "",
        cpi: cpi || "",
      },
    ]);

    if (profileError) {
      return NextResponse.json(
        { status: "error", message: profileError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ status: "success", user });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
