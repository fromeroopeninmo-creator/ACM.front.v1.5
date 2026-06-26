import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Variables de entorno requeridas:
// - NEXT_PUBLIC_SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY  (⚠️ nunca exponer esta al cliente)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Roles que pueden administrar empresas ajenas
const ADMIN_ROLES = new Set(["soporte", "super_admin", "super_admin_root"]);

// Lista blanca de campos permitidos para edición común de empresa.
// IMPORTANTE:
// No agregar acá campos sensibles como:
// - suspendida
// - suspendida_at
// - suspension_motivo
// - plan_activo_id
// - user_id
// - role
// - campos de billing
// - cupos
// - condiciones comerciales
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

type JsonRecord = Record<string, any>;

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") || "";

  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authHeader.slice("bearer ".length).trim();
  return token || null;
}

function cleanUpdatePayload(update: JsonRecord): JsonRecord {
  const clean: JsonRecord = {};

  for (const key of Object.keys(update || {})) {
    if (ALLOWED_FIELDS.has(key)) {
      clean[key] = update[key];
    }
  }

  // Protección adicional defensiva.
  // Aunque la whitelist ya bloquea estos campos, los borramos igual
  // por si en el futuro alguien modifica ALLOWED_FIELDS sin revisar seguridad.
  delete clean.id;
  delete clean.user_id;
  delete clean.created_at;
  delete clean.updated_at;

  delete clean.suspendida;
  delete clean.suspendida_at;
  delete clean.suspension_motivo;
  delete clean.plan_activo_id;

  delete clean.role;
  delete clean.empresa_id;

  delete clean.max_asesores;
  delete clean.max_asesores_override;
  delete clean.precio;
  delete clean.precio_neto_fijo;
  delete clean.modo_iva;
  delete clean.iva_pct;

  delete clean.a;
  delete clean["a.color"];
  delete clean["a.logo_url"];

  return clean;
}

export async function PATCH(req: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("❌ Falta SUPABASE url o service role key");

      return NextResponse.json(
        { error: "Faltan variables de entorno de Supabase" },
        { status: 500 }
      );
    }

    const token = getBearerToken(req);

    if (!token) {
      return NextResponse.json(
        { error: "No autenticado. Falta token Bearer." },
        { status: 401 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token);

    if (userError || !user) {
      console.error("❌ Auth getUser error:", userError);

      return NextResponse.json(
        { error: "Sesión inválida o expirada." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Payload inválido." },
        { status: 400 }
      );
    }

    const requestedEmpresaId = body?.empresa_id as string | undefined;
    const requestedUserId = body?.user_id as string | undefined;
    const update = (body?.update ?? {}) as JsonRecord;

    if (!update || typeof update !== "object" || Array.isArray(update)) {
      return NextResponse.json(
        { error: "Payload inválido. Se requiere { update }." },
        { status: 400 }
      );
    }

    const clean = cleanUpdatePayload(update);

    if (Object.keys(clean).length === 0) {
      return NextResponse.json(
        {
          error:
            "No hay campos válidos para actualizar. Revisá que los campos estén permitidos.",
        },
        { status: 400 }
      );
    }

    // Buscamos el profile real desde BD.
    // No confiamos en user_metadata ni en role enviado desde frontend.
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, user_id, email, role, empresa_id")
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle();

    if (profileError) {
      console.error("❌ Profile lookup error:", profileError);

      return NextResponse.json(
        { error: "No se pudo validar el perfil del usuario." },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "No existe profile asociado al usuario autenticado." },
        { status: 403 }
      );
    }

    const role = profile.role as string | null;
    const isAdminLike = role ? ADMIN_ROLES.has(role) : false;

    if (role === "asesor") {
      return NextResponse.json(
        { error: "Un asesor no puede editar datos de empresa." },
        { status: 403 }
      );
    }

    let targetEmpresaId: string | null = null;

    if (role === "empresa") {
      // Empresa normal:
      // Ignoramos empresa_id/user_id enviados por body.
      // Resolvemos su empresa desde backend.
      if (profile.empresa_id) {
        const { data: empresaByProfile, error: empresaByProfileError } =
          await admin
            .from("empresas")
            .select("id")
            .eq("id", profile.empresa_id)
            .maybeSingle();

        if (empresaByProfileError) {
          console.error(
            "❌ Empresa lookup by profile.empresa_id error:",
            empresaByProfileError
          );

          return NextResponse.json(
            { error: "No se pudo validar la empresa del usuario." },
            { status: 500 }
          );
        }

        if (empresaByProfile?.id) {
          targetEmpresaId = empresaByProfile.id;
        }
      }

      if (!targetEmpresaId) {
        const { data: empresaByUser, error: empresaByUserError } = await admin
          .from("empresas")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (empresaByUserError) {
          console.error(
            "❌ Empresa lookup by authenticated user_id error:",
            empresaByUserError
          );

          return NextResponse.json(
            { error: "No se pudo validar la empresa del usuario." },
            { status: 500 }
          );
        }

        if (empresaByUser?.id) {
          targetEmpresaId = empresaByUser.id;
        }
      }

      if (!targetEmpresaId) {
        return NextResponse.json(
          { error: "No se encontró empresa asociada al usuario." },
          { status: 403 }
        );
      }
    } else if (isAdminLike) {
      // Soporte/Admin:
      // Pueden actualizar empresa indicada, pero igualmente resolvemos
      // contra BD antes de actualizar.
      if (requestedEmpresaId) {
        const { data: empresaById, error: empresaByIdError } = await admin
          .from("empresas")
          .select("id")
          .eq("id", requestedEmpresaId)
          .maybeSingle();

        if (empresaByIdError) {
          console.error("❌ Empresa lookup by id error:", empresaByIdError);

          return NextResponse.json(
            { error: "No se pudo validar la empresa indicada." },
            { status: 500 }
          );
        }

        if (!empresaById?.id) {
          return NextResponse.json(
            { error: "La empresa indicada no existe." },
            { status: 404 }
          );
        }

        targetEmpresaId = empresaById.id;
      } else if (requestedUserId) {
        const { data: empresaByUserId, error: empresaByUserIdError } =
          await admin
            .from("empresas")
            .select("id")
            .eq("user_id", requestedUserId)
            .maybeSingle();

        if (empresaByUserIdError) {
          console.error(
            "❌ Empresa lookup by requested user_id error:",
            empresaByUserIdError
          );

          return NextResponse.json(
            { error: "No se pudo validar la empresa indicada." },
            { status: 500 }
          );
        }

        if (!empresaByUserId?.id) {
          return NextResponse.json(
            { error: "No existe empresa para el user_id indicado." },
            { status: 404 }
          );
        }

        targetEmpresaId = empresaByUserId.id;
      } else {
        return NextResponse.json(
          {
            error:
              "Para soporte/admin se requiere empresa_id o user_id de la empresa a editar.",
          },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Rol no autorizado para editar empresa." },
        { status: 403 }
      );
    }

    if (!targetEmpresaId) {
      return NextResponse.json(
        { error: "No se pudo resolver la empresa a actualizar." },
        { status: 400 }
      );
    }

    const updateData = {
      ...clean,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await admin
      .from("empresas")
      .update(updateData)
      .eq("id", targetEmpresaId);

    if (updateError) {
      console.error("❌ Supabase update empresa error:", updateError);

      return NextResponse.json(
        { error: "No se pudo actualizar la empresa.", detail: updateError },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        empresa_id: targetEmpresaId,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("❌ API internal error:", err?.message || err);

    return NextResponse.json(
      { error: err?.message || "Error interno" },
      { status: 500 }
    );
  }
}
