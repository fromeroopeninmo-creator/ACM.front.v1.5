// app/api/asesor/empresa/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // ⚠️ server-side ONLY

const ADMIN_ROLES = new Set(["soporte", "super_admin", "super_admin_root"]);

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") || "";

  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authHeader.slice("bearer ".length).trim();
  return token || null;
}

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("❌ Falta SUPABASE url o service role key");

      return NextResponse.json(
        { error: "Faltan variables de entorno de Supabase." },
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

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error("❌ Auth getUser error:", userError);

      return NextResponse.json(
        { error: "Sesión inválida o expirada." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const requestedAsesorId = body?.asesor_id as string | undefined;
    const requestedEmpresaId = body?.empresa_id as string | undefined;
    const requestedUserId = body?.user_id as string | undefined;

    // Buscamos el profile real desde BD.
    // No confiamos en user_metadata ni en datos enviados desde frontend.
    const { data: profile, error: profileError } = await supabase
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

    let targetEmpresaId: string | null = null;

    // =====================================================
    // ASESOR
    // =====================================================
    // El asesor NO puede elegir empresa_id ni asesor_id arbitrario.
    // Siempre ve la empresa asociada a su propio profile.
    if (role === "asesor") {
      if (!profile.empresa_id) {
        return NextResponse.json(
          { error: "El asesor no tiene empresa asociada." },
          { status: 404 }
        );
      }

      targetEmpresaId = profile.empresa_id;
    }

    // =====================================================
    // EMPRESA
    // =====================================================
    // La empresa NO puede elegir empresa_id ni user_id arbitrario.
    // Siempre resolvemos su empresa desde backend.
    else if (role === "empresa") {
      if (profile.empresa_id) {
        const { data: empresaByProfile, error: empresaByProfileError } =
          await supabase
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
        const { data: empresaByUser, error: empresaByUserError } =
          await supabase
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
    }

    // =====================================================
    // SOPORTE / ADMIN / ROOT
    // =====================================================
    // Pueden consultar empresa indicada, pero se valida contra BD.
    else if (isAdminLike) {
      if (requestedEmpresaId) {
        const { data: empresaById, error: empresaByIdError } = await supabase
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
            { error: "Empresa no encontrada." },
            { status: 404 }
          );
        }

        targetEmpresaId = empresaById.id;
      } else if (requestedUserId) {
        const { data: empresaByUserId, error: empresaByUserIdError } =
          await supabase
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
      } else if (requestedAsesorId) {
        const { data: asesorProfile, error: asesorProfileError } =
          await supabase
            .from("profiles")
            .select("id, user_id, role, empresa_id")
            .or(`id.eq.${requestedAsesorId},user_id.eq.${requestedAsesorId}`)
            .maybeSingle();

        if (asesorProfileError) {
          console.error(
            "❌ Asesor profile lookup error:",
            asesorProfileError
          );

          return NextResponse.json(
            { error: "No se pudo validar el asesor indicado." },
            { status: 500 }
          );
        }

        if (!asesorProfile) {
          return NextResponse.json(
            { error: "Asesor no encontrado." },
            { status: 404 }
          );
        }

        if (!asesorProfile.empresa_id) {
          return NextResponse.json(
            { error: "El asesor indicado no tiene empresa asociada." },
            { status: 404 }
          );
        }

        targetEmpresaId = asesorProfile.empresa_id;
      } else {
        return NextResponse.json(
          {
            error:
              "Para soporte/admin se requiere empresa_id, user_id o asesor_id.",
          },
          { status: 400 }
        );
      }
    }

    // =====================================================
    // OTROS ROLES
    // =====================================================
    else {
      return NextResponse.json(
        { error: "Rol no autorizado para consultar empresa." },
        { status: 403 }
      );
    }

    if (!targetEmpresaId) {
      return NextResponse.json(
        { error: "No se pudo resolver la empresa a consultar." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("empresas")
      .select(
        "id, nombre_comercial, matriculado, cpi, telefono, logo_url, color, updated_at"
      )
      .eq("id", targetEmpresaId)
      .maybeSingle();

    if (error) {
      console.error("❌ DB error empresas:", error);

      return NextResponse.json(
        { error: `DB error (empresas): ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Empresa no encontrada." },
        { status: 404 }
      );
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (e: any) {
    console.error("❌ API asesor/empresa error:", e?.message || e);

    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
