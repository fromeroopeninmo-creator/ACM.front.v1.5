// app/api/factibilidad/create/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role =
  | "empresa"
  | "asesor"
  | "soporte"
  | "super_admin"
  | "super_admin_root";

// ============================
// Helpers
// ============================

/** Evitar guardar base64 enormes dentro de datos_json */
function sanitizeDatos(datos: any) {
  const clone = JSON.parse(JSON.stringify(datos || {}));

  if (clone?.fotoLoteBase64) clone.fotoLoteBase64 = undefined;

  // Por si más adelante agregás comparables con fotos
  if (Array.isArray(clone?.comparables)) {
    clone.comparables = clone.comparables.map((c: any) => ({
      ...c,
      photoBase64: undefined,
    }));
  }

  return clone;
}

/**
 * Misma lógica que en /api/informes/create:
 * - Si el usuario es dueño de empresa → empresa_id viene de "empresas.user_id"
 * - Si es asesor → empresa_id viene de profiles.empresa_id y asesorId = profile.id
 */
async function resolveEmpresaYAsesor(userId: string) {
  // 1) ¿Es usuario dueño de empresa?
  const { data: emp } = await supabaseAdmin
    .from("empresas")
    .select("id, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (emp?.id) {
    return {
      empresaId: emp.id as string,
      asesorId: null as string | null,
      role: "empresa" as Role,
    };
  }

  // 2) ¿Tiene profile (asesor / soporte / admin) con empresa_id?
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
      return NextResponse.json(
        { error: "No autenticado." },
        { status: 401 }
      );
    }

    // 2) Body
    const body = await req.json().catch(() => null as any);
    const {
      id,
      datos,
      titulo = "Informe de Factibilidad Constructiva",
    } = body || {};

    if (!datos) {
      return NextResponse.json(
        { error: "Faltan 'datos'." },
        { status: 400 }
      );
    }

    // 3) Resolver empresa / asesor / rol
    const { empresaId, asesorId, role } = await resolveEmpresaYAsesor(userId);

    if (
      !empresaId &&
      !["soporte", "super_admin", "super_admin_root"].includes(role)
    ) {
      return NextResponse.json(
        { error: "No se pudo determinar la empresa del usuario." },
        { status: 400 }
      );
    }

    // 4) Sanitizar datos_json
    const datosLimpios = sanitizeDatos(datos);

    // 5) Datos “planos” para las columnas dedicadas
    const nombreProyecto: string | null =
      datos?.nombreProyecto?.toString()?.trim() || null;
    const direccion: string | null =
      datos?.direccion?.toString()?.trim() || null;
    const zona: string | null = datos?.zona?.toString()?.trim() || null;

    // ====================
    // UPDATE si viene id
    // ====================
    if (id) {
      const { data: existente, error: getErr } = await supabaseAdmin
        .from("informes_factibilidad")
        .select("id, empresa_id, user_id")
        .eq("id", id)
        .maybeSingle();

      if (getErr) {
        return NextResponse.json(
          { error: getErr.message },
          { status: 400 }
        );
      }
      if (!existente) {
        return NextResponse.json(
          { error: "Informe no encontrado." },
          { status: 404 }
        );
      }

      // Permisos parecidos a ACM:
      // - Empresa: puede actualizar si empresa_id coincide.
      // - Asesor: solo si lo creó él (user_id === userId).
      if (role === "empresa" && existente.empresa_id !== empresaId) {
        return NextResponse.json(
          { error: "Acceso denegado." },
          { status: 403 }
        );
      }
      if (role === "asesor" && existente.user_id !== userId) {
        return NextResponse.json(
          { error: "Acceso denegado." },
          { status: 403 }
        );
      }

      const { data: updated, error: updErr } = await supabaseAdmin
        .from("informes_factibilidad")
        .update({
          titulo,
          datos_json: datosLimpios,
          nombre_proyecto: nombreProyecto,
          direccion,
          zona,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .maybeSingle();

      if (updErr) {
        return NextResponse.json(
          { error: updErr.message },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { ok: true, informe: updated },
        { status: 200 }
      );
    }

    // ====================
    // INSERT si NO viene id
    // ====================
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
      .from("informes_factibilidad")
      .insert({
        id: informeId,
        empresa_id: empresaId ?? null, // 🔴 AQUÍ SE SETEA LA EMPRESA
        asesor_id: asesorId ?? null,   // 🔴 AQUÍ SE SETEA EL ASESOR (si aplica)
        user_id: userId,               // quién creó el informe
        titulo,
        datos_json: datosLimpios,
        nombre_proyecto: nombreProyecto,
        direccion,
        zona,
        created_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (insErr) {
      return NextResponse.json(
        { error: insErr.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: true, informe: inserted },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
