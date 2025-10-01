import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";


export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    return NextResponse.json({ status: "ok", session: data.session });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err.message },
      { status: 400 }
    );
  }
}
