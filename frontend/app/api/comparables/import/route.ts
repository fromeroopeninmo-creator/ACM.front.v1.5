import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Currency = "USD" | "ARS" | "";

type ImportedComparable = {
  source: string;
  url: string;
  address: string;
  neighborhood: string;
  price: number | "";
  currency: Currency;
  builtArea: number | "";
  landArea: number | "";
  daysPublished: number | "";
  daysPublishedText: string;
  imageUrl: string;
  warnings: string[];
};

const SUPPORTED_ROOT_DOMAINS = ["argenprop.com", "mercadolibre.com.ar"];

const UNSUPPORTED_MESSAGE =
  "El botón de Autocompletar solo funciona para Argenprop y Mercado Libre por el momento. Cargá los datos manualmente.";

function isHostFromDomain(host: string, domain: string) {
  const cleanHost = String(host || "").toLowerCase();
  return cleanHost === domain || cleanHost.endsWith(`.${domain}`);
}

function isSupportedHost(host: string) {
  return SUPPORTED_ROOT_DOMAINS.some((domain) => isHostFromDomain(host, domain));
}

function isMercadoLibreHost(host: string) {
  return isHostFromDomain(host, "mercadolibre.com.ar");
}

function normalizeSpaces(text: string) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
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

function normalizeNumberField(value: unknown): number | "" {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = parseNumber(value);
    return parsed === "" ? "" : parsed;
  }

  return "";
}

function normalizeCurrencyField(value: unknown): Currency {
  const clean = String(value || "").toUpperCase();

  if (clean.includes("USD") || clean.includes("U$S") || clean.includes("US$")) {
    return "USD";
  }

  if (clean.includes("ARS") || clean.includes("$")) {
    return "ARS";
  }

  return "";
}

function extractPrice(text: string): { price: number | ""; currency: Currency } {
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
      new RegExp(`([\\d.,]+)\\s*m\\s*(?:²|2)?\\s*(?:${escaped})`, "i"),
      new RegExp(`(?:${escaped})\\s*:?\\s*([\\d.,]+)\\s*m\\s*(?:²|2)?`, "i"),
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
  // builtArea intenta traer superficie CUBIERTA / construida.
  // landArea intenta traer superficie TOTAL / lote / terreno.
  const builtArea =
    findAreaNearLabel(text, [
      "m² cubiertos",
      "m2 cubiertos",
      "m² cubiertas",
      "m2 cubiertas",
      "m² cub.",
      "m2 cub.",
      "m² cub",
      "m2 cub",
      "metros cubiertos",
      "superficie cubierta",
      "sup. cubierta",
      "cubiertos",
      "cubierto",
      "construidos",
      "construido",
      "m² construidos",
      "m2 construidos",
    ]) || "";

  const landArea =
    findAreaNearLabel(text, [
      "m² totales",
      "m2 totales",
      "m² total",
      "m2 total",
      "metros totales",
      "superficie total",
      "sup. total",
      "m² terreno",
      "m2 terreno",
      "metros terreno",
      "m² lote",
      "m2 lote",
      "metros lote",
      "terreno",
      "lote",
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
    if (typeof value.secure_url === "string") return normalizeSpaces(value.secure_url);
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
    currency: "" as Currency,
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
      result.currency = normalizeCurrencyField(priceCurrencyRaw);
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

    // No usamos floorSize como builtArea si el HTML no aclara que es "cubierta",
    // porque en algunos portales puede representar superficie total.
  }

  return result;
}

function isLandLikeListing(text: string, url: string) {
  const clean = `${text} ${url}`.toLowerCase();
  return /\b(lote|terreno|campo|fracci[oó]n|hect[aá]rea|ha\.?)\b/i.test(clean);
}

function guessAddressAndNeighborhoodFromText(text: string, url: string) {
  const clean = normalizeSpaces(text);
  const result = {
    address: "",
    neighborhood: "",
  };

  const titleLike = clean.slice(0, 900);

  const barrioMatch =
    titleLike.match(/(?:en|venta en|alquiler en)\s+([^,|.-]{3,60})(?:,|\||-)/i) ||
    titleLike.match(/barrio\s+([^,|.-]{3,60})(?:,|\||-)/i);

  if (barrioMatch?.[1]) {
    result.neighborhood = normalizeSpaces(barrioMatch[1]);
  }

  const addressMatch =
    clean.match(/([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s.'-]{3,70}\s+\d{2,5})/) ||
    clean.match(/direcci[oó]n\s*:?\s*([^|,]{4,90})/i);

  if (addressMatch?.[1]) {
    result.address = normalizeSpaces(addressMatch[1]);
  }

  if (!result.neighborhood) {
    try {
      const u = new URL(url);
      const slug = decodeURIComponent(u.pathname)
        .replace(/[-_]/g, " ")
        .replace(/\s+/g, " ");

      const possible =
        slug.match(/(?:en|venta en|alquiler en)\s+([a-záéíóúñ\s]{3,50})/i) ||
        slug.match(/\b(?:casa|departamento|depto|edificio|terreno|lote)\s+en\s+([a-záéíóúñ\s]{3,50})/i);

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
  if (host.includes("argenprop")) return "argenprop";
  if (host.includes("mercadolibre")) return "mercadolibre";
  return "desconocido";
}

/**
 * Mercado Libre:
 * - Links habituales: /MLA-1510029079-... o /MLA1510029079...
 * - El ID final para la API debe quedar como MLA1510029079.
 */
function extractMercadoLibreItemId(url: string) {
  const decoded = decodeURIComponent(url);

  const patterns = [
    /(?:^|[/?#&_\-])((?:MLA|MLU|MLB|MLC|MCO|MPE|MLM|MEC)[-_]?\d{6,})(?:[^0-9]|$)/i,
    /\b((?:MLA|MLU|MLB|MLC|MCO|MPE|MLM|MEC)[-_]?\d{6,})\b/i,
    /item[_-]?id=([A-Z]{3}[-_]?\d{6,})/i,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/[-_]/g, "").toUpperCase();
    }
  }

  return "";
}

function attrValue(item: any, ids: string[], nameHints: string[] = []) {
  const attrs: any[] = Array.isArray(item?.attributes) ? item.attributes : [];
  const upperIds = ids.map((v) => v.toUpperCase());
  const lowerHints = nameHints.map((v) => v.toLowerCase());

  const found = attrs.find((a) => {
    const id = String(a?.id || "").toUpperCase();
    const name = String(a?.name || "").toLowerCase();

    return upperIds.includes(id) || lowerHints.some((hint) => name.includes(hint));
  });

  if (!found) return "";

  return (
    found.value_name ||
    found.value_struct?.number ||
    found.values?.[0]?.name ||
    found.values?.[0]?.struct?.number ||
    ""
  );
}

function areaFromMlAttr(value: unknown): number | "" {
  if (typeof value === "number") return normalizeNumberField(value);
  return normalizeNumberField(String(value || ""));
}

function locationTextFromML(item: any) {
  const parts = [
    item?.location?.address_line,
    item?.seller_address?.address_line,
    item?.location?.neighborhood?.name,
    item?.seller_address?.neighborhood?.name,
    item?.location?.city?.name,
    item?.seller_address?.city?.name,
    item?.location?.state?.name,
    item?.seller_address?.state?.name,
  ];

  return normalizeSpaces(parts.filter(Boolean).join(" | "));
}

async function getMercadoLibreItem(itemId: string) {
  const headers = {
    Accept: "application/json",
    "User-Agent": "VAIPropComparableImport/1.0 (+https://www.vaiprop.com)",
  };

  // Intento principal.
  const direct = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    method: "GET",
    headers,
  });

  if (direct.ok) {
    const item = await direct.json().catch(() => null);
    if (item?.id) return item;
  }

  // Fallback: endpoint batch.
  const batch = await fetch(`https://api.mercadolibre.com/items?ids=${itemId}`, {
    method: "GET",
    headers,
  });

  if (batch.ok) {
    const rows = await batch.json().catch(() => null);
    const item = Array.isArray(rows) ? rows[0]?.body : null;
    if (item?.id) return item;
  }

  return null;
}

async function fetchMercadoLibreData(rawUrl: string): Promise<ImportedComparable> {
  const itemId = extractMercadoLibreItemId(rawUrl);
  const warnings: string[] = [];

  if (!itemId) {
    return {
      source: "mercadolibre",
      url: rawUrl,
      address: "",
      neighborhood: "",
      price: "",
      currency: "",
      builtArea: "",
      landArea: "",
      daysPublished: "",
      daysPublishedText: "",
      imageUrl: "",
      warnings: [
        "No se pudo detectar el ID de Mercado Libre en el link.",
        "Cargá los datos manualmente.",
      ],
    };
  }

  const item = await getMercadoLibreItem(itemId);

  if (!item) {
    return {
      source: "mercadolibre",
      url: rawUrl,
      address: "",
      neighborhood: "",
      price: "",
      currency: "",
      builtArea: "",
      landArea: "",
      daysPublished: "",
      daysPublishedText: "",
      imageUrl: "",
      warnings: [
        "No se pudo leer la publicación desde Mercado Libre.",
        "Cargá los datos manualmente.",
      ],
    };
  }

  const title = normalizeSpaces(String(item?.title || ""));
  const isLand = isLandLikeListing(title, rawUrl);

  const builtArea =
    areaFromMlAttr(
      attrValue(
        item,
        [
          "COVERED_AREA",
          "COVERED_SURFACE",
          "COVERED_SURFACE_AREA",
          "BUILT_AREA",
          "CONSTRUCTED_AREA",
          "PROPERTY_COVERED_AREA",
        ],
        [
          "superficie cubierta",
          "metros cubiertos",
          "m² cubiertos",
          "m2 cubiertos",
          "cubierta",
          "cubiertos",
          "construida",
          "construidos",
        ]
      )
    ) || "";

  const totalArea =
    areaFromMlAttr(
      attrValue(
        item,
        [
          "TOTAL_AREA",
          "TOTAL_SURFACE",
          "TOTAL_SURFACE_AREA",
          "PROPERTY_SIZE",
          "PROPERTY_TOTAL_AREA",
          "LAND_AREA",
          "LOT_AREA",
          "AREA",
        ],
        [
          "superficie total",
          "metros totales",
          "m² totales",
          "m2 totales",
          "terreno",
          "lote",
          "total",
        ]
      )
    ) || "";

  const locationText = locationTextFromML(item);
  const guessed = guessAddressAndNeighborhoodFromText(`${title} | ${locationText}`, rawUrl);

  const address =
    normalizeSpaces(
      item?.location?.address_line ||
        item?.location?.addressLine ||
        item?.seller_address?.address_line ||
        item?.seller_address?.addressLine ||
        guessed.address ||
        title
    ) || "";

  const neighborhood =
    normalizeSpaces(
      item?.location?.neighborhood?.name ||
        item?.seller_address?.neighborhood?.name ||
        guessed.neighborhood ||
        item?.location?.city?.name ||
        item?.seller_address?.city?.name ||
        ""
    ) || "";

  const dateCreated = item?.date_created ? new Date(item.date_created) : null;
  let daysPublished: number | "" = "";
  let daysPublishedText = "";

  if (dateCreated && !Number.isNaN(dateCreated.getTime())) {
    const diffMs = Date.now() - dateCreated.getTime();
    const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    daysPublished = days;
    daysPublishedText = `${days} días`;
  }

  const data: ImportedComparable = {
    source: "mercadolibre",
    url: rawUrl,
    address,
    neighborhood,
    price: normalizeNumberField(item?.price),
    currency: normalizeCurrencyField(item?.currency_id),
    builtArea: isLand ? "" : builtArea,
    landArea: totalArea,
    daysPublished,
    daysPublishedText,
    imageUrl:
      item?.pictures?.[0]?.secure_url ||
      item?.pictures?.[0]?.url ||
      item?.secure_thumbnail ||
      item?.thumbnail ||
      "",
    warnings,
  };

  if (!data.address) warnings.push("No se pudo detectar dirección.");
  if (!data.neighborhood) warnings.push("No se pudo detectar barrio/zona.");
  if (!data.price) warnings.push("No se pudo detectar precio.");
  if (!data.builtArea && !data.landArea) warnings.push("No se pudo detectar superficie.");
  if (!data.daysPublished && data.daysPublished !== 0) {
    warnings.push("No se pudo detectar días de publicación.");
  }

  if (!data.builtArea && data.landArea && !isLand) {
    warnings.push(
      "Mercado Libre informó superficie total, pero no superficie cubierta. Revisá los m² antes de guardar."
    );
  }

  return data;
}

async function fetchHtml(rawUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(rawUrl, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-AR,es;q=0.9,en;q=0.7",
      },
    });

    if (!res.ok) {
      return {
        ok: false as const,
        status: res.status,
        html: "",
      };
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return {
        ok: false as const,
        status: 0,
        html: "",
      };
    }

    return {
      ok: true as const,
      status: res.status,
      html: await res.text(),
    };
  } finally {
    clearTimeout(timeout);
  }
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

    if (!isSupportedHost(host)) {
      return NextResponse.json(
        {
          ok: false,
          error: UNSUPPORTED_MESSAGE,
        },
        { status: 400 }
      );
    }

    const source = sourceFromHost(host);

    if (isMercadoLibreHost(host) || source === "mercadolibre") {
      const data = await fetchMercadoLibreData(rawUrl);
      return NextResponse.json({ ok: true, data });
    }

    const fetched = await fetchHtml(rawUrl);

    if (!fetched.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            fetched.status > 0
              ? `No se pudo leer la publicación. Estado HTTP ${fetched.status}.`
              : "La URL no devolvió una página HTML válida.",
        },
        { status: fetched.status === 403 ? 400 : 502 }
      );
    }

    const html = fetched.html;

    const ogTitle = getMetaContent(html, "og:title");
    const ogDescription = getMetaContent(html, "og:description");
    const ogImage = getMetaContent(html, "og:image");
    const metaDescription = getMetaContent(html, "description");
    const title = getTitle(html);

    const visibleText = stripTags(html);
    const combinedText = normalizeSpaces(
      [ogTitle, ogDescription, metaDescription, title, visibleText]
        .filter(Boolean)
        .join(" | ")
    );

    const jsonLd = extractFromJsonLd(html);
    const priceFromText = extractPrice(combinedText);
    const areas = extractAreas(combinedText);
    const days = extractDaysPublished(combinedText);
    const guessed = guessAddressAndNeighborhoodFromText(
      [ogTitle, title, ogDescription, visibleText].filter(Boolean).join(" | "),
      rawUrl
    );

    const isLand = isLandLikeListing(combinedText, rawUrl);
    const warnings: string[] = [];

    const builtCandidate = areas.builtArea || (isLand ? "" : jsonLd.builtArea) || "";
    const landCandidate =
      areas.landArea || (isLand ? jsonLd.builtArea : "") || jsonLd.landArea || "";

    const data: ImportedComparable = {
      source,
      url: rawUrl,
      address: jsonLd.address || guessed.address || "",
      neighborhood: jsonLd.neighborhood || guessed.neighborhood || "",
      price: normalizeNumberField(jsonLd.price || priceFromText.price),
      currency: normalizeCurrencyField(jsonLd.currency || priceFromText.currency),
      builtArea: normalizeNumberField(builtCandidate),
      landArea: normalizeNumberField(landCandidate),
      daysPublished: normalizeNumberField(days.daysPublished),
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

    if (!data.builtArea && data.landArea && !isLand) {
      warnings.push(
        "Se detectó superficie total/lote, pero no superficie cubierta. Revisá los m² antes de guardar."
      );
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
