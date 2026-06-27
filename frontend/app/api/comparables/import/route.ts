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

type PartialComparable = Partial<Omit<ImportedComparable, "warnings" | "source" | "url">>;

const SUPPORTED_ROOT_DOMAINS = [
  // Portales visibles/soportados para clientes
  "argenprop.com",
  "properati.com.ar",
  "properati.com",
  "inmoclick.com.ar",
  "cordobaprop.com",
  "buscadorprop.com.ar",
  "buscadorprop.com",

  // Portales soportados de forma interna/estratégica.
  // No se nombran en el mensaje público de error.
  "openinmo.com.ar",
  "remax.com.ar",
];

const UNSUPPORTED_MESSAGE =
  "El botón de Autocompletar solo funciona para Argenprop, Properati, Inmoclick, Cordobaprop y BuscadorProp por el momento. Cargá los datos manualmente.";

function isHostFromDomain(host: string, domain: string) {
  const cleanHost = String(host || "").toLowerCase();
  return cleanHost === domain || cleanHost.endsWith(`.${domain}`);
}

function isSupportedHost(host: string) {
  return SUPPORTED_ROOT_DOMAINS.some((domain) => isHostFromDomain(host, domain));
}

function normalizeSpaces(text: string) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\|{2,}/g, "|")
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

function htmlToReadableText(html: string) {
  const withSeparators = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?(?:p|div|section|article|li|ul|ol|tr|td|th|br|h1|h2|h3|h4|h5|h6|dt|dd)[^>]*>/gi, " | ")
    .replace(/<[^>]+>/g, " ");

  return normalizeSpaces(decodeBasicHtmlEntities(withSeparators));
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
  let clean = String(raw || "")
    .replace(/\s/g, "")
    .replace(/[^\d.,]/g, "")
    .trim();

  if (!clean) return "";

  const hasDot = clean.includes(".");
  const hasComma = clean.includes(",");

  if (hasDot && hasComma) {
    const lastDot = clean.lastIndexOf(".");
    const lastComma = clean.lastIndexOf(",");

    // Si la coma aparece al final con 1-2 decimales, la tratamos como decimal.
    // Si la coma tiene 3 dígitos después, la tratamos como separador de miles.
    if (lastComma > lastDot) {
      const after = clean.slice(lastComma + 1);
      clean = after.length === 3
        ? clean.replace(/[.,]/g, "")
        : clean.replace(/\./g, "").replace(",", ".");
    } else {
      const after = clean.slice(lastDot + 1);
      clean = after.length === 3
        ? clean.replace(/[.,]/g, "")
        : clean.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = clean.split(",");
    const last = parts[parts.length - 1] || "";
    clean = last.length === 3 ? clean.replace(/,/g, "") : clean.replace(",", ".");
  } else if (hasDot) {
    const parts = clean.split(".");
    const last = parts[parts.length - 1] || "";
    clean = last.length === 3 ? clean.replace(/\./g, "") : clean;
  }

  const n = Number(clean);
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

function sliceAround(text: string, start: number, size = 80) {
  return text.slice(Math.max(0, start - size), Math.min(text.length, start + size));
}

function extractPrice(text: string): { price: number | ""; currency: Currency } {
  const clean = normalizeSpaces(text);
  const candidates: Array<{ price: number; currency: Currency; idx: number; raw: string; score: number }> = [];

  const patterns = [
    /(?:USD|U\$S|US\$)\s*([\d.,]+)/gi,
    /([\d.,]+)\s*(?:USD|U\$S|US\$)/gi,
    /(?:ARS)\s*([\d.,]+)/gi,
    /\$\s*([\d.,]+)/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(clean)) !== null) {
      const raw = match[1] || "";
      const price = parseNumber(raw);
      if (price === "" || price <= 0) continue;

      const token = match[0] || "";
      const currency = /USD|U\$S|US\$/i.test(token) ? "USD" : "ARS";
      const context = sliceAround(clean, match.index, 90).toLowerCase();

      // Evita tomar expensas, cuotas, impuestos, teléfonos o precios accesorios.
      if (/expensas?|exp\.|cuota|anticipo|honorarios?|comisi[oó]n|whatsapp|tel[eé]fono|celular|matr[ií]cula|cpi/.test(context)) {
        continue;
      }

      let score = 0;
      if (currency === "USD") score += 30;
      if (/venta|precio|valor|u\$s|usd/.test(context)) score += 10;
      if (price >= 10000) score += 10;
      if (price < 1000) score -= 20;
      if (match.index < 1500) score += 5;

      candidates.push({ price, currency, idx: match.index, raw: token, score });
    }
  }

  if (candidates.length === 0) return { price: "", currency: "" };

  candidates.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return { price: candidates[0].price, currency: candidates[0].currency };
}

function cleanExtractedValue(value: string) {
  return normalizeSpaces(value)
    .replace(/^[.:\-–—]+\s*/, "")
    .replace(/\s*(Consultar|Volver|Características|Informaci[oó]n|Superficie|Dormitorios|Baños|Ambientes|Venta|Alquiler).*$/i, "")
    .trim();
}

function extractValueAfterLabel(text: string, labels: string[], maxLen = 95) {
  const clean = normalizeSpaces(text);

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `(?:^|\\||\\n)\\s*${escaped}\\s*:?\\s*([^|\\n]{1,${maxLen}})`,
      "i"
    );
    const match = clean.match(pattern);

    if (match?.[1]) {
      const value = cleanExtractedValue(match[1]);
      if (value && !labels.some((l) => value.toLowerCase() === l.toLowerCase())) return value;
    }
  }

  return "";
}

function findAreaNearLabel(text: string, labels: string[]): number | "" {
  const clean = normalizeSpaces(text).replace(/m\s*\^?\s*\{?2\}?/gi, "m2");

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const patterns = [
      new RegExp(`(?:^|\\||\\n)\\s*(?:${escaped})\\s*:?\\s*([\\d.,]+)\\s*m\\s*(?:²|2)?`, "i"),
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

function extractAreas(text: string): { builtArea: number | ""; landArea: number | "" } {
  const builtArea =
    findAreaNearLabel(text, [
      "superficie cubierta",
      "sup. cubierta",
      "sup cubierta",
      "m² cubiertos",
      "m2 cubiertos",
      "m² cubiertas",
      "m2 cubiertas",
      "metros cubiertos",
      "cubiertos",
      "cubierto",
      "cubierta",
      "total construido",
      "total construído",
      "construidos",
      "construido",
      "m² construidos",
      "m2 construidos",
      "área cubierta",
      "area cubierta",
    ]) || "";

  const landArea =
    findAreaNearLabel(text, [
      "superficie total / terreno",
      "superficie total",
      "sup. total",
      "sup total",
      "m² totales",
      "m2 totales",
      "m² total",
      "m2 total",
      "metros totales",
      "superficie del terreno",
      "sup. terreno",
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

function parseDateToDays(raw: string): { daysPublished: number | ""; daysPublishedText: string } {
  const clean = normalizeSpaces(raw);
  const match = clean.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (!match) return { daysPublished: "" as number | "", daysPublishedText: "" };

  const dd = Number(match[1]);
  const mm = Number(match[2]);
  let yy = Number(match[3]);
  if (yy < 100) yy += 2000;

  const d = new Date(yy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return { daysPublished: "" as number | "", daysPublishedText: "" };

  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
  return { daysPublished: days, daysPublishedText: `${days} días` };
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

  const dateValue = extractValueAfterLabel(text, ["Fecha de ingreso", "Publicado", "Fecha publicación", "Fecha de publicación"], 45);
  if (dateValue) {
    const fromDate = parseDateToDays(dateValue);
    if (fromDate.daysPublished !== "") return fromDate;
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
  }

  return result;
}

function isLandLikeListing(text: string, url: string) {
  const clean = `${text} ${url}`.toLowerCase();
  return /\b(lote|terreno|campo|fracci[oó]n|hect[aá]rea|ha\.?)\b/i.test(clean);
}

function looksLikeBadAddress(value: string) {
  const clean = normalizeSpaces(value).toLowerCase();
  if (!clean) return true;
  if (clean.length > 90) return true;
  if (/venta|alquiler|departamento|casa|duplex|dúplex|terreno|oportunidad|inversi[oó]n/.test(clean) && !/\d{1,5}/.test(clean)) return true;
  if (/usd|u\$s|ars|precio|superficie|dormitorios|baños|ambientes/.test(clean)) return true;
  return false;
}

function extractStreetAddress(text: string) {
  const clean = normalizeSpaces(text);

  const patterns = [
    /\b([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9.'\s-]{2,70}\s+(?:al\s+)?\d{1,5})\b/,
    /\b([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9.'\s-]{2,70}\s+N[°º]?\s*\d{1,5})\b/i,
    /\b(?:calle|av\.?|avenida)\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9.'\s-]{2,70}\s+(?:al\s+)?\d{1,5})\b/i,
    /\b(?:ubicad[oa]\s+en|sito\s+en|en\s+calle)\s+([^|,.]{4,85}\s+(?:al\s+)?\d{1,5})\b/i,
  ];

  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match?.[1]) {
      const value = cleanExtractedValue(match[1]);
      if (!looksLikeBadAddress(value)) return value;
    }
  }

  return "";
}

function extractNeighborhoodFromSlug(url: string) {
  try {
    const u = new URL(url);
    const slug = decodeURIComponent(u.pathname)
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();

    const patterns = [
      /\ben\s+([a-záéíóúñ\s]{3,45})(?:\s+piso|\s+etapa|\s+cordoba|\s+c[oó]rdoba|$)/i,
      /\bbarrio\s+([a-záéíóúñ\s]{3,45})(?:\s+complejo|\s+cordoba|\s+c[oó]rdoba|$)/i,
      /\bventa\s+(?:de\s+)?(?:departamento|casa|duplex|dúplex|terreno|lote)[^\s]*\s+en\s+([a-záéíóúñ\s]{3,45})(?:\s|$)/i,
    ];

    for (const pattern of patterns) {
      const match = slug.match(pattern);
      if (match?.[1]) {
        return normalizeSpaces(match[1]).replace(/\b(cordoba|córdoba|venta|departamento|casa)$/i, "").trim();
      }
    }
  } catch {
    // no-op
  }

  return "";
}

function guessAddressAndNeighborhoodFromText(text: string, url: string) {
  const clean = normalizeSpaces(text);
  const result = {
    address: "",
    neighborhood: "",
  };

  const labeledAddress = extractValueAfterLabel(clean, ["Dirección", "Direccion", "Ubicación", "Ubicacion"], 90);
  if (labeledAddress && !looksLikeBadAddress(labeledAddress)) {
    result.address = labeledAddress;
  }

  if (!result.address) {
    result.address = extractStreetAddress(clean);
  }

  const labeledNeighborhood = extractValueAfterLabel(clean, ["Barrio", "Zona", "Ubicación", "Ubicacion", "Localidad"], 70);
  if (labeledNeighborhood && !/c[oó]rdoba capital|cordoba capital|argentina/i.test(labeledNeighborhood)) {
    result.neighborhood = labeledNeighborhood;
  }

  if (!result.neighborhood) {
    const titleLike = clean.slice(0, 1200);
    const barrioMatch =
      titleLike.match(/\bbarrio\s+([^,|.-]{3,60})(?:,|\||-|\s+complejo)/i) ||
      titleLike.match(/\ben\s+([^,|.-]{3,60})(?:,|\||-|\s+piso|\s+etapa)/i);

    if (barrioMatch?.[1]) {
      const value = normalizeSpaces(barrioMatch[1]);
      if (!/venta|alquiler|departamento|casa|duplex|dúplex/i.test(value)) {
        result.neighborhood = value;
      }
    }
  }

  if (!result.neighborhood) {
    result.neighborhood = extractNeighborhoodFromSlug(url);
  }

  return result;
}

function sourceFromHost(host: string) {
  if (host.includes("argenprop")) return "argenprop";
  if (host.includes("properati")) return "properati";
  if (host.includes("inmoclick")) return "inmoclick";
  if (host.includes("cordobaprop")) return "cordobaprop";
  if (host.includes("buscadorprop")) return "buscadorprop";
  if (host.includes("openinmo")) return "openinmo";
  if (host.includes("remax")) return "remax";
  return "desconocido";
}

function extractSourceSpecificData(source: string, text: string, metaText: string, url: string): PartialComparable {
  const full = normalizeSpaces(`${metaText} | ${text}`);
  const result: PartialComparable = {};

  if (source === "openinmo") {
    result.address = extractValueAfterLabel(full, ["Dirección", "Direccion"], 90);
    result.neighborhood = extractValueAfterLabel(full, ["Ubicación", "Ubicacion"], 70);
    result.builtArea = findAreaNearLabel(full, ["Cubierta", "Total construido", "Total construído", "Superficie cubierta"]);
    result.landArea = findAreaNearLabel(full, ["Terreno", "Superficie total", "Sup. total"]);
    return result;
  }

  if (source === "cordobaprop") {
    result.address = extractValueAfterLabel(full, ["Dirección", "Direccion"], 90);
    result.neighborhood = extractValueAfterLabel(full, ["Barrio"], 70);
    result.builtArea = findAreaNearLabel(full, ["Superficie cubierta", "Sup. Cubierta"]);
    result.landArea = findAreaNearLabel(full, ["Superficie total / terreno", "Sup. Terreno", "Superficie total"]);
    const dateValue = extractValueAfterLabel(full, ["Fecha de ingreso"], 45);
    if (dateValue) {
      const days = parseDateToDays(dateValue);
      result.daysPublished = days.daysPublished;
      result.daysPublishedText = days.daysPublishedText;
    }
    return result;
  }

  if (source === "buscadorprop") {
    result.address = extractStreetAddress(full);
    result.neighborhood = extractNeighborhoodFromSlug(url) || "";
    result.builtArea = findAreaNearLabel(full, ["Superficie cubierta", "Sup. cubierta", "m² cubiertos", "m2 cubiertos"]);
    result.landArea = findAreaNearLabel(full, ["Superficie total", "Sup. total", "m² totales", "m2 totales"]);
    return result;
  }

  if (source === "properati") {
    // En Properati la dirección suele aparecer en la descripción; evitamos usar el título completo.
    result.address = extractStreetAddress(full);
    result.neighborhood = extractNeighborhoodFromSlug(url) || "";
    const areas = extractAreas(full);
    result.builtArea = areas.builtArea;
    result.landArea = areas.landArea;
    return result;
  }

  if (source === "remax") {
    result.address = extractValueAfterLabel(full, ["Dirección", "Direccion", "Ubicación", "Ubicacion"], 90) || extractStreetAddress(full);
    result.neighborhood = extractNeighborhoodFromSlug(url) || extractValueAfterLabel(full, ["Barrio", "Zona", "Localidad"], 70);
    const areas = extractAreas(full);
    result.builtArea = areas.builtArea;
    result.landArea = areas.landArea;
    return result;
  }

  if (source === "argenprop" || source === "inmoclick") {
    result.address = extractValueAfterLabel(full, ["Dirección", "Direccion", "Ubicación", "Ubicacion"], 90) || extractStreetAddress(full);
    result.neighborhood = extractValueAfterLabel(full, ["Barrio", "Zona", "Localidad", "Ubicación", "Ubicacion"], 70) || extractNeighborhoodFromSlug(url);
    const areas = extractAreas(full);
    result.builtArea = areas.builtArea;
    result.landArea = areas.landArea;
    return result;
  }

  return result;
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

    const visibleText = htmlToReadableText(html);
    const metaText = normalizeSpaces([ogTitle, title, ogDescription, metaDescription].filter(Boolean).join(" | "));
    const combinedText = normalizeSpaces([metaText, visibleText].filter(Boolean).join(" | "));

    const jsonLd = extractFromJsonLd(html);
    const priceFromText = extractPrice(combinedText);
    const areas = extractAreas(combinedText);
    const days = extractDaysPublished(combinedText);
    const guessed = guessAddressAndNeighborhoodFromText(combinedText, rawUrl);
    const sourceSpecific = extractSourceSpecificData(source, visibleText, metaText, rawUrl);

    const isLand = isLandLikeListing(combinedText, rawUrl);
    const warnings: string[] = [];

    const builtCandidate =
      sourceSpecific.builtArea ||
      areas.builtArea ||
      (isLand ? "" : jsonLd.builtArea) ||
      "";

    const landCandidate =
      sourceSpecific.landArea ||
      areas.landArea ||
      (isLand ? jsonLd.builtArea : "") ||
      jsonLd.landArea ||
      "";

    const addressCandidate =
      sourceSpecific.address ||
      (jsonLd.address && !looksLikeBadAddress(jsonLd.address) ? jsonLd.address : "") ||
      guessed.address ||
      "";

    const neighborhoodCandidate =
      sourceSpecific.neighborhood ||
      jsonLd.neighborhood ||
      guessed.neighborhood ||
      "";

    const data: ImportedComparable = {
      source,
      url: rawUrl,
      address: looksLikeBadAddress(addressCandidate) ? "" : normalizeSpaces(addressCandidate),
      neighborhood: normalizeSpaces(neighborhoodCandidate),
      price: normalizeNumberField(jsonLd.price || priceFromText.price),
      currency: normalizeCurrencyField(jsonLd.currency || priceFromText.currency),
      builtArea: normalizeNumberField(builtCandidate),
      landArea: normalizeNumberField(landCandidate),
      daysPublished: normalizeNumberField(sourceSpecific.daysPublished || days.daysPublished),
      daysPublishedText: sourceSpecific.daysPublishedText || days.daysPublishedText,
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
