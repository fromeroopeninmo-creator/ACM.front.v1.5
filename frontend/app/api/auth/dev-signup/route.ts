// app/api/auth/dev-signup/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * ⚠️ DEV ONLY:
 * - Esta ruta usa Service Role. No debe quedar abierta en producción.
 * - Requiere header `X-Dev-Secret: <process.env.DEV_SIGNUP_SECRET>` o NODE_ENV !== "production".
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --------- Helpers ---------
const clean = (v: unknown) =>
  typeof v === "string" ? v.trim() : v;

const isProd = process.env.NODE_ENV === "production";
const DEV_SECRET = process.env.DEV_SIGNUP_SECRET;

// Mapea errores comunes de PG/Supabase a códigos HTTP amigables
function mapSupabaseErrorToStatus(message?: string): number {
  if (!message) return 500;
  const m = message.toLowerCase();

  // Conflictos/duplicados típicos
  if (
    m.includes("duplicate key") ||
    m.includes("already exists") ||
    m.includes("unique constraint")
  ) {
    return 409;
  }

  // Errores de auth o permisos
  if (m.includes("permission denied") || m.includes("not authorized")) {
    return 403;
  }

  // Transitorios o timeouts
  if (m.includes("timeout") || m.includes("connection")) {
    return 503;
  }

  return 500;
}

// --------- Validación (Zod) ---------
const payloadSchema = z.object({
  email: z.string().email().max(254).transform((s) => s.toLowerCase().trim()),
  password: z.string().min(8).max(128),

  nombre: z.string().min(1).max(100).transform((s) => s.trim()),
  apellido: z.string().min(1).max(100).transform((s) => s.trim()),
  telefono: z.string().min(6).max(30).transform((s) => s.trim()),
  direccion: z.string().min(1).max(200).transform((s) => s.trim()),
  localidad: z.string().min(1).max(100).transform((s) => s.trim()),
  provincia: z.string().min(1).max(100).transform((s) => s.trim()),

  razonSocial: z.string().min(1).max(200).transform((s) => s.trim()),
  inmobiliaria: z.string().min(1).max(200).transform((s) => s.trim()),
  condicionFiscal: z.enum(["RI", "Monotributo", "Exento", "CF"]).or(z.string().min(1).max(50)),
  cuit: z
    .string()
    .regex(/^\d{11}$/, "CUIT debe tener 11 dígitos numéricos"),
});

export async function POST(req: Request) {
  try {
    // Guard de seguridad (dev-only o con secreto)
    if (isProd) {
      const devHeader = req.headers.get("X-Dev-Secret");
      if (!DEV_SECRET || devHeader !== DEV_SECRET) {
        return NextResponse.json(
          { error: "Ruta no disponible en producción." },
          { status: 404 } // ó 403 si preferís
        );
      }
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json(
        { error: "JSON inválido" },
        { status: 400 }
      );
    }

    const parsed = payloadSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validación fallida",
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const {
      email,
      password,
      nombre,
      apellido,
      telefono,
      direccion,
      localidad,
      provincia,
      razonSocial,
      inmobiliaria,
      condicionFiscal,
      cuit,
    } = parsed.data;

    // 1) Crear usuario confirmado
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

    // 2) Crear empresa
    const { data: empInsert, error: empErr } = await supabaseAdmin
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
          logo_url: null, // mejor null que string vacío
        },
      ])
      .select("id")
      .single();

    if (empErr || !empInsert?.id) {
      // Cleanup: borrar el usuario si falló empresa
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      const status = mapSupabaseErrorToStatus(empErr?.message);
      return NextResponse.json(
        { error: empErr?.message || "Error creando empresa." },
        { status }
      );
    }

    const empresaId = empInsert.id;

    // 3) Upsert profiles (coherencia con RLS y dashboard)
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        [
          {
            id: userId,
            email,
            nombre,
            apellido,
            role: "empresa",
            empresa_id: empresaId,
            // agrega campos extra si tu tabla los tiene
          },
        ],
        { onConflict: "id" }
      );

    if (profErr) {
      // Cleanup: borrar empresa + user para no dejar huérfanos
      await supabaseAdmin.from("empresas").delete().eq("id", empresaId).catch(() => {});
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      const status = mapSupabaseErrorToStatus(profErr?.message);
      return NextResponse.json(
        { error: profErr?.message || "Error creando perfil." },
        { status }
      );
    }

    // 4) (Opcional) Activar Trial/plan por defecto aquí si tu app lo requiere
    // const trialErr = await activarTrial(empresaId).catch(e => e);
    // if (trialErr) { ...mapear, cleanup si querés ser extremo... }

    return NextResponse.json({
      ok: true,
      user_id: userId,
      empresa_id: empresaId,
      message: "Usuario, empresa y perfil creados (dev, email confirmado).",
    });
  } catch (e: any) {
    const status = mapSupabaseErrorToStatus(e?.message);
    return NextResponse.json(
      { error: e?.message || "Error interno." },
      { status }
    );
  }
}
