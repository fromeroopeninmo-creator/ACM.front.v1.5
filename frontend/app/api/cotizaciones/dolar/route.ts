import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 300;

const DOLAR_API_URL = "https://dolarapi.com/v1/dolares";

type DolarApiItem = {
  compra: number | null;
  venta: number | null;
  casa: string;
  nombre: string;
  moneda: string;
  fechaActualizacion: string;
};

type CotizacionNormalizada = {
  casa: "oficial" | "blue";
  nombre: string;
  compra: number;
  venta: number;
  moneda: string;
  fechaActualizacion: string;
};

function esNumeroValido(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizarCotizacion(
  item: DolarApiItem | undefined,
  casa: "oficial" | "blue",
): CotizacionNormalizada | null {
  if (
    !item ||
    !esNumeroValido(item.compra) ||
    !esNumeroValido(item.venta) ||
    !item.fechaActualizacion
  ) {
    return null;
  }

  return {
    casa,
    nombre: item.nombre || (casa === "oficial" ? "Dólar Oficial" : "Dólar Blue"),
    compra: item.compra,
    venta: item.venta,
    moneda: item.moneda || "USD",
    fechaActualizacion: item.fechaActualizacion,
  };
}

export async function GET() {
  try {
    const response = await fetch(DOLAR_API_URL, {
      headers: {
        Accept: "application/json",
      },
      next: {
        revalidate: 300,
      },
    });

    if (!response.ok) {
      throw new Error(
        `DolarApi respondió con estado ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as DolarApiItem[];

    if (!Array.isArray(data)) {
      throw new Error("DolarApi devolvió una respuesta con formato inesperado.");
    }

    const oficial = normalizarCotizacion(
      data.find((item) => item?.casa?.toLowerCase() === "oficial"),
      "oficial",
    );

    const blue = normalizarCotizacion(
      data.find((item) => item?.casa?.toLowerCase() === "blue"),
      "blue",
    );

    if (!oficial || !blue) {
      throw new Error(
        "No se encontraron cotizaciones válidas para dólar oficial y dólar blue.",
      );
    }

    return NextResponse.json(
      {
        ok: true,
        fuente: "DolarApi",
        fuenteUrl: "https://dolarapi.com",
        oficial,
        blue,
        consultadoEn: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    console.error("Error obteniendo cotizaciones desde DolarApi:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "No fue posible obtener la cotización del dólar en este momento.",
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
