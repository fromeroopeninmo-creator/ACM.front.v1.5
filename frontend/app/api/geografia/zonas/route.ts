import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeSearchText } from "#lib/geografia/georef";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TIPOS_ZONA_PERMITIDOS = new Set([
  "barrio",
  "urbanizacion",
  "country",
  "barrio_cerrado",
  "complejo",
  "zona_comercial",
  "paraje",
  "localidad",
  "otro",
]);

type ZonaCreateBody = {
  provinciaGeorefId?: string | null;
  provinciaNombre?: string | null;
  localidadGeorefId?: string | null;
  localidadNombre?: string | null;
  nombre?: string | null;
  tipoZona?: string | null;
  latitud?: number | null;
  longitud?: number | null;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned || null;
}

function cleanCoordinate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number" ? value : Number(String(value));

  return Number.isFinite(parsed) ? parsed : null;
}

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization) return null;

  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim() || null;
}

async function getAuthenticatedUserId(
  request: NextRequest,
): Promise<string | null> {
  const token = getBearerToken(request);

  if (!token) return null;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

export async function GET(request: NextRequest) {
  try {
    const provinciaGeorefId = cleanText(
      request.nextUrl.searchParams.get("provinciaGeorefId"),
    );
    const provinciaNombre = cleanText(
      request.nextUrl.searchParams.get("provinciaNombre"),
    );
    const localidadGeorefId = cleanText(
      request.nextUrl.searchParams.get("localidadGeorefId"),
    );
    const localidadNombre = cleanText(
      request.nextUrl.searchParams.get("localidadNombre"),
    );
    const query = cleanText(request.nextUrl.searchParams.get("q"));

    if (!provinciaGeorefId && !provinciaNombre) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Debe informarse provinciaGeorefId o provinciaNombre.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (!localidadGeorefId && !localidadNombre) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Debe informarse localidadGeorefId o localidadNombre.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    let zonasQuery = supabaseAdmin
      .from("vai_geo_zonas")
      .select(
        "id, provincia_georef_id, provincia_nombre, localidad_georef_id, localidad_nombre, nombre, nombre_normalizado, tipo_zona, latitud, longitud",
      )
      .eq("activo", true)
      .order("nombre", {
        ascending: true,
      })
      .limit(100);

    zonasQuery = provinciaGeorefId
      ? zonasQuery.eq("provincia_georef_id", provinciaGeorefId)
      : zonasQuery.ilike("provincia_nombre", provinciaNombre!);

    zonasQuery = localidadGeorefId
      ? zonasQuery.eq("localidad_georef_id", localidadGeorefId)
      : zonasQuery.ilike("localidad_nombre", localidadNombre!);

    if (query) {
      zonasQuery = zonasQuery.ilike("nombre", `%${query}%`);
    }

    const { data: zonas, error } = await zonasQuery;

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        ok: true,
        total: zonas?.length || 0,
        zonas: zonas || [],
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, s-maxage=300, stale-while-revalidate=900",
        },
      },
    );
  } catch (error) {
    console.error("Error obteniendo zonas VAI:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          "No fue posible obtener las zonas en este momento.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Usuario no autenticado.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | ZonaCreateBody
      | null;

    if (!body) {
      return NextResponse.json(
        {
          ok: false,
          error: "El cuerpo de la solicitud no es válido.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const provinciaGeorefId = cleanText(body.provinciaGeorefId);
    const provinciaNombre = cleanText(body.provinciaNombre);
    const localidadGeorefId = cleanText(body.localidadGeorefId);
    const localidadNombre = cleanText(body.localidadNombre);
    const nombre = cleanText(body.nombre);
    const tipoZona = cleanText(body.tipoZona) || "barrio";
    const latitud = cleanCoordinate(body.latitud);
    const longitud = cleanCoordinate(body.longitud);

    if (!provinciaNombre) {
      return NextResponse.json(
        {
          ok: false,
          error: "El nombre de la provincia es obligatorio.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (!localidadNombre) {
      return NextResponse.json(
        {
          ok: false,
          error: "El nombre de la localidad es obligatorio.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (!nombre) {
      return NextResponse.json(
        {
          ok: false,
          error: "El nombre de la zona es obligatorio.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (!TIPOS_ZONA_PERMITIDOS.has(tipoZona)) {
      return NextResponse.json(
        {
          ok: false,
          error: "El tipo de zona informado no es válido.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (latitud !== null && (latitud < -90 || latitud > 90)) {
      return NextResponse.json(
        {
          ok: false,
          error: "La latitud debe estar entre -90 y 90.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (longitud !== null && (longitud < -180 || longitud > 180)) {
      return NextResponse.json(
        {
          ok: false,
          error: "La longitud debe estar entre -180 y 180.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: existingZoneId, error: findError } =
      await supabaseAdmin.rpc("vai_buscar_zona_id", {
        p_provincia_georef_id: provinciaGeorefId,
        p_provincia_nombre: provinciaNombre,
        p_localidad_georef_id: localidadGeorefId,
        p_localidad_nombre: localidadNombre,
        p_zona: nombre,
      });

    if (findError) {
      throw findError;
    }

    if (existingZoneId) {
      const { data: existingZone, error: existingError } =
        await supabaseAdmin
          .from("vai_geo_zonas")
          .select(
            "id, provincia_georef_id, provincia_nombre, localidad_georef_id, localidad_nombre, nombre, nombre_normalizado, tipo_zona, latitud, longitud",
          )
          .eq("id", existingZoneId)
          .single();

      if (existingError) {
        throw existingError;
      }

      return NextResponse.json(
        {
          ok: true,
          creada: false,
          mensaje: "La zona ya existía y fue reutilizada.",
          zona: existingZone,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const { data: createdZone, error: insertError } =
      await supabaseAdmin
        .from("vai_geo_zonas")
        .insert({
          provincia_georef_id: provinciaGeorefId,
          provincia_nombre: provinciaNombre,
          localidad_georef_id: localidadGeorefId,
          localidad_nombre: localidadNombre,
          nombre,
          nombre_normalizado: normalizeSearchText(nombre),
          tipo_zona: tipoZona,
          latitud,
          longitud,
          creado_por_user_id: userId,
          activo: true,
        })
        .select(
          "id, provincia_georef_id, provincia_nombre, localidad_georef_id, localidad_nombre, nombre, nombre_normalizado, tipo_zona, latitud, longitud",
        )
        .single();

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: duplicatedId, error: duplicatedFindError } =
          await supabaseAdmin.rpc("vai_buscar_zona_id", {
            p_provincia_georef_id: provinciaGeorefId,
            p_provincia_nombre: provinciaNombre,
            p_localidad_georef_id: localidadGeorefId,
            p_localidad_nombre: localidadNombre,
            p_zona: nombre,
          });

        if (duplicatedFindError || !duplicatedId) {
          throw insertError;
        }

        const { data: duplicatedZone, error: duplicatedZoneError } =
          await supabaseAdmin
            .from("vai_geo_zonas")
            .select(
              "id, provincia_georef_id, provincia_nombre, localidad_georef_id, localidad_nombre, nombre, nombre_normalizado, tipo_zona, latitud, longitud",
            )
            .eq("id", duplicatedId)
            .single();

        if (duplicatedZoneError) {
          throw duplicatedZoneError;
        }

        return NextResponse.json(
          {
            ok: true,
            creada: false,
            mensaje: "La zona ya existía y fue reutilizada.",
            zona: duplicatedZone,
          },
          {
            status: 200,
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      }

      throw insertError;
    }

    return NextResponse.json(
      {
        ok: true,
        creada: true,
        mensaje: "Zona creada correctamente.",
        zona: createdZone,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Error creando zona VAI:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "No fue posible crear la zona.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
