// app/api/empresa/asesores/rendimiento/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ADMIN_ROLES = new Set(["soporte", "super_admin", "super_admin_root"]);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

function isValidDate(value: string | null): value is string {
  if (!value || !DATE_REGEX.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isUuid(value: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

function errorJson(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return errorJson("Faltan variables de entorno de Supabase.", 500);
    }

    const token = getBearerToken(req);
    if (!token) return errorJson("No autenticado. Falta token Bearer.", 401);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const authUser = authData.user;

    if (authError || !authUser) {
      return errorJson("Sesión inválida o expirada.", 401);
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id, role, empresa_id")
      .or(`id.eq.${authUser.id},user_id.eq.${authUser.id}`)
      .maybeSingle();

    if (profileError) {
      console.error("rendimiento/profile", profileError);
      return errorJson("No se pudo validar el perfil del usuario.", 500);
    }

    if (!profile) return errorJson("No existe perfil asociado al usuario.", 403);

    const role = String(profile.role || "");
    const isAdminLike = ADMIN_ROLES.has(role);

    if (role !== "empresa" && !isAdminLike) {
      return errorJson("Rol no autorizado para consultar rendimiento.", 403);
    }

    const fechaDesde = req.nextUrl.searchParams.get("fecha_desde");
    const fechaHasta = req.nextUrl.searchParams.get("fecha_hasta");
    const asesorId = req.nextUrl.searchParams.get("asesor_id");
    const requestedEmpresaId = req.nextUrl.searchParams.get("empresa_id");

    if (!isValidDate(fechaDesde) || !isValidDate(fechaHasta)) {
      return errorJson("fecha_desde y fecha_hasta deben usar formato YYYY-MM-DD.", 400);
    }

    if (fechaDesde > fechaHasta) {
      return errorJson("La fecha desde no puede ser posterior a la fecha hasta.", 400);
    }

    const rangeDays = Math.floor(
      (new Date(`${fechaHasta}T00:00:00Z`).getTime() - new Date(`${fechaDesde}T00:00:00Z`).getTime()) /
        86400000
    );

    if (rangeDays > 1825) {
      return errorJson("El período máximo permitido es de 5 años.", 400);
    }

    if (asesorId && !isUuid(asesorId)) {
      return errorJson("El asesor_id indicado no es válido.", 400);
    }

    let empresaId: string | null = null;

    if (role === "empresa") {
      if (profile.empresa_id) {
        const { data: empresaByProfile, error } = await supabaseAdmin
          .from("empresas")
          .select("id")
          .eq("id", profile.empresa_id)
          .maybeSingle();

        if (error) return errorJson("No se pudo validar la empresa del usuario.", 500);
        empresaId = empresaByProfile?.id || null;
      }

      if (!empresaId) {
        const { data: empresaByUser, error } = await supabaseAdmin
          .from("empresas")
          .select("id")
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (error) return errorJson("No se pudo validar la empresa del usuario.", 500);
        empresaId = empresaByUser?.id || null;
      }

      if (!empresaId) return errorJson("No se encontró empresa asociada al usuario.", 403);
    } else {
      if (!isUuid(requestedEmpresaId)) {
        return errorJson("Para soporte/admin se requiere empresa_id válido.", 400);
      }

      const { data: empresa, error } = await supabaseAdmin
        .from("empresas")
        .select("id")
        .eq("id", requestedEmpresaId)
        .maybeSingle();

      if (error) return errorJson("No se pudo validar la empresa indicada.", 500);
      if (!empresa) return errorJson("Empresa no encontrada.", 404);
      empresaId = empresa.id;
    }

    if (asesorId) {
      const { data: asesor, error } = await supabaseAdmin
        .from("asesores")
        .select("id")
        .eq("id", asesorId)
        .eq("empresa_id", empresaId)
        .maybeSingle();

      if (error) return errorJson("No se pudo validar el asesor indicado.", 500);
      if (!asesor) return errorJson("El asesor no pertenece a la empresa.", 404);
    }

    const { data, error: rpcError } = await supabaseAdmin.rpc(
      "get_empresa_asesores_rendimiento",
      {
        p_empresa_id: empresaId,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta,
        p_asesor_id: asesorId || null,
      }
    );

    if (rpcError) {
      console.error("rendimiento/rpc", rpcError);
      return errorJson("No se pudo obtener el rendimiento del equipo.", 500);
    }

    return NextResponse.json(
      { data },
      { status: 200, headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("GET rendimiento", error);
    return errorJson("Error inesperado al consultar el rendimiento.", 500);
  }
}
