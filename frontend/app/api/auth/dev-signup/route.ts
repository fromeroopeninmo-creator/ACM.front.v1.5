// app/api/auth/dev-signup/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Endpoint de emergencia SOLO para desarrollo/local.
 *
 * Seguridad:
 * - En producción queda bloqueado siempre, salvo que explícitamente habilites
 *   DEV_SIGNUP_ENABLED=true, cosa que NO recomiendo en Vercel/prod.
 * - En desarrollo exige secreto interno DEV_SIGNUP_SECRET.
 * - Usa Service Role, por eso nunca debe quedar público.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEV_SIGNUP_SECRET = process.env.DEV_SIGNUP_SECRET || "";
const DEV_SIGNUP_ENABLED = process.env.DEV_SIGNUP_ENABLED === "true";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

function isProductionLike(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

// Mapea algunos mensajes comunes de Supabase → HTTP status razonable
function mapSupabaseErrorToStatus(message?: string): number {
  const msg = (message || "").toLowerCase();

  if (
    msg.includes("duplicate key") ||
    msg.includes("already registered") ||
    msg.includes("user already exists") ||
    msg.includes("email rate limit exceeded")
  ) {
    return 409;
  }

  if (
    msg.includes("invalid") ||
    msg.includes("malformed") ||
    msg.includes("password") ||
    msg.includes("email")
  ) {
    return 422;
  }

  if (msg.includes("permission") || msg.includes("not allowed")) {
    return 403;
  }

  return 500;
}

function getSecretFromRequest(req: Request): string {
  const headerSecret =
    req.headers.get("x-dev-signup-secret") ||
    req.headers.get("x-internal-secret") ||
    "";

  if (headerSecret) return headerSecret.trim();

  const authHeader = req.headers.get("authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || "";
}

export async function POST(req: Request) {
  let createdUserId: string | null = null;
  let createdEmpresaId: string | null = null;

  try {
    /**
     * Bloqueo fuerte:
     * En producción, por defecto, este endpoint no funciona.
     */
    if (isProductionLike() && !DEV_SIGNUP_ENABLED) {
      return NextResponse.json(
        { error: "Endpoint deshabilitado en producción." },
        { status: 404 }
      );
    }

    /**
     * Incluso si alguien lo habilita explícitamente, exigimos secreto.
     */
    if (!DEV_SIGNUP_SECRET) {
      return NextResponse.json(
        { error: "DEV_SIGNUP_SECRET no configurado." },
        { status: 403 }
      );
    }

    const reqSecret = getSecretFromRequest(req);

    if (!reqSecret || reqSecret !== DEV_SIGNUP_SECRET) {
      return NextResponse.json(
        { error: "Acceso denegado." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null as any);

    const email = normalizeEmail(body?.email);
    const password = cleanString(body?.password);
    const nombre = cleanString(body?.nombre);
    const apellido = cleanString(body?.apellido);
    const telefono = cleanString(body?.telefono);
    const direccion = cleanString(body?.direccion);
    const localidad = cleanString(body?.localidad);
    const provincia = cleanString(body?.provincia);
    const razonSocial = cleanString(body?.razonSocial);
    const inmobiliaria = cleanString(body?.inmobiliaria);
    const condicionFiscal = cleanString(body?.condicionFiscal);
    const cuit = cleanString(body?.cuit);

    if (
      !email ||
      !password ||
      !nombre ||
      !apellido ||
      !telefono ||
      !direccion ||
      !localidad ||
      !provincia ||
      !razonSocial ||
      !inmobiliaria ||
      !condicionFiscal ||
      !cuit
    ) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres." },
        { status: 422 }
      );
    }

    // 1) Crear user confirmado
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nombre,
          apellido,
          telefono,
          direccion,
          localidad,
          provincia,
          razon_social: razonSocial,
          inmobiliaria,
          condicion_fiscal: condicionFiscal,
          cuit,
          role: "empresa",
        },
      });

    if (createErr || !created?.user?.id) {
      const status = mapSupabaseErrorToStatus(createErr?.message);
      return NextResponse.json(
        { error: createErr?.message || "No se pudo crear el usuario." },
        { status }
      );
    }

    const userId = created.user.id;
    createdUserId = userId;

    // 2) Insertar empresa y devolver su id
    const { data: empresaRow, error: empErr } = await supabaseAdmin
      .from("empresas")
      .insert([
        {
          user_id: userId,
          nombre_comercial: inmobiliaria,
          razon_social: razonSocial,
          cuit,
          matriculado: `${nombre} ${apellido}`,
          telefono,
          direccion,
          localidad,
          provincia,
          condicion_fiscal: condicionFiscal,
          color: "#E6A930",
          logo_url: "",
        },
      ])
      .select("id")
      .single();

    if (empErr || !empresaRow?.id) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (e: any) {
        console.warn(
          "Cleanup: fallo al borrar usuario tras error en empresa:",
          e?.message || e
        );
      }

      createdUserId = null;

      const status = mapSupabaseErrorToStatus(empErr?.message);
      return NextResponse.json(
        { error: `Error creando empresa: ${empErr?.message || "desconocido"}` },
        { status }
      );
    }

    const empresaId = empresaRow.id as string;
    createdEmpresaId = empresaId;

    // 3) Insertar profile enlazado a la empresa con rol "empresa"
    const { error: profErr } = await supabaseAdmin.from("profiles").insert([
      {
        id: userId,
        user_id: userId,
        email,
        nombre,
        apellido,
        role: "empresa",
        empresa_id: empresaId,
        telefono,
      },
    ]);

    if (profErr) {
      try {
        await supabaseAdmin.from("empresas").delete().eq("id", empresaId);
      } catch (e: any) {
        console.warn("Cleanup: fallo al borrar empresa:", e?.message || e);
      }

      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (e: any) {
        console.warn("Cleanup: fallo al borrar usuario:", e?.message || e);
      }

      createdEmpresaId = null;
      createdUserId = null;

      const status = mapSupabaseErrorToStatus(profErr?.message);
      return NextResponse.json(
        { error: `Error creando profile: ${profErr.message}` },
        { status }
      );
    }

    return NextResponse.json({
      ok: true,
      user_id: userId,
      empresa_id: empresaId,
      message:
        "Usuario, empresa y profile creados desde endpoint de desarrollo protegido.",
    });
  } catch (e: any) {
    if (createdEmpresaId) {
      try {
        await supabaseAdmin.from("empresas").delete().eq("id", createdEmpresaId);
      } catch (cleanupErr: any) {
        console.warn(
          "Cleanup: fallo al borrar empresa tras error inesperado:",
          cleanupErr?.message || cleanupErr
        );
      }
    }

    if (createdUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      } catch (cleanupErr: any) {
        console.warn(
          "Cleanup: fallo al borrar usuario tras error inesperado:",
          cleanupErr?.message || cleanupErr
        );
      }
    }

    return NextResponse.json(
      { error: e?.message || "Error interno." },
      { status: 500 }
    );
  }
}
