import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Variables de entorno requeridas:
// - NEXT_PUBLIC_SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY  (⚠️ nunca exponer esta al cliente)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Lista blanca de campos permitidos
const ALLOWED_FIELDS = new Set([
  "nombre_comercial",
  "razon_social",
  "cuit",
  "matriculado",
  "cpi",
  "telefono",
  "direccion",
  "localidad",
  "provincia",
  "condicion_fiscal",
  "color",
  "logo_url",
]);

export async function PATCH(req: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("❌ Falta SUPABASE url o service role key");
      return NextResponse.json(
        { error: "Faltan variables de entorno de Supabase" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const user_id = body?.user_id as string | undefined;
    const empresa_id = body?.empresa_id as string | undefined;
    const update = (body?.update ?? {}) as Record<string, any>;

    if ((!user_id && !empresa_id) || typeof update !== "object") {
      return NextResponse.json(
        { error: "Payload inválido. Se requiere { user_id | empresa_id, update }" },
        { status: 400 }
      );
    }

    // Saneamos el update con lista blanca
    const clean: Record<string, any> = {};
    for (const k of Object.keys(update)) {
      if (ALLOWED_FIELDS.has(k)) clean[k] = update[k];
    }
    // Protección adicional
    delete (clean as any).a;
    delete (clean as any)["a.color"];
    delete (clean as any)["a.logo_url"];
    delete (clean as any).id;
    delete (clean as any).user_id;
    delete (clean as any).created_at;
    delete (clean as any).updated_at;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Prefer: "return=minimal" } },
    });

    // Elegimos el filtro según venga user_id o empresa_id
    const query = admin.from("empresas").update(clean);
    const filtered = user_id
      ? query.eq("user_id", user_id)
      : query.eq("id", empresa_id!);

    const { error } = await filtered;

    if (error) {
      console.error("❌ Supabase update error:", error);
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("❌ API internal error:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Error interno" },
      { status: 500 }
    );
  }
}
