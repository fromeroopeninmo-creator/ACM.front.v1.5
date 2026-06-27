import { NextResponse } from "next/server";

type ImportedComparable = {
  source: string;
  url: string;
  address: string;
  neighborhood: string;
  price: number | "";
  currency: "USD" | "ARS" | "";
  builtArea: number | "";
  landArea: number | "";
  daysPublished: number | "";
  daysPublishedText: string;
  imageUrl: string;
  warnings: string[];
};

const ALLOWED_HOSTS = [
  "zonaprop.com.ar",
  "www.zonaprop.com.ar",
  "argenprop.com",
  "www.argenprop.com",
  "mercadolibre.com.ar",
  "www.mercadolibre.com.ar",
  "inmuebles.mercadolibre.com.ar",
];

function normalizeSpaces(text: string) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function decodeBasicHtmlEntities(text: string) {
  return String(text || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(html: string) {
  return normalizeSpaces(
    decodeBasicHtmlEntities(
      String(html || "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

function safeJsonParse(value: string): any | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getMetaContent(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return normalizeSpaces(decodeBasicHtmlEntities(match[1]));
  }

  return "";
}

function getTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return normalizeSpaces(decodeBasicHtmlEntities(match?.[1] || ""));
}

function parseNumber(raw: string): number | "" {
  const clean = String(raw || "")
    .replace(/[^\d.,]/g, "")
    .trim();

  if (!clean) return "";

  // Argentina: 1.234.567,89 o 1.234.567
  const withoutThousands = clean.replace(/\./g, "").replace(",", ".");
  const n = Number(withoutThousands);

  if (!Number.isFinite(n)) return "";
  return Math.round(n);
}

function extractPrice(text: string): { price: number | ""; currency: "USD" | "ARS" | "" } {
  const clean = normalizeSpaces(text);

  const usdMatch =
    clean.match(/(?:USD|U\$S|US\$)\s*([\d.,]+)/i) ||
    clean.match(/([\d.,]+)\s*(?:USD|U\$S|US\$)/i);

  if (usdMatch?.[1]) {
    return {
      price: parseNumber(usdMatch[1]),
      currency: "USD",
    };
  }

  const arsMatch =
    clean.match(/(?:ARS|\$)\s*([\d.,]+)/i) ||
    clean.match(/([\d.,]+)\s*(?:ARS|\$)/i);

  if (arsMatch?.[1]) {
    return {
      price: parseNumber(arsMatch[1]),
      currency: "ARS",
    };
  }

  return { price: "", currency: "" };
}

function findAreaNearLabel(text: string, labels: string[]): number | "" {
  const clean = normalizeSpaces(text);

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const patterns = [
      new RegExp(`([\\d.,]+)\\s*m(?:²|2)?\\s*(?:${escaped})`, "i"),
      new RegExp(`(?:${escaped})\\s*:?\\s*([\\d.,]+)\\s*m(?:²|2)?`, "i"),
      new RegExp(`([\\d.,]+)\\s*(?:${escaped})`, "i"),
    ];

    for (const pattern of patterns) {
      const match = clean.match(pattern);
      if (match?.[1]) {
        const parsed = parseNumber(match[1]);
        if (parsed !== "") return parsed;
      }
    }
  }

  return "";
}

function extractAreas(text: string) {
  const builtArea =
    findAreaNearLabel(text, [
      "m² cubiertos",
      "m2 cubiertos",
      "m² cub.",
      "m2 cub.",
      "m² cub",
      "m2 cub",
      "cubiertos",
      "cubierto",
      "sup. cubierta",
      "superficie cubierta",
    ]) || "";

  const landArea =
    findAreaNearLabel(text, [
      "m² totales",
      "m2 totales",
      "m² total",
      "m2 total",
      "m² terreno",
      "m2 terreno",
      "m² lote",
      "m2 lote",
      "terreno",
      "lote",
      "sup. total",
      "superficie total",
    ]) || "";

  return { builtArea, landArea };
}

function extractDaysPublished(text: string): {
  daysPublished: number | "";
  daysPublishedText: string;
} {
  const clean = normalizeSpaces(text).toLowerCase();

  const directDays =
    clean.match(/publicad[oa]\s+hace\s+(\d+)\s+d[ií]as?/) ||
    clean.match(/hace\s+(\d+)\s+d[ií]as?/) ||
    clean.match(/(\d+)\s+d[ií]as?\s+publicad[oa]/);

  if (directDays?.[1]) {
    const n = Number(directDays[1]);
    return {
      daysPublished: Number.isFinite(n) ? n : "",
      daysPublishedText: `${n} días`,
    };
  }

  const months =
    clean.match(/publicad[oa]\s+hace\s+(\d+)\s+mes(?:es)?/) ||
    clean.match(/hace\s+(\d+)\s+mes(?:es)?/);

  if (months?.[1]) {
    const n = Number(months[1]);
    const days = Number.isFinite(n) ? n * 30 : "";
    return {
      daysPublished: days,
      daysPublishedText: `${n} ${n === 1 ? "mes" : "meses"} aprox.`,
    };
  }

  const years =
    clean.match(/publicad[oa]\s+hace\s+(\d+)\s+años?/) ||
    clean.match(/hace\s+(\d+)\s+años?/);

  if (years?.[1]) {
    const n = Number(years[1]);
    const days = Number.isFinite(n) ? n * 365 : "";
    return {
      daysPublished: days,
      daysPublishedText: `${n} ${n === 1 ? "año" : "años"} aprox.`,
    };
  }

  if (clean.includes("más de 1 año") || clean.includes("mas de 1 año")) {
    return {
      daysPublished: 365,
      daysPublishedText: "más de 1 año aprox.",
    };
  }

  return {
    daysPublished: "",
    daysPublishedText: "",
  };
}

function extractJsonLdObjects(html: string): any[] {
  const objects: any[] = [];
  const regex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const raw = decodeBasicHtmlEntities(match[1] || "").trim();
    const parsed = safeJsonParse(raw);

    if (!parsed) continue;

    if (Array.isArray(parsed)) {
      objects.push(...parsed);
    } else {
      objects.push(parsed);
    }
  }

  const flattened: any[] = [];

  const walk = (item: any) => {
    if (!item) return;

    if (Array.isArray(item)) {
      item.forEach(walk);
      return;
    }

    flattened.push(item);

    if (item["@graph"]) walk(item["@graph"]);
    if (item.mainEntity) walk(item.mainEntity);
    if (item.itemListElement) walk(item.itemListElement);
  };

  objects.forEach(walk);

  return flattened;
}

function firstString(value: any): string {
  if (!value) return "";

  if (typeof value === "string") return normalizeSpaces(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
  }

  if (typeof value === "object") {
    if (typeof value.url === "string") return normalizeSpaces(value.url);
    if (typeof value.contentUrl === "string") return normalizeSpaces(value.contentUrl);
  }

  return "";
}

function extractFromJsonLd(html: string) {
  const jsonObjects = extractJsonLdObjects(html);

  const result = {
    address: "",
    neighborhood: "",
    price: "" as number | "",
    currency: "" as "USD" | "ARS" | "",
    builtArea: "" as number | "",
    landArea: "" as number | "",
    imageUrl: "",
  };

  for (const obj of jsonObjects) {
    if (!result.imageUrl) {
      result.imageUrl = firstString(obj.image);
    }

    const offers = obj.offers || obj.offer || {};
    const priceRaw = offers.price || obj.price;
    const priceCurrencyRaw = offers.priceCurrency || obj.priceCurrency;

    if (!result.price && priceRaw) {
      const parsedPrice =
        typeof priceRaw === "number" ? Math.round(priceRaw) : parseNumber(String(priceRaw));

      if (parsedPrice !== "") result.price = parsedPrice;
    }

    if (!result.currency && priceCurrencyRaw) {
      const c = String(priceCurrencyRaw).toUpperCase();
      if (c.includes("USD")) result.currency = "USD";
      if (c.includes("ARS") || c.includes("ARG")) result.currency = "ARS";
    }

    const address = obj.address || obj.location?.address || {};
    if (!result.address) {
      if (typeof address === "string") {
        result.address = normalizeSpaces(address);
      } else if (address.streetAddress) {
        result.address = normalizeSpaces(String(address.streetAddress));
      }
    }

    if (!result.neighborhood) {
      const locality =
        address.addressLocality ||
        address.addressRegion ||
        obj.addressLocality ||
        obj.neighborhood ||
        obj.areaServed;

      if (locality) result.neighborhood = normalizeSpaces(String(locality));
    }

    const floorSize = obj.floorSize || obj.accommodationFloorSize || {};
    if (!result.builtArea && floorSize.value) {
      const parsed = parseNumber(String(floorSize.value));
      if (parsed !== "") result.builtArea = parsed;
    }
  }

  return result;
}

function guessAddressAndNeighborhoodFromText(text: string, url: string) {
  const clean = normalizeSpaces(text);
  const result = {
    address: "",
    neighborhood: "",
  };

  // Intenta con títulos comunes tipo:
  // "Casa en venta en Urca, Córdoba"
  // "Terreno en Los Boulevares..."
  const titleLike = clean.slice(0, 500);

  const barrioMatch =
    titleLike.match(/(?:en|venta en|alquiler en)\s+([^,|.-]{3,60})(?:,|\||-)/i) ||
    titleLike.match(/barrio\s+([^,|.-]{3,60})(?:,|\||-)/i);

  if (barrioMatch?.[1]) {
    result.neighborhood = normalizeSpaces(barrioMatch[1]);
  }

  // Para dirección, intentamos detectar frases con número.
  const addressMatch =
    clean.match(/([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s.'-]{3,70}\s+\d{2,5})/) ||
    clean.match(/direcci[oó]n\s*:?\s*([^|,]{4,90})/i);

  if (addressMatch?.[1]) {
    result.address = normalizeSpaces(addressMatch[1]);
  }

  // Si no hay barrio, intentamos inferir desde slug de URL.
  if (!result.neighborhood) {
    try {
      const u = new URL(url);
      const slug = decodeURIComponent(u.pathname)
        .replace(/[-_]/g, " ")
        .replace(/\s+/g, " ");

      const possible = slug.match(/(?:en|venta en|alquiler en)\s+([a-záéíóúñ\s]{3,50})/i);
      if (possible?.[1]) {
        result.neighborhood = normalizeSpaces(possible[1]);
      }
    } catch {
      // no-op
    }
  }

  return result;
}

function sourceFromHost(host: string) {
  if (host.includes("zonaprop")) return "zonaprop";
  if (host.includes("argenprop")) return "argenprop";
  if (host.includes("mercadolibre")) return "mercadolibre";
  return "desconocido";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawUrl = String(body?.url || "").trim();

    if (!rawUrl) {
      return NextResponse.json(
        { ok: false, error: "Falta URL del comparable." },
        { status: 400 }
      );
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return NextResponse.json(
        { ok: false, error: "URL inválida." },
        { status: 400 }
      );
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { ok: false, error: "Solo se permiten URLs http/https." },
        { status: 400 }
      );
    }

    const host = parsedUrl.hostname.toLowerCase();

    if (!ALLOWED_HOSTS.includes(host)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Portal no soportado por ahora. Probá con Zonaprop, Argenprop o Mercado Libre.",
        },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    let html = "";

    try {
      const res = await fetch(rawUrl, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; VAIPropComparableImport/1.0; +https://www.vaiprop.com)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-AR,es;q=0.9,en;q=0.7",
        },
      });

      if (!res.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: `No se pudo leer la publicación. Estado HTTP ${res.status}.`,
          },
          { status: 502 }
        );
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        return NextResponse.json(
          {
            ok: false,
            error: "La URL no devolvió una página HTML válida.",
          },
          { status: 400 }
        );
      }

      html = await res.text();
    } finally {
      clearTimeout(timeout);
    }

    const source = sourceFromHost(host);

    const ogTitle = getMetaContent(html, "og:title");
    const ogDescription = getMetaContent(html, "og:description");
    const ogImage = getMetaContent(html, "og:image");
    const metaDescription = getMetaContent(html, "description");
    const title = getTitle(html);

    const visibleText = stripTags(html);
    const combinedText = normalizeSpaces(
      [ogTitle, ogDescription, metaDescription, title, visibleText].filter(Boolean).join(" | ")
    );

    const jsonLd = extractFromJsonLd(html);
    const priceFromText = extractPrice(combinedText);
    const areas = extractAreas(combinedText);
    const days = extractDaysPublished(combinedText);
    const guessed = guessAddressAndNeighborhoodFromText(
      [ogTitle, title, ogDescription, visibleText].filter(Boolean).join(" | "),
      rawUrl
    );

    const warnings: string[] = [];

    const data: ImportedComparable = {
      source,
      url: rawUrl,
      address: jsonLd.address || guessed.address || "",
      neighborhood: jsonLd.neighborhood || guessed.neighborhood || "",
      price: jsonLd.price || priceFromText.price || "",
      currency: jsonLd.currency || priceFromText.currency || "",
      builtArea: jsonLd.builtArea || areas.builtArea || "",
      landArea: jsonLd.landArea || areas.landArea || "",
      daysPublished: days.daysPublished,
      daysPublishedText: days.daysPublishedText,
      imageUrl: jsonLd.imageUrl || ogImage || "",
      warnings,
    };

    if (!data.address) warnings.push("No se pudo detectar dirección.");
    if (!data.neighborhood) warnings.push("No se pudo detectar barrio/zona.");
    if (!data.price) warnings.push("No se pudo detectar precio.");
    if (!data.builtArea && !data.landArea) {
      warnings.push("No se pudo detectar superficie.");
    }
    if (!data.daysPublished) {
      warnings.push("No se pudo detectar días de publicación.");
    }

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (err: any) {
    console.error("Import comparable error:", err);

    return NextResponse.json(
      {
        ok: false,
        error:
          err?.name === "AbortError"
            ? "La página tardó demasiado en responder."
            : err?.message || "No se pudo importar el comparable.",
      },
      { status: 500 }
    );
  }
}
