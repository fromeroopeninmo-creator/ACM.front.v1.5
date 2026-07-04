import { NextRequest, NextResponse } from "next/server";
import {
  getProvincias,
  normalizeSearchText,
} from "#/lib/geografia/georef";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() || "";
    const provincias = await getProvincias();

    const queryNormalizada = normalizeSearchText(query);

    const resultados = queryNormalizada
      ? provincias.filter((provincia) =>
          normalizeSearchText(provincia.nombre).includes(queryNormalizada),
        )
      : provincias;

    return NextResponse.json(
      {
        ok: true,
        fuente: "Georef Argentina",
        total: resultados.length,
        provincias: resultados,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (error) {
    console.error("Error consultando provincias en Georef:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          "No fue posible obtener las provincias en este momento.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
