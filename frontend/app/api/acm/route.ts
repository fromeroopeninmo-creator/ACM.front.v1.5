import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Guardar en la tabla acm_analysis
    const { data, error } = await supabase
      .from("acm_analysis")
      .insert([{ user_id: body.userId, data: body.formData }])
      .select();

    if (error) {
      console.error("Supabase insert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
