import { NextRequest, NextResponse } from "next/server";
import {
  getLocalidades,
  normalizeSearchText,
} from "@/lib/geografia/georef";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_RESULTADOS = 250;

export async function GET(request: NextRequest) {
  try {
    const provincia =
      request.nextUrl.searchParams.get("provincia")?.trim() || "";

    const query = request.nextUrl.searchParams.get("q")?.trim() || "";

    if (!provincia) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El parámetro provincia es obligatorio. Puede enviarse el ID o el nombre oficial.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const localidades = await getLocalidades(provincia);
    const queryNormalizada = normalizeSearchText(query);

    const filtradas = queryNormalizada
      ? localidades.filter((localidad) =>
          normalizeSearchText(localidad.nombre).includes(queryNormalizada),
        )
      : localidades;

    const resultados = filtradas.slice(0, MAX_RESULTADOS);

    return NextResponse.json(
      {
        ok: true,
        fuente: "Georef Argentina",
        provinciaConsultada: provincia,
        total: filtradas.length,
        totalDevuelto: resultados.length,
        limitado: filtradas.length > MAX_RESULTADOS,
        localidades: resultados,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, s-maxage=43200, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    console.error("Error consultando localidades en Georef:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          "No fue posible obtener las localidades en este momento.",
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
