// app/api/empresa/ensure/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function POST() {
  try {
    const server = supabaseServer();
    const {
      data: { user },
      error: authErr,
    } = await server.auth.getUser();

    if (authErr || !user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userId = user.id;

    // Validar el rol real antes de utilizar service_role.
    let profile: { role: string | null } | null = null;

    const { data: profileByUserId, error: profileByUserIdError } =
      await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

    if (!profileByUserIdError && profileByUserId) {
      profile = { role: profileByUserId.role ?? null };
    }

    if (!profile) {
      const { data: profileById, error: profileByIdError } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (profileByIdError) {
        return NextResponse.json(
          { error: `No se pudo validar el perfil: ${profileByIdError.message}` },
          { status: 400 }
        );
      }

      profile = profileById ? { role: profileById.role ?? null } : null;
    }

    const metadataRole =
      user.user_metadata?.role ?? user.app_metadata?.role ?? null;
    const role = String(profile?.role ?? metadataRole ?? "").toLowerCase();

    if (role !== "empresa") {
      return NextResponse.json(
        { error: "Esta operación está disponible únicamente para cuentas empresa." },
        { status: 403 }
      );
    }

    // Compatibilidad histórica: empresas.user_id o empresas.id_usuario.
    const { data: existing, error: empErr } = await supabaseAdmin
      .from("empresas")
      .select("*")
      .or(`user_id.eq.${userId},id_usuario.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (empErr) {
      return NextResponse.json({ error: empErr.message }, { status: 400 });
    }

    if (existing) {
      return NextResponse.json({ ok: true, empresa: existing }, { status: 200 });
    }

    // Se conserva la función de onboarding, pero ya no se ejecuta desde el dashboard.
    const meta: any = user.user_metadata || {};

    const insert = {
      user_id: userId,
      nombre_comercial:
        meta.inmobiliaria ||
        meta.empresa ||
        meta.razon_social ||
        meta.nombre ||
        user.email,
      razon_social: meta.razon_social || null,
      condicion_fiscal: meta.condicion_fiscal || null,
      matriculado: meta.matriculado || meta.matriculado_nombre || null,
      cpi: meta.cpi || null,
      telefono: meta.telefono || null,
    };

    const { data: created, error: insErr } = await supabaseAdmin
      .from("empresas")
      .insert(insert)
      .select()
      .maybeSingle();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, empresa: created }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Error inesperado",
      },
      { status: 500 }
    );
  }
}
