const GEOREF_BASE_URLS = [
  "https://apis.datos.gob.ar/georef/api/v2.0",
  "https://apis.datos.gob.ar/georef/api",
] as const;

export type GeorefCentroide = {
  lat: number | null;
  lon: number | null;
};

export type ProvinciaNormalizada = {
  id: string;
  nombre: string;
  centroide: GeorefCentroide;
};

export type LocalidadNormalizada = {
  id: string;
  nombre: string;
  provincia: {
    id: string;
    nombre: string;
  };
  departamento: {
    id: string | null;
    nombre: string | null;
  };
  municipio: {
    id: string | null;
    nombre: string | null;
  };
  centroide: GeorefCentroide;
};

type GeorefRecord = Record<string, any>;

function toFiniteNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCentroide(value: unknown): GeorefCentroide {
  const centroide =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    lat: toFiniteNumber(centroide.lat),
    lon: toFiniteNumber(centroide.lon),
  };
}

function normalizeNestedEntity(
  value: unknown,
): { id: string | null; nombre: string | null } {
  if (!value || typeof value !== "object") {
    return {
      id: null,
      nombre: null,
    };
  }

  const entity = value as Record<string, unknown>;

  return {
    id:
      entity.id === null || entity.id === undefined
        ? null
        : String(entity.id),
    nombre:
      typeof entity.nombre === "string" && entity.nombre.trim() !== ""
        ? entity.nombre.trim()
        : null,
  };
}

function getArrayFromPayload(
  payload: unknown,
  possibleKeys: string[],
): GeorefRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (item): item is GeorefRecord =>
        Boolean(item) && typeof item === "object",
    );
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const data = payload as Record<string, unknown>;

  for (const key of possibleKeys) {
    const value = data[key];

    if (Array.isArray(value)) {
      return value.filter(
        (item): item is GeorefRecord =>
          Boolean(item) && typeof item === "object",
      );
    }
  }

  if (data.resultado && typeof data.resultado === "object") {
    return getArrayFromPayload(data.resultado, possibleKeys);
  }

  if (data.resultados && Array.isArray(data.resultados)) {
    return data.resultados.filter(
      (item): item is GeorefRecord =>
        Boolean(item) && typeof item === "object",
    );
  }

  return [];
}

async function fetchFromGeoref(
  resource: string,
  searchParams: URLSearchParams,
  revalidate: number,
): Promise<unknown> {
  let lastError: unknown = null;

  for (const baseUrl of GEOREF_BASE_URLS) {
    const url = `${baseUrl}/${resource}?${searchParams.toString()}`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
        next: {
          revalidate,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Georef respondió ${response.status} ${response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No fue posible consultar Georef.");
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function getProvincias(): Promise<ProvinciaNormalizada[]> {
  const params = new URLSearchParams({
    campos: "id,nombre,centroide",
    orden: "nombre",
    max: "30",
  });

  const payload = await fetchFromGeoref(
    "provincias",
    params,
    60 * 60 * 24,
  );

  const records = getArrayFromPayload(payload, ["provincias"]);

  return records
    .map((record): ProvinciaNormalizada | null => {
      if (record.id === null || record.id === undefined) {
        return null;
      }

      if (typeof record.nombre !== "string" || record.nombre.trim() === "") {
        return null;
      }

      return {
        id: String(record.id),
        nombre: record.nombre.trim(),
        centroide: normalizeCentroide(record.centroide),
      };
    })
    .filter(
      (item): item is ProvinciaNormalizada =>
        item !== null,
    )
    .sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es-AR", {
        sensitivity: "base",
      }),
    );
}

export async function getLocalidades(
  provincia: string,
): Promise<LocalidadNormalizada[]> {
  const params = new URLSearchParams({
    provincia,
    campos:
      "id,nombre,provincia,departamento,municipio,centroide",
    orden: "nombre",
    max: "5000",
  });

  const payload = await fetchFromGeoref(
    "localidades",
    params,
    60 * 60 * 12,
  );

  const records = getArrayFromPayload(payload, ["localidades"]);

  return records
    .map((record): LocalidadNormalizada | null => {
      const provinciaRecord = normalizeNestedEntity(record.provincia);
      const departamentoRecord = normalizeNestedEntity(record.departamento);
      const municipioRecord = normalizeNestedEntity(record.municipio);

      if (record.id === null || record.id === undefined) {
        return null;
      }

      if (typeof record.nombre !== "string" || record.nombre.trim() === "") {
        return null;
      }

      if (!provinciaRecord.id || !provinciaRecord.nombre) {
        return null;
      }

      return {
        id: String(record.id),
        nombre: record.nombre.trim(),
        provincia: {
          id: provinciaRecord.id,
          nombre: provinciaRecord.nombre,
        },
        departamento: departamentoRecord,
        municipio: municipioRecord,
        centroide: normalizeCentroide(record.centroide),
      };
    })
    .filter(
      (item): item is LocalidadNormalizada =>
        item !== null,
    )
    .sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es-AR", {
        sensitivity: "base",
      }),
    );
}
