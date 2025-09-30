import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabaseClient";

export async function POST() {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    return NextResponse.json({ status: "ok", message: "Logout exitoso" });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err.message },
      { status: 400 }
    );
  }
}
