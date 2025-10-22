// app/api/informes/create/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

// ============================
// Helpers
// ============================
type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

function sanitizeDatos(datos: any) {
  // Limpieza por las dudas (evitar guardar base64 enormes en datos_json)
  const clone = JSON.parse(JSON.stringify(datos || {}));
  if (clone?.mainPhotoBase64) clone.mainPhotoBase64 = undefined;
  if (Array.isArray(clone?.comparables)) {
    clone.comparables = clone.comparables.map((c: any) => ({
      ...c,
      photoBase64: undefined,
    }));
  }
  return clone;
}

async function resolveEmpresaYAsesor(userId: string) {
  // 1) usuario-empresa dueño directo
  const { data: emp } = await supabaseAdmin
    .from("empresas")
    .select("id, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (emp?.id) {
    return { empresaId: emp.id as string, asesorId: null as string | null, role: "empresa" as Role };
  }

  // 2) profile (asesor con empresa asociada)
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("id, role, empresa_id")
    .eq("id", userId)
    .maybeSingle();

  const role = (prof?.role as Role) || "empresa";
  const empresaId = prof?.empresa_id ?? null;
  const asesorId = role === "asesor" ? prof?.id ?? null : null;

  return { empresaId, asesorId, role };
}

// ============================
// POST (create o update)
// ============================
export async function POST(req: Request) {
  try {
    // 1) Usuario autenticado desde cookies (SSR)
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // 2) Body
    const body = await req.json().catch(() => null as any);
    const { id, datos, titulo = "Informe VAI" } = body || {};
    if (!datos) {
      return NextResponse.json({ error: "Faltan 'datos'." }, { status: 400 });
    }

    // 3) Resolver empresa/asesor y rol
    const { empresaId, asesorId, role } = await resolveEmpresaYAsesor(userId);
    if (!empresaId && !["soporte", "super_admin", "super_admin_root"].includes(role)) {
      return NextResponse.json(
        { error: "No se pudo determinar la empresa del usuario." },
        { status: 400 }
      );
    }

    // 4) Sanitizar datos_json
    const datosLimpios = sanitizeDatos(datos);

    // 5) UPDATE si viene id
    if (id) {
      const { data: existente, error: getErr } = await supabaseAdmin
        .from("informes")
        .select("id, empresa_id, autor_id")
        .eq("id", id)
        .maybeSingle();

      if (getErr) return NextResponse.json({ error: getErr.message }, { status: 400 });
      if (!existente) return NextResponse.json({ error: "Informe no encontrado." }, { status: 404 });

      // Permisos
      if (role === "empresa" && existente.empresa_id !== empresaId) {
        return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
      }
      if (role === "asesor" && existente.autor_id !== userId) {
        return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
      }

      const { data: updated, error: updErr } = await supabaseAdmin
        .from("informes")
        .update({
          titulo,
          datos_json: datosLimpios,
        })
        .eq("id", id)
        .select()
        .maybeSingle();

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
      return NextResponse.json({ ok: true, informe: updated }, { status: 200 });
    }

    // 6) INSERT si no viene id
    let informeId: string;
    try {
      const { data: idGen } = await supabaseAdmin.rpc("uuid_generate_v4");
      // @ts-ignore
      informeId = idGen ?? crypto.randomUUID();
    } catch {
      // @ts-ignore
      informeId = crypto.randomUUID();
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("informes")
      .insert({
        id: informeId,
        empresa_id: empresaId ?? null,
        asesor_id: asesorId ?? null, // <<<<<< IMPORTANTE para luego mostrar "Creado por"
        autor_id: userId,            // quién creó (empresa user o asesor user)
        tipo: "VAI",
        titulo,
        datos_json: datosLimpios,
        estado: "borrador",
        etiquetas: [],
      })
      .select()
      .maybeSingle();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, informe: inserted }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
