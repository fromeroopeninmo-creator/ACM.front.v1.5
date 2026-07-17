'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from "@/context/ThemeContext";
import {
  ACMFormData,
  ComparableProperty,
  LocationQuality,
  Orientation,
  PropertyCondition,
  PropertyType,
  Services,
  TitleType,
} from "@/types/acm.types";
// import { createACMAnalysis } from '../lib/api'; // ← no se usa hoy, lo dejo comentado para evitar warnings
import { useAuth } from "@/context/AuthContext";

/** =========================
 *  Helpers / Utils
 *  ========================= */

function dataUrlToFile(dataUrl: string, filename: string) {
  const arr = dataUrl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const bstr = typeof window !== "undefined" ? atob(arr[1]) : Buffer.from(arr[1], "base64").toString("binary");
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

type OperationType = "venta" | "alquiler";
type CurrencyType = "ARS" | "USD";
type ACMFormDataWithExtras = ACMFormData & {
  operationType: OperationType;
  currency: CurrencyType;
  includePER: boolean;
  estimatedMonthlyRentUSD: number | string;
};

type ComparableImportState = {
  loading: boolean;
  type?: "success" | "error";
  text?: string;
};

type ImportedComparableData = {
  source?: string;
  url?: string;
  address?: string;
  neighborhood?: string;
  price?: number | "";
  currency?: "USD" | "ARS" | "";
  builtArea?: number | "";
  landArea?: number | "";
  daysPublished?: number | "";
  daysPublishedText?: string;
  imageUrl?: string;
  warnings?: string[];
};

const MAX_COMPARABLES = 8;

const comparableSlots = [
  "comp1",
  "comp2",
  "comp3",
  "comp4",
  "comp5",
  "comp6",
  "comp7",
  "comp8",
] as const;

const operationOptions: Array<{ label: string; value: OperationType }> = [
  { label: "Venta", value: "venta" },
  { label: "Alquiler", value: "alquiler" },
];

const currencyOptions: Array<{ label: string; value: CurrencyType }> = [
  { label: "Pesos ($)", value: "ARS" },
  { label: "Dólar Estadounidense (USD)", value: "USD" },
];

const formatMoney = (n: number, currency: CurrencyType = "ARS") => {
  if (isNaN(n)) return "-";

  if (currency === "USD") {
    return `USD ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  }

  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
};

const isLandLikePropertyType = (propertyType: unknown) => {
  const value = String(propertyType || "").toLowerCase();
  return (
    value.includes("lote") ||
    value.includes("terreno") ||
    value.includes("campo")
  );
};

const getPERInfo = (per: number | null) => {
  if (!per || !isFinite(per)) {
    return { label: "Sin calcular", className: "text-gray-600", pdfColor: [90, 90, 90] as const };
  }

  if (per < 15) {
    return { label: "Buena Oportunidad", className: "text-green-700", pdfColor: [22, 163, 74] as const };
  }

  if (per <= 20) {
    return { label: "Rentabilidad Aceptable", className: "text-yellow-700", pdfColor: [202, 138, 4] as const };
  }

  return { label: "Inversión Riesgosa", className: "text-red-700", pdfColor: [220, 38, 38] as const };
};

const numero = (n: number, dec = 0) =>
  isNaN(n) ? '-' : n.toLocaleString('es-AR', { maximumFractionDigits: dec, minimumFractionDigits: dec });

const yesNoOpts = [
  { label: 'No', value: 'false' },
  { label: 'Sí', value: 'true' },
];

const enumToOptions = <T extends Record<string, string>>(e: T) =>
  Object.values(e)
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ label: v, value: v }));

/** =========================
 *  Estado inicial
 *  ========================= */
const emptyServices: Services = {
  luz: false,
  agua: false,
  gas: false,
  cloacas: false,
  pavimento: false,
};

const emptyComparable: ComparableProperty = {
  builtArea: "",
  price: "",
  listingUrl: '',
  description: '',
  daysPublished: "",
  pricePerM2: "",
  coefficient: "1.0",
  address: '',
  neighborhood: '',
  photoBase64: undefined,
};

const makeInitialData = (): ACMFormDataWithExtras => ({
  date: new Date().toISOString(),
  operationType: "venta",
  currency: "USD",
  includePER: false,
  estimatedMonthlyRentUSD: "",
  clientName: '',
  phone: '',
  email: '',
  address: '',
  neighborhood: '',
  locality: '',
  propertyType: PropertyType.CASA,
  landArea: "",
  builtArea: "",
  hasPlans: false,
  titleType: TitleType.ESCRITURA,
  age: "",
  condition: PropertyCondition.BUENO,
  locationQuality: LocationQuality.BUENA,
  orientation: Orientation.NORTE,
  services: { ...emptyServices },
  isRented: false,
  mainPhotoUrl: '',
  mainPhotoBase64: undefined,
  comparables: [{ ...emptyComparable }],
  observations: '',
  considerations: '',
  strengths: '',
  weaknesses: '',
});

export default function ACMForm() {
  const { user } = useAuth();
  const [formData, setFormData] = useState<ACMFormDataWithExtras>(() => makeInitialData());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Mensajes inline y manejo de carga/ID ---
  type InlineMsg = { type: "success" | "error"; text: string } | null;
  const [saveMsg, setSaveMsg] = useState<InlineMsg>(null);
  const [informeId, setInformeId] = useState<string | null>(null);
  const [comparableImportStatus, setComparableImportStatus] = useState<Record<number, ComparableImportState>>({});

  // Theme...
  const theme = useTheme();
  const themePrimaryColor = (theme as any)?.primaryColor as string | undefined;
  const themeCompanyName = (theme as any)?.companyName as string | undefined;
  const themeLogoUrl = (theme as any)?.logoUrlBusted ?? (theme as any)?.logoUrl ?? undefined;
  const effectivePrimaryColor = themePrimaryColor || "#0ea5e9";

  // Refs...
  const mainPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const compPhotoInputsRef = useRef<Array<HTMLInputElement | null>>([]);

  /** ========= Fecha auto ========= */
  useEffect(() => {
    if (!formData.date) {
      setFormData((prev) => ({ ...prev, date: new Date().toISOString() }));
    }
  }, [formData.date]);

 /** ========= Autoload por query (?id= o ?informeId=) ========= */
useEffect(() => {
  const autoLoad = async () => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    const id = qs.get("id") || qs.get("informeId");
    if (!id) return;

    try {
      const res = await fetch(`/api/informes/get?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo obtener el informe");

      const inf = data?.informe ?? data; // compat
      const payload = inf?.datos_json;
      if (!payload) throw new Error("El informe no contiene datos_json");

      const principalUrl: string = inf?.imagen_principal_url || "";
      const compUrls: string[] = comparableSlots.map((slot) => inf?.[`${slot}_url`] || "");

      // Cargar URLs en photoUrl y dejar photoBase64 vacío (no guardar URL como base64)
      const comparablesCargados = Array.isArray(payload?.comparables)
        ? payload.comparables.map((c: any, idx: number) => ({
            ...c,
            photoUrl: compUrls[idx] || c?.photoUrl || "",
            photoBase64: "",
          }))
        : formData.comparables;

      setFormData((prev) => ({
        ...prev,
        ...payload,
        mainPhotoUrl: principalUrl || prev.mainPhotoUrl || "",
        mainPhotoBase64: "", // no usar URL en base64
        comparables: comparablesCargados,
      }));
      setInformeId(inf?.id || id);
    } catch (e) {
      console.error("Autoload informe:", e);
    }
  };

  autoLoad();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

/** ========= Handlers ========= */
const handleFieldChange = (
  e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
) => {
  const { name, value } = e.target;
  const booleanFields = new Set([
    'hasPlans',
    'isRented',
    'includePER',
    'services.luz',
    'services.agua',
    'services.gas',
    'services.cloacas',
    'services.pavimento',
  ]);
  const numberFields = new Set(['landArea', 'builtArea', 'age', 'estimatedMonthlyRentUSD']);

  if (name.startsWith('services.')) {
    const key = name.split('.')[1] as keyof Services;
    setFormData((prev) => ({
      ...prev,
      services: { ...prev.services, [key]: value === 'true' },
    }));
    return;
  }

  if (booleanFields.has(name)) {
    setFormData((prev) => ({ ...prev, [name]: value === 'true' }));
    return;
  }

  if (numberFields.has(name)) {
    const n = Number(value);
    setFormData((prev) => ({ ...prev, [name]: isNaN(n) ? 0 : n }));
    return;
  }

  if (name === 'propertyType')
    setFormData((p) => ({ ...p, propertyType: value as PropertyType }));
  else if (name === 'titleType')
    setFormData((p) => ({ ...p, titleType: value as TitleType }));
  else if (name === 'condition')
    setFormData((p) => ({ ...p, condition: value as PropertyCondition }));
  else if (name === 'locationQuality')
    setFormData((p) => ({ ...p, locationQuality: value as LocationQuality }));
  else if (name === 'orientation')
    setFormData((p) => ({ ...p, orientation: value as Orientation }));
  else setFormData((prev) => ({ ...prev, [name]: value }));
};

/** ========= Comparables ========= */
const updateComparable = <K extends keyof ComparableProperty>(
  index: number,
  field: K,
  rawValue: string | number | null
) => {
  setFormData((prev) => {
    const copy = { ...prev };
    const arr = [...copy.comparables];

    const numericFields: Array<keyof ComparableProperty> = [
      "builtArea",
      "price",
      "daysPublished",
      "pricePerM2",
      "coefficient",
    ];

    let value: number | string | null = rawValue;

    // límites para el coeficiente (con 1 decimal)
    const COEF_MIN = 0.1;
    const COEF_MAX = 1.5;

    if (field === "coefficient") {
      // parseo seguro
      let n =
        rawValue === null || rawValue === ""
          ? NaN
          : typeof rawValue === "string"
          ? parseFloat(rawValue)
          : Number(rawValue);

      // si no es número, default 1.0
      if (!isFinite(n)) n = 1.0;

      // redondeo EXACTO a 1 decimal
      n = Math.round(n * 10) / 10;

      // clamp entre 0.1 y 1.5 (tolerando float)
      if (n < COEF_MIN - 1e-9) n = COEF_MIN;
      if (n > COEF_MAX + 1e-9) n = COEF_MAX;

      // guardamos como STRING con 1 decimal => "1.0", "0.7", etc.
      value = n.toFixed(1);
    } else if (numericFields.includes(field)) {
      const n =
        rawValue === null || rawValue === ""
          ? 0
          : typeof rawValue === "string"
          ? parseFloat(rawValue)
          : Number(rawValue);
      value = isNaN(n) ? 0 : n;
    }

    // aplicar el cambio
    arr[index] = { ...arr[index], [field]: value as any };

    // recalcular pricePerM2 en base a builtArea/price (independiente del coeficiente)
    const b = Number(arr[index].builtArea) || 0;
    const p = Number(arr[index].price) || 0;
    arr[index].pricePerM2 = b > 0 ? p / b : 0;

    copy.comparables = arr;
    return copy;
  });
};


const setComparableStatus = (index: number, status: ComparableImportState) => {
  setComparableImportStatus((prev) => ({
    ...prev,
    [index]: status,
  }));
};

const importComparableFromUrl = async (index: number) => {
  const url = String(formData.comparables[index]?.listingUrl || "").trim();

  if (!url) {
    setComparableStatus(index, {
      loading: false,
      type: "error",
      text: "Pegá primero el link de la publicación.",
    });
    return;
  }

  try {
    setComparableStatus(index, {
      loading: true,
      text: "Importando datos públicos...",
    });

    const res = await fetch("/api/comparables/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json?.ok) {
      throw new Error(json?.error || "No se pudo importar el comparable.");
    }

    const data = (json?.data || {}) as ImportedComparableData;

    setFormData((prev) => {
      const copy = { ...prev };
      const arr = [...copy.comparables];
      const current = arr[index];

      if (!current) return prev;

      const isLandLike = isLandLikePropertyType(copy.propertyType);
      const importedArea = isLandLike
        ? data.landArea || data.builtArea || ""
        : data.builtArea || data.landArea || "";

      const next: ComparableProperty = {
        ...current,
        listingUrl: url,
        address: data.address || current.address || "",
        neighborhood: data.neighborhood || current.neighborhood || "",
        price:
          typeof data.price === "number" && Number.isFinite(data.price)
            ? data.price
            : current.price,
        builtArea:
          typeof importedArea === "number" && Number.isFinite(importedArea)
            ? importedArea
            : current.builtArea,
        daysPublished:
          typeof data.daysPublished === "number" && Number.isFinite(data.daysPublished)
            ? data.daysPublished
            : current.daysPublished,
      };

      const built = Number(next.builtArea) || 0;
      const price = Number(next.price) || 0;
      next.pricePerM2 = built > 0 ? price / built : 0;

      arr[index] = next;
      copy.comparables = arr;
      return copy;
    });

    const warnings = Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : [];
    const currencyWarning =
      data.currency && data.currency !== currency
        ? ` La publicación parece estar en ${data.currency}, pero el informe está en ${currency}. Revisá el precio.`
        : "";

    setComparableStatus(index, {
      loading: false,
      type: warnings.length ? "error" : "success",
      text: warnings.length
        ? `Datos importados parcialmente. Revisá/corregí antes de guardar.${currencyWarning}`
        : `Datos importados. Revisá/corregí antes de guardar.${currencyWarning}`,
    });
  } catch (err: any) {
    console.error("Importar comparable:", err);
    setComparableStatus(index, {
      loading: false,
      type: "error",
      text: err?.message || "No se pudo importar el comparable.",
    });
  }
};

const addComparable = () => {
  setFormData((prev) => {
    if (prev.comparables.length >= MAX_COMPARABLES) return prev;
    return {
      ...prev,
      comparables: [...prev.comparables, { ...emptyComparable }],
    };
  });
};

const removeComparable = (index: number) => {
  setFormData((prev) => {
    if (prev.comparables.length <= 1) return prev;
    const arr = prev.comparables.slice();
    arr.splice(index, 1);
    return { ...prev, comparables: arr };
  });
};


/** ========= Uploads ========= */
// Comprimir a JPEG ≤ 40KB y máx 560px (suficiente para miniaturas del PDF)
async function compressFileToDataUrl(
  file: File,
  opts?: {
    maxWidth?: number;
    maxHeight?: number;
    maxBytes?: number;
    initialQuality?: number; // 0..1
    minQuality?: number;     // 0..1
    step?: number;           // decremento por iteración
  }
): Promise<string> {
  const {
    maxWidth = 560,
    maxHeight = 560,
    maxBytes = 40 * 1024,   // 40 KB
    initialQuality = 0.7,
    minQuality = 0.3,
    step = 0.07,
  } = opts || {};

  // Cargar imagen
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(file);
  });

  // Calcular dimensiones destino manteniendo relación de aspecto
  let { width, height } = img;
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  width = Math.max(1, Math.floor(width * ratio));
  height = Math.max(1, Math.floor(height * ratio));

  // Canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // fallback: devolver el dataURL original (no ideal, pero evita romper flujo)
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  ctx.drawImage(img, 0, 0, width, height);

  // Iterar calidades hasta quedar ≤ maxBytes
  let q = initialQuality;
  let blob: Blob | null = null;
  while (q >= minQuality) {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", q)
    );
    if (blob && blob.size <= maxBytes) break;
    q -= step;
  }
  if (!blob) {
    blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b || new Blob()), "image/jpeg", minQuality)
    );
  }

  // A dataURL
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob!);
  });

  // Liberar URL de objeto
  URL.revokeObjectURL(img.src);

  return dataUrl;
}

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// Helper para distinguir data URLs reales (evita tratar URLs como base64)
const isDataUrl = (s?: string) => !!s && s.startsWith("data:image/");

const handleMainPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const f = e.target.files?.[0];
  if (!f) return;
  // Comprimir a ≤ 40KB
  const b64 = await compressFileToDataUrl(f, {
    maxWidth: 560,
    maxHeight: 560,
    maxBytes: 40 * 1024,
    initialQuality: 0.7,
    minQuality: 0.3,
    step: 0.07,
  });
  setFormData((prev) => ({ ...prev, mainPhotoBase64: b64, mainPhotoUrl: '' }));
  if (mainPhotoInputRef.current) mainPhotoInputRef.current.value = '';
};

const handleComparablePhotoSelect = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
  const f = e.target.files?.[0];
  if (!f) return;
  // Comprimir a ≤ 40KB
  const b64 = await compressFileToDataUrl(f, {
    maxWidth: 560,
    maxHeight: 560,
    maxBytes: 40 * 1024,
    initialQuality: 0.7,
    minQuality: 0.3,
    step: 0.07,
  });
  setFormData((prev) => {
    const arr = prev.comparables.slice();
    arr[index] = { ...arr[index], photoBase64: b64 };
    return { ...prev, comparables: arr };
  });
  e.target.value = '';
};

/** ========= Guardar Informe (API) ========= */
const saveInforme = async () => {
  try {
    setIsSubmitting(true);
    setSaveMsg(null);

    // 1) Clonar y limpiar base64 para no guardar blobs enormes en datos_json
    const datosLimpios = structuredClone(formData) as ACMFormDataWithExtras;

    // Actualiza la fecha del informe cada vez que se guarda.
    // Esto evita que un informe viejo siga mostrando la fecha original.
    datosLimpios.date = new Date().toISOString();

    const mainB64 = datosLimpios.mainPhotoBase64; // (YA COMPRIMIDO)
    datosLimpios.mainPhotoBase64 = undefined;

    const compsB64 = formData.comparables.map((c) => c.photoBase64 || undefined);

    datosLimpios.comparables = datosLimpios.comparables.map((c) => ({
      ...c,
      photoBase64: undefined,
    }));

    // 2) Crear/Actualizar informe (solo datos)
    const payload = {
      id: informeId || undefined, // <<--- si existe, actualiza; si no, crea
      datos: datosLimpios,
      titulo: (formData as any)?.titulo || "Informe VAI",
    };

    const res = await fetch("/api/informes/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errTxt = await res.text().catch(() => "");
      throw new Error(`Error al guardar el informe. ${errTxt}`);
    }

    const data = await res.json();
    const id = data?.informe?.id as string | undefined;

    if (!id) {
      throw new Error("No se recibió ID de informe.");
    }

    setInformeId(id);

    // 3) Subir imágenes (si había base64) y recolectar URLs NUEVAS en variables locales
    const newUrls = {
      principal: "",
      comps: Array(MAX_COMPARABLES).fill("") as string[],
    };

    // Principal (usa base64 YA COMPRIMIDO)
    if (isDataUrl(mainB64)) {
      const file = dataUrlToFile(mainB64!, "principal.jpg");
      const fd = new FormData();

      fd.append("file", file);
      fd.append("informeId", id);
      fd.append("slot", "principal");

      const up = await fetch("/api/informes/upload", {
        method: "POST",
        body: fd,
      });

      const upData = await up.json();

      if (up.ok && upData?.url) {
        newUrls.principal = String(upData.url);
      } else {
        console.warn("Upload principal falló:", upData?.error || up.statusText);
      }
    }

    // Comparables 1..8 (base64 YA COMPRIMIDOS)
    for (
      let i = 0;
      i < Math.min(formData.comparables.length, MAX_COMPARABLES);
      i++
    ) {
      const b64 = compsB64[i];

      if (!isDataUrl(b64)) continue;

      const slot = comparableSlots[i];
      const file = dataUrlToFile(b64!, `${slot}.jpg`);
      const fd = new FormData();

      fd.append("file", file);
      fd.append("informeId", id);
      fd.append("slot", slot);

      const up = await fetch("/api/informes/upload", {
        method: "POST",
        body: fd,
      });

      const upData = await up.json();

      if (up.ok && upData?.url) {
        newUrls.comps[i] = String(upData.url);
      } else {
        console.warn(`Upload ${slot} falló:`, upData?.error || up.statusText);
      }
    }

    // 4) Persistir en datos_json las URLs ya subidas (sin depender de setState)
    const datosConUrls: ACMFormDataWithExtras = (() => {
      const copy = structuredClone(datosLimpios) as ACMFormDataWithExtras;

      // Mantener la fecha nueva también en el segundo guardado
      copy.date = datosLimpios.date;

      // principal
      copy.mainPhotoUrl =
        newUrls.principal || formData.mainPhotoUrl || copy.mainPhotoUrl || "";

      copy.mainPhotoBase64 = undefined;

      // comparables
      copy.comparables = copy.comparables.map((c, idx) => ({
        ...c,
        photoUrl:
          newUrls.comps[idx] ||
          formData.comparables[idx]?.photoUrl ||
          c.photoUrl ||
          "",
        photoBase64: undefined as any,
      }));

      return copy;
    })();

    const upd = await fetch("/api/informes/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        datos: datosConUrls,
      }),
    });

    if (!upd.ok) {
      const t = await upd.text().catch(() => "");
      console.warn("Update datos_json con URLs falló:", t);
    }

    // Opcional: refrescar el estado visual con las URLs finales y la fecha nueva
    setFormData((prev) => {
      const withUrls = structuredClone(prev) as ACMFormDataWithExtras;

      // Actualizar también el estado en pantalla
      withUrls.date = datosConUrls.date;

      if (datosConUrls.mainPhotoUrl) {
        withUrls.mainPhotoUrl = datosConUrls.mainPhotoUrl;
      }

      withUrls.mainPhotoBase64 = "";

      withUrls.comparables = withUrls.comparables.map((c, i) => ({
        ...c,
        photoUrl: datosConUrls.comparables[i]?.photoUrl || c.photoUrl || "",
        photoBase64: "",
      }));

      return withUrls;
    });

    setSaveMsg({
      type: "success",
      text: `Informe guardado con éxito. ID: ${id}`,
    });
  } catch (err: any) {
    console.error("Guardar Informe", err);

    setSaveMsg({
      type: "error",
      text: err?.message || "No se pudo guardar el informe",
    });
  } finally {
    setIsSubmitting(false);
  }
};

  /** ========= Cálculos ========= */
const adjustedPricePerM2List = useMemo(
  () =>
    formData.comparables
      .filter((c) => {
        const built = Number(c.builtArea) || 0;
        const price = Number(c.price) || 0;
        return built > 0 && price > 0;
      })
      .map((c) => {
        const built = Number(c.builtArea) || 0;
        const price = Number(c.price) || 0;
        const coef = typeof c.coefficient === "number" ? c.coefficient : parseFloat(String(c.coefficient)) || 1;
        const base = (Number(c.pricePerM2) || (built > 0 ? price / built : 0));
        return (Number(base) || 0) * (Number(coef) || 1);
      }),
  [formData.comparables]
);

const averageAdjustedPricePerM2 = useMemo(() => {
  if (adjustedPricePerM2List.length === 0) return 0;
  return adjustedPricePerM2List.reduce((a, b) => a + b, 0) / adjustedPricePerM2List.length;
}, [adjustedPricePerM2List]);

const suggestedPrice = useMemo(() => {
  const built = Number(formData.builtArea) || 0;
  return Math.round(averageAdjustedPricePerM2 * built);
}, [averageAdjustedPricePerM2, formData.builtArea]);

const operationType = ((formData as any).operationType || "venta") as OperationType;
const currency = ((formData as any).currency || "ARS") as CurrencyType;
const operationLabel = operationType === "alquiler" ? "Alquiler" : "Venta";
const operationLabelLower = operationType === "alquiler" ? "alquiler" : "venta";
const suggestedPriceTitle = `Precio sugerido de ${operationLabelLower}`;
const comparablePriceLabel = `Precio ${operationType === "alquiler" ? "del alquiler" : "de venta"} (${currency === "USD" ? "USD" : "$"})`;
const money = (n: number) => formatMoney(n, currency);

const estimatedMonthlyRentUSD = Number((formData as any).estimatedMonthlyRentUSD) || 0;
const canCalculatePER =
  operationType === "venta" &&
  currency === "USD" &&
  suggestedPrice > 0 &&
  estimatedMonthlyRentUSD > 0;
const perValue = canCalculatePER
  ? suggestedPrice / (estimatedMonthlyRentUSD * 12)
  : null;
const perInfo = getPERInfo(perValue);

/** ========= Helpers PDF ========= */
const fetchToDataURL = async (url?: string | null): Promise<string | null> => {
  try {
    if (!url) return null;
    const r = await fetch(url);
    if (!r.ok) return null;
    const b = await r.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(b);
    });
  } catch {
    return null;
  }
};

/** ========= PDF ========= */
const handleDownloadPDF = async () => {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF("p", "pt", "a4");
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 38;
  let y = margin;

  // Datos (desde AuthContext / Theme)
  const anyUser = user as any;

  let matriculado = anyUser?.matriculado_nombre || "—";
  let cpi = anyUser?.cpi || "—";
  let inmobiliaria = themeCompanyName || anyUser?.inmobiliaria || "—";
  const asesorNombre =
    anyUser?.nombre && anyUser?.apellido
      ? `${anyUser.nombre} ${anyUser.apellido}`
      : "—";

  const role = (anyUser?.role || "").toLowerCase();
  const isAsesor = role === "asesor";

  // ⤵️ Si faltan datos clave, los completamos desde la tabla empresas
  if (inmobiliaria === "—" || matriculado === "—" || cpi === "—") {
    try {
      const { supabase } = await import("#lib/supabaseClient");

      let query = supabase
        .from("empresas")
        .select("id, nombre_comercial, matriculado, cpi, user_id")
        .limit(1);

      if (isAsesor && anyUser?.empresa_id) {
        query = query.eq("id", anyUser.empresa_id);
      } else if (anyUser?.id) {
        query = query.eq("user_id", anyUser.id);
      }

      const { data: empresaRow, error } = await query.maybeSingle();
      if (!error && empresaRow) {
        if (inmobiliaria === "—" && empresaRow.nombre_comercial) {
          inmobiliaria = empresaRow.nombre_comercial;
        }
        if (matriculado === "—" && empresaRow.matriculado) {
          matriculado = empresaRow.matriculado;
        }
        if (cpi === "—" && empresaRow.cpi) {
          cpi = empresaRow.cpi;
        }
      }
    } catch (e) {
      console.warn(
        "No se pudieron resolver datos de empresa para asesor/empresa (PDF):",
        e
      );
    }
  }

  const themeLogo = themeLogoUrl || null;

  const hexToRgb = (hex: string) => {
    const safe = /^#?[0-9A-Fa-f]{3,6}$/.test(hex || "") ? hex : "#0ea5e9";
    const m = safe.replace("#", "");
    const normalized =
      m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
    const int = parseInt(normalized, 16);
    return {
      r: (int >> 16) & 255,
      g: (int >> 8) & 255,
      b: int & 255,
    };
  };

  const pc = hexToRgb(effectivePrimaryColor);
  const soft = { r: 248, g: 250, b: 252 };
  const border = { r: 226, g: 232, b: 240 };
  const muted = { r: 100, g: 116, b: 139 };
  const dark = { r: 15, g: 23, b: 42 };

  const imageFormat = (src: string) =>
    src.startsWith("data:image/png") ? "PNG" : "JPEG";

  const addImageContain = (
    src: string,
    x: number,
    yImg: number,
    boxW: number,
    boxH: number
  ) => {
    try {
      const props = (doc as any).getImageProperties(src);
      const imgW = Number(props?.width) || boxW;
      const imgH = Number(props?.height) || boxH;
      const ratio = Math.min(boxW / imgW, boxH / imgH);
      const drawW = imgW * ratio;
      const drawH = imgH * ratio;
      const drawX = x + (boxW - drawW) / 2;
      const drawY = yImg + (boxH - drawH) / 2;

      doc.addImage(
        src,
        imageFormat(src),
        drawX,
        drawY,
        drawW,
        drawH,
        undefined,
        "FAST"
      );
    } catch (e) {
      console.warn("No se pudo insertar imagen en PDF:", e);
    }
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 58) {
      doc.addPage();
      y = margin;
    }
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(34);
    doc.setFillColor(pc.r, pc.g, pc.b);
    doc.rect(margin, y, pageW - margin * 2, 24, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 12, y + 16);
    doc.setTextColor(0, 0, 0);
    y += 36;
  };

  const drawLabelValue = (
    label: string,
    value: string,
    x: number,
    yLine: number,
    maxW = 220
  ) => {
    const labelText = `${label}: `;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(muted.r, muted.g, muted.b);
    doc.text(labelText, x, yLine);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(dark.r, dark.g, dark.b);
    const labelW = doc.getTextWidth(labelText);
    const lines = doc.splitTextToSize(value || "-", maxW - labelW - 8);
    doc.text(lines as any, x + labelW + 8, yLine);
    doc.setTextColor(0, 0, 0);
    return Array.isArray(lines) ? lines.length * 11 : 11;
  };

  const drawTextBlock = (title: string, text: string) => {
    const cleanText = text?.trim() || "-";
    ensureSpace(46);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(pc.r, pc.g, pc.b);
    doc.text(title, margin, y);
    y += 22;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);

    const lines = doc.splitTextToSize(cleanText, pageW - margin * 2);
    for (const line of lines as string[]) {
      if (y > pageH - 64) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 12.5;
    }

    y += 20;
    doc.setTextColor(0, 0, 0);
  };

  const startHeaderPage = async () => {
    // Encabezado superior de la primera página
    doc.setFillColor(pc.r, pc.g, pc.b);
    doc.rect(0, 0, pageW, 74, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("Valuación de Activo Inmobiliario", margin, 32);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(
      `${inmobiliaria || "—"}  |  ${new Date(formData.date).toLocaleDateString("es-AR")}`,
      margin,
      52
    );

    if (themeLogo) {
      try {
        const logoData = await fetchToDataURL(themeLogo);
        if (logoData) {
          // Un poco más grande que la versión anterior, pero contenido dentro del encabezado.
          const logoBoxW = 100;
          const logoBoxH = 58;
          const logoX = pageW - margin - logoBoxW;
          const logoY = 8;
          addImageContain(logoData, logoX, logoY, logoBoxW, logoBoxH);
        }
      } catch (err) {
        console.warn("⚠️ No se pudo cargar el logo del tema en el PDF", err);
      }
    }

    doc.setTextColor(0, 0, 0);
    y = 96;
  };

  await startHeaderPage();

  // Datos de cabecera
  doc.setFillColor(soft.r, soft.g, soft.b);
  doc.setDrawColor(border.r, border.g, border.b);
  doc.rect(margin, y, pageW - margin * 2, 58, "FD");

  drawLabelValue("Empresa", inmobiliaria, margin + 12, y + 19, 225);
  drawLabelValue("Asesor", isAsesor ? asesorNombre : "—", margin + 12, y + 39, 225);
  drawLabelValue("Profesional", matriculado, pageW / 2 + 12, y + 19, 215);
  drawLabelValue("Matrícula N°", cpi, pageW / 2 + 12, y + 39, 215);
  y += 82;

  // =========================
  // Página 1: Datos de la propiedad
  // =========================
  drawSectionTitle("Datos de la Propiedad");

  const cardX = margin;
  const cardY = y;
  const cardW = pageW - margin * 2;
  const photoW = 230;
  const photoH = 168;
  const cardH = 398;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(border.r, border.g, border.b);
  doc.rect(cardX, cardY, cardW, cardH, "FD");

  const leftX = cardX + 18;
  const photoX = cardX + cardW - photoW - 18;
  const topInfoW = photoX - leftX - 20;

  const drawKV = (
    label: string,
    value: string,
    x: number,
    yLine: number,
    maxValueW = 170
  ) => {
    const labelText = `${label}: `;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.setTextColor(muted.r, muted.g, muted.b);
    doc.text(labelText, x, yLine);

    const labelW = doc.getTextWidth(labelText);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    doc.setTextColor(dark.r, dark.g, dark.b);

    const safeValue = value || "-";
    const valueW = Math.max(45, maxValueW - labelW - 9);
    const lines = doc.splitTextToSize(safeValue, valueW);
    doc.text(lines as any, x + labelW + 9, yLine);
    doc.setTextColor(0, 0, 0);

    return Math.max(14, (Array.isArray(lines) ? (lines as string[]).length : 1) * 10 + 3);
  };

  const datosA = [
    ["Cliente", formData.clientName || "-"],
    ["Teléfono", formData.phone || "-"],
    ["Email", formData.email || "-"],
    ["Dirección", formData.address || "-"],
    ["Barrio", formData.neighborhood || "-"],
    ["Localidad", formData.locality || "-"],
    ["Operación", operationLabel],
    ["Moneda", currency],
  ];

  // Bloque superior: datos principales en una sola columna + foto a la derecha.
  // Esto evita que los textos largos invadan la imagen principal.
  let topY = cardY + 25;
  datosA.forEach(([label, value]) => {
    topY += drawKV(label, value, leftX, topY, topInfoW) + 6;
  });

  let principalDataURL: string | null = null;
  if (formData.mainPhotoBase64) principalDataURL = formData.mainPhotoBase64;
  else if (formData.mainPhotoUrl) principalDataURL = await fetchToDataURL(formData.mainPhotoUrl);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(border.r, border.g, border.b);
  doc.rect(photoX, cardY + 22, photoW, photoH, "FD");
  if (principalDataURL) {
    addImageContain(principalDataURL, photoX + 5, cardY + 27, photoW - 10, photoH - 10);
  }

  // Línea divisoria interna para separar la ficha principal de las características.
  const dividerY = cardY + 214;
  doc.setDrawColor(border.r, border.g, border.b);
  doc.line(cardX + 18, dividerY, cardX + cardW - 18, dividerY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.setTextColor(muted.r, muted.g, muted.b);
  doc.text("Características", leftX, dividerY + 22);

  // Segunda parte de datos, debajo de la foto, usando 3 columnas para aprovechar el ancho.
  const secondY = dividerY + 45;
  const col1X = leftX;
  const col2X = leftX + 174;
  const col3X = leftX + 348;
  const colW = 158;

  const datosB = [
    ["Tipología", String(formData.propertyType || "-")],
    ["m² Terreno", numero(Number(formData.landArea) || 0)],
    ["m² Cubiertos", numero(Number(formData.builtArea) || 0)],
    ["Planos", formData.hasPlans ? "Sí" : "No"],
    ["Título", String(formData.titleType || "-")],
    ["Antigüedad", `${numero(Number(formData.age) || 0)} años`],
    ["Estado", String(formData.condition || "-")],
    ["Ubicación", String(formData.locationQuality || "-")],
    ["Orientación", String(formData.orientation || "-")],
    ["Posee renta", formData.isRented ? "Sí" : "No"],
  ];

  datosB.forEach(([label, value], idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = col === 0 ? col1X : col === 1 ? col2X : col3X;
    const yy = secondY + row * 26;
    drawKV(label, value, x, yy, colW);
  });

  // Servicios en formato horizontal, al pie de la ficha, para no competir con la foto.
  const servicios = [
    `Luz: ${formData.services.luz ? "Sí" : "No"}`,
    `Agua: ${formData.services.agua ? "Sí" : "No"}`,
    `Gas: ${formData.services.gas ? "Sí" : "No"}`,
    `Cloacas: ${formData.services.cloacas ? "Sí" : "No"}`,
    `Pavimento: ${formData.services.pavimento ? "Sí" : "No"}`,
  ];

  const servY = cardY + cardH - 42;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.setTextColor(muted.r, muted.g, muted.b);
  doc.text("Servicios", leftX, servY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(dark.r, dark.g, dark.b);
  const servText = servicios.join("   ·   ");
  const servLines = doc.splitTextToSize(servText, cardW - 36);
  doc.text(servLines as any, leftX, servY + 16);
  doc.setTextColor(0, 0, 0);

  // =========================
  // Página 2 en adelante: Comparables
  // =========================
  doc.addPage();
  y = margin;
  drawSectionTitle("Propiedades Comparadas en la Zona");

  const cols = 2;
  const gap = 12;
  const compCardW = (pageW - margin * 2 - gap) / cols;
  const compCardH = 244;
  let cx = margin;
  let cy = y;

  const drawComparableCard = async (
    c: ComparableProperty,
    x: number,
    yCard: number,
    index: number
  ) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(border.r, border.g, border.b);
    doc.rect(x, yCard, compCardW, compCardH, "FD");

    doc.setFillColor(pc.r, pc.g, pc.b);
    doc.rect(x, yCard, compCardW, 24, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`Propiedad Nº ${index + 1}`, x + 10, yCard + 16);
    doc.setTextColor(0, 0, 0);

    const innerPad = 10;
    const imgX = x + innerPad;
    const imgY = yCard + 34;
    const imgW = compCardW - innerPad * 2;
    const imgH = 72;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(border.r, border.g, border.b);
    doc.rect(imgX, imgY, imgW, imgH, "FD");

    let cmpDataURL: string | null = null;
    if (c.photoBase64) cmpDataURL = c.photoBase64;
    else if (c.photoUrl) cmpDataURL = await fetchToDataURL(c.photoUrl);

    if (cmpDataURL) addImageContain(cmpDataURL, imgX + 3, imgY + 3, imgW - 6, imgH - 6);

    const builtAreaNum = Number(c.builtArea) || 0;
    const priceNum = Number(c.price) || 0;
    const coefNum =
      typeof c.coefficient === "number"
        ? c.coefficient
        : parseFloat(String(c.coefficient)) || 1;

    const ppm2Base = builtAreaNum > 0 ? priceNum / builtAreaNum : 0;
    const ppm2Adj = ppm2Base * coefNum;

    let textY = imgY + imgH + 18;
    const textX = x + innerPad;
    const maxTextW = compCardW - innerPad * 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(dark.r, dark.g, dark.b);

    const dirLines = doc.splitTextToSize(`Dirección: ${c.address || "-"}`, maxTextW);
    doc.text(dirLines as any, textX, textY);
    textY += (dirLines as string[]).length * 11;

    const barrioLines = doc.splitTextToSize(`Barrio: ${c.neighborhood || "-"}`, maxTextW);
    doc.text(barrioLines as any, textX, textY);
    textY += (barrioLines as string[]).length * 11 + 2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(`Precio: ${money(priceNum)}`, textX, textY);
    textY += 13;
    doc.text(`m² Cubiertos: ${numero(builtAreaNum)}`, textX, textY);
    textY += 13;
    doc.text(`Precio/m²: ${money(ppm2Adj)}`, textX, textY);
    textY += 13;

    doc.text(`Días publicada: ${c.daysPublished || "-"}`, textX, textY);
    textY += 13;

    if (c.listingUrl) {
      doc.setTextColor(2, 132, 199);
      doc.textWithLink("Ver Propiedad", textX, textY, { url: c.listingUrl });
      doc.setTextColor(0, 0, 0);
      textY += 13;
    }

    const desc = c.description || "";
    if (desc) {
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      const textLines = doc.splitTextToSize(desc, maxTextW);
      const clipped = (textLines as string[]).slice(0, 4);
      doc.text(clipped as any, textX, textY);
      doc.setTextColor(0, 0, 0);
    }
  };

  for (let i = 0; i < formData.comparables.length; i++) {
    if (i > 0 && i % cols === 0) {
      cy += compCardH + gap;
      cx = margin;
    }

    if (cy + compCardH > pageH - 72) {
      doc.addPage();
      y = margin;
      drawSectionTitle("Propiedades Comparadas en la Zona (cont.)");
      cy = y;
      cx = margin;
    }

    // eslint-disable-next-line no-await-in-loop
    await drawComparableCard(formData.comparables[i], cx, cy, i);
    cx += compCardW + gap;
  }

  // =========================
  // Página siguiente: Precio sugerido y conclusión
  // =========================
  doc.addPage();
  y = margin;

  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(245, 158, 11);
  doc.rect(margin, y, pageW - margin * 2, 64, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(146, 64, 14);
  doc.text(suggestedPriceTitle, margin + 14, y + 38);

  doc.setFontSize(24);
  doc.setTextColor(dark.r, dark.g, dark.b);
  doc.text(money(suggestedPrice), pageW - margin - 14, y + 39, { align: "right" });

  doc.setTextColor(0, 0, 0);
  y += 94;

  drawSectionTitle("Conclusión");
  y += 20;

  drawTextBlock("Observaciones", formData.observations);
  drawTextBlock("Fortalezas", formData.strengths);
  drawTextBlock("Debilidades", formData.weaknesses);
  drawTextBlock("A considerar", formData.considerations);

  // =========================
  // Última página: Gráficos
  // =========================
  doc.addPage();
  y = margin;
  drawSectionTitle("Gráficos y Referencias");

  const drawPERGraph = (graphX: number, graphY: number, graphW: number, graphH: number) => {
    const plotPadL = 42;
    const plotPadR = 18;
    const plotPadT = 28;
    const plotPadB = 34;
    const x0 = graphX + plotPadL;
    const y0 = graphY + graphH - plotPadB;
    const plotW = graphW - plotPadL - plotPadR;
    const plotH = graphH - plotPadT - plotPadB;
    const xMin = 5;
    const xMax = 30;
    const yMax = 20;
    const mapX = (v: number) => x0 + ((v - xMin) / (xMax - xMin)) * plotW;
    const mapY = (v: number) => y0 - (v / yMax) * plotH;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(border.r, border.g, border.b);
    doc.rect(graphX, graphY, graphW, graphH, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(dark.r, dark.g, dark.b);
    doc.text("Relación PER y Rentabilidad Anual", graphX + graphW / 2, graphY + 17, { align: "center" });

    // Zonas de referencia
    doc.setFillColor(209, 250, 229);
    doc.rect(mapX(5), graphY + plotPadT, mapX(15) - mapX(5), plotH, "F");
    doc.setFillColor(254, 243, 199);
    doc.rect(mapX(15), graphY + plotPadT, mapX(20) - mapX(15), plotH, "F");
    doc.setFillColor(254, 226, 226);
    doc.rect(mapX(20), graphY + plotPadT, mapX(30) - mapX(20), plotH, "F");

    // Grilla
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.4);
    [5, 10, 15, 20, 25, 30].forEach((tick) => {
      const tx = mapX(tick);
      doc.line(tx, graphY + plotPadT, tx, y0);
    });
    [0, 5, 10, 15, 20].forEach((tick) => {
      const ty = mapY(tick);
      doc.line(x0, ty, x0 + plotW, ty);
    });

    // Ejes
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.8);
    doc.line(x0, y0, x0 + plotW, y0);
    doc.line(x0, graphY + plotPadT, x0, y0);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    [5, 10, 15, 20, 25, 30].forEach((tick) => {
      doc.text(String(tick), mapX(tick), y0 + 11, { align: "center" });
    });
    [0, 5, 10, 15, 20].forEach((tick) => {
      doc.text(`${tick}%`, x0 - 6, mapY(tick) + 2, { align: "right" });
    });
    doc.text("PER (años de alquiler)", graphX + graphW / 2, graphY + graphH - 9, { align: "center" });
    doc.text("Rentabilidad anual (%)", graphX + 9, graphY + graphH / 2, { angle: 90, align: "center" } as any);

    // Límites 15 y 20
    doc.setDrawColor(34, 197, 94);
    doc.setLineDashPattern([3, 3], 0);
    doc.line(mapX(15), graphY + plotPadT, mapX(15), y0);
    doc.setDrawColor(245, 158, 11);
    doc.line(mapX(20), graphY + plotPadT, mapX(20), y0);
    doc.setLineDashPattern([], 0);

    // Curva aproximada de rentabilidad: 100 / PER
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(1.4);
    let prevX = mapX(5);
    let prevY = mapY(20);
    for (let per = 5.25; per <= 30; per += 0.25) {
      const rent = Math.min(20, 100 / per);
      const px = mapX(per);
      const py = mapY(rent);
      doc.line(prevX, prevY, px, py);
      prevX = px;
      prevY = py;
    }

    // Referencias internas, cerca del eje X para que no tapen el marcador.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(22, 101, 52);
    doc.text("Buena Inversión", mapX(10), y0 - 5, { align: "center" });

    // En la franja amarilla lo partimos en dos líneas para que quede centrado
    // y no se desborde hacia las franjas verde/roja.
    doc.setTextColor(146, 64, 14);
    doc.text("Rentabilidad", mapX(17.5), y0 - 10, { align: "center" });
    doc.text("Aceptable", mapX(17.5), y0 - 3, { align: "center" });

    doc.setTextColor(153, 27, 27);
    doc.text("Inversión Riesgosa", mapX(25), y0 - 5, { align: "center" });

    // Marcador del PER calculado
    if (canCalculatePER && perValue) {
      const p = Math.max(5, Math.min(30, perValue));
      const rent = Math.min(20, 100 / p);
      const markerX = mapX(p);
      const markerY = mapY(rent);
      doc.setFillColor(pc.r, pc.g, pc.b);
      doc.circle(markerX, markerY, 3.2, "F");

      const label = `PER ${numero(perValue, 1)}`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      const labelW = doc.getTextWidth(label) + 10;
      const labelX = p > 22 ? markerX - labelW - 6 : markerX + 7;
      const labelY = markerY - 12;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(border.r, border.g, border.b);
      doc.roundedRect(labelX, labelY - 8, labelW, 13, 2, 2, "FD");
      doc.setTextColor(pc.r, pc.g, pc.b);
      doc.text(label, labelX + 5, labelY);
    }

    // Leyenda con marco y fondo blanco para mejorar contraste.
    const legX = graphX + graphW - 196;
    const legY = graphY + 32;
    const legW = 172;
    const legH = 43;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(148, 163, 184);
    doc.roundedRect(legX - 7, legY - 8, legW, legH, 3, 3, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.7);
    doc.setTextColor(30, 41, 59);

    doc.setFillColor(187, 247, 208);
    doc.setDrawColor(34, 197, 94);
    doc.rect(legX, legY, 9, 7, "FD");
    doc.text("Buena inversión (PER < 15)", legX + 13, legY + 6);

    doc.setFillColor(253, 230, 138);
    doc.setDrawColor(245, 158, 11);
    doc.rect(legX, legY + 12, 9, 7, "FD");
    doc.text("Rentabilidad aceptable (15 a 20)", legX + 13, legY + 18);

    doc.setFillColor(252, 165, 165);
    doc.setDrawColor(185, 28, 28);
    doc.rect(legX, legY + 24, 9, 7, "FD");
    doc.text("Inversión riesgosa (PER > 20)", legX + 13, legY + 30);

    doc.setTextColor(0, 0, 0);
    doc.setLineWidth(0.8);
  };

  if ((formData as any).includePER && operationType === "venta") {
    const perText = canCalculatePER
      ? `PER (Price Earnings Ratio): ${numero(perValue || 0, 1)} años para recuperar la inversión - ${perInfo.label}.`
      : currency !== "USD"
      ? "PER (Price Earnings Ratio): para calcularlo, el valor sugerido de venta debe estar expresado en USD."
      : "PER (Price Earnings Ratio): no se pudo calcular por falta de alquiler estimativo mensual en USD.";

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(border.r, border.g, border.b);
    doc.rect(margin, y, pageW - margin * 2, canCalculatePER ? 264 : 82, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(pc.r, pc.g, pc.b);
    doc.text("PER (Price Earnings Ratio)", margin + 12, y + 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(dark.r, dark.g, dark.b);
    doc.text(perText, margin + 12, y + 42);

    if (canCalculatePER) {
      drawPERGraph(margin + 18, y + 62, pageW - margin * 2 - 36, 184);
    }

    doc.setTextColor(0, 0, 0);
    y += canCalculatePER ? 286 : 104;
  }

  // Imagen final opcional, grande y centrada en la página de gráficos.
  try {
    const graficoUrl = "/grafico1-pdf.png";
    const img = await fetch(graficoUrl);
    const blob = await img.blob();
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
    });
    reader.readAsDataURL(blob);
    const base64Img = await base64Promise;

    const availableH = pageH - y - 82;
    const imgW = pageW * 0.94;
    const imgH = Math.max(330, Math.min(430, availableH));
    const imgX = (pageW - imgW) / 2;

    y += 18;
    addImageContain(base64Img, imgX, y, imgW, imgH);
    y += imgH + 22;
  } catch (err) {
    console.warn("⚠️ No se pudo agregar la imagen final al PDF", err);
  }

  // Footer en todas las páginas
  const footerText = `${matriculado}  |  Matricula N°: ${cpi}`;
  const totalPages = (doc as any).getNumberOfPages
    ? (doc as any).getNumberOfPages()
    : doc.internal.pages.length - 1;

  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setDrawColor(border.r, border.g, border.b);
    doc.line(margin, pageH - 44, pageW - margin, pageH - 44);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(footerText, pageW / 2, pageH - 28, { align: "center" });
    doc.text(`Página ${page} de ${totalPages}`, pageW - margin, pageH - 28, {
      align: "right",
    });
  }

  doc.save("Informe_VAI.pdf");
};
    
/** ========= Opciones ========= */
const propertyTypeOptions = useMemo(() => {
  const base = enumToOptions(PropertyType);
  const extras = [
    "Complejo de cabañas",
    "Hotel",
    "Cochera/Garage",
    "Campo",
    "Depósito/Bodega",
    "Quinta",
  ].map((v) => ({ label: v, value: v }));

  const exists = new Set(base.map((o) => o.value));
  return [...base, ...extras.filter((o) => !exists.has(o.value))];
}, []);
const titleOptions = useMemo(() => enumToOptions(TitleType), []);
const conditionOptions = useMemo(() => enumToOptions(PropertyCondition), []);
const locationOptions = useMemo(() => enumToOptions(LocationQuality), []);
const orientationOptions = useMemo(() => enumToOptions(Orientation), []);


/** ========= Render ========= */
return (
  <>
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* === Header del formulario (VAI | Empresa | Fecha) === */}
      <div className="flex items-center justify-between gap-4 mb-2 border-b pb-3">
        <div className="font-semibold tracking-wide">VAI</div>
        <div className="text-2xl text-center grow">
          {themeCompanyName || user?.inmobiliaria || "Empresa"}
        </div>
        <div className="text-sm whitespace-nowrap">
          {new Date(formData.date || new Date().toISOString()).toLocaleDateString("es-AR")}
        </div>
      </div>

      {/* Card principal */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: effectivePrimaryColor }}>
            Datos del Cliente / Propiedad
          </h2>
        </div>

        {/* Grid principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 sm:p-6">
          {/* Columna izquierda */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* Operación */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Operación</label>
              <select
                name="operationType"
                value={operationType}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              >
                {operationOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Moneda */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Moneda</label>
              <select
                name="currency"
                value={currency}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              >
                {currencyOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Cliente */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Cliente</label>
              <input
                name="clientName"
                value={formData.clientName}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Nombre del cliente"
              />
            </div>

            {/* Teléfono */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Teléfono</label>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="+54 ..."
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                name="email"
                value={formData.email}
                onChange={handleFieldChange}
                type="email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="correo@dominio.com"
              />
            </div>

            {/* Dirección */}
            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Dirección</label>
              <input
                name="address"
                value={formData.address}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Calle y número"
              />
            </div>

            {/* Barrio */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Barrio</label>
              <input
                name="neighborhood"
                value={formData.neighborhood}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Barrio"
              />
            </div>

            {/* Localidad */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Localidad</label>
              <input
                name="locality"
                value={formData.locality}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Localidad"
              />
            </div>

            {/* Tipología */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Tipología</label>
              <select
                name="propertyType"
                value={formData.propertyType}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              >
                {propertyTypeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* m² Terreno */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">m² del Lote</label>
              <input
                name="landArea"
                type="number"
                inputMode="decimal"
                value={formData.landArea ?? ""}
                onChange={(e) => {
                  const value = e.target.value === "" ? null : parseFloat(e.target.value);
                  handleFieldChange({
                    target: { name: "landArea", value },
                  } as any);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Ej: 250"
              />
            </div>

            {/* m² Cubiertos */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">m² a Valuar (si valúas un Lote repetir campo anterior)</label>
              <input
                name="builtArea"
                type="number"
                inputMode="decimal"
                value={formData.builtArea ?? ""}
                onChange={(e) => {
                  const value = e.target.value === "" ? null : parseFloat(e.target.value);
                  handleFieldChange({
                    target: { name: "builtArea", value },
                  } as any);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Ej: 120"
              />
            </div>

            {/* Planos */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Planos</label>
              <select
                name="hasPlans"
                value={String(formData.hasPlans)}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              >
                {yesNoOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Título */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Título</label>
              <select
                name="titleType"
                value={formData.titleType}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              >
                {titleOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Antigüedad */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Antigüedad (años)</label>
              <input
                name="age"
                type="number"
                inputMode="numeric"
                value={formData.age ?? ""}
                onChange={(e) => {
                  const value = e.target.value === "" ? null : parseInt(e.target.value, 10);
                  handleFieldChange({
                    target: { name: "age", value },
                  } as any);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="Ej: 10"
              />
            </div>

            {/* Estado */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Estado de conservación</label>
              <select
                name="condition"
                value={formData.condition}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              >
                {conditionOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Ubicación */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Ubicación</label>
              <select
                name="locationQuality"
                value={formData.locationQuality}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              >
                {locationOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Orientación */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Orientación</label>
              <select
                name="orientation"
                value={formData.orientation}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              >
                {orientationOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Servicios */}
            <div className="space-y-3 md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-800">Servicios</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {(["luz", "agua", "gas", "cloacas", "pavimento"] as Array<Extract<keyof Services, string>>).map((k) => (
                  <div key={k} className="space-y-1">
                    <label className="block text-xs font-medium text-gray-600 capitalize">{k}</label>
                    <select
                      name={`services.${k}`}
                      value={String(formData.services[k])}
                      onChange={handleFieldChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                    >
                      {yesNoOpts.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Renta */}
            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Posee renta actualmente</label>
              <select
                name="isRented"
                value={String(formData.isRented)}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              >
                {yesNoOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Columna derecha: foto principal */}
<div className="lg:col-span-1">
  <h3 className="mb-2 text-sm font-semibold text-gray-800 text-center sm:text-left">
    Foto de la propiedad
  </h3>

  {(() => {
    const mainSrc = formData.mainPhotoBase64 || formData.mainPhotoUrl || "";
    if (mainSrc) {
      return (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <img
            src={mainSrc}
            alt="Foto principal"
            className="h-48 sm:h-64 w-full object-cover"
          />
          <div className="p-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setFormData((p) => ({
                  ...p,
                  mainPhotoBase64: undefined,
                  mainPhotoUrl: "",
                }))
              }
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
            >
              Quitar
            </button>
            <button
              type="button"
              onClick={() => mainPhotoInputRef.current?.click()}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
            >
              Cambiar foto
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center">
        <p className="mb-2 text-xs text-gray-500">Subir imagen (JPG/PNG)</p>
        <button
          type="button"
          onClick={() => mainPhotoInputRef.current?.click()}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
        >
          Subir foto
        </button>
        {!informeId && (
          <p className="mt-2 text-[11px] text-gray-500">
            Consejo: primero guardá el informe para subir la foto al Storage.
          </p>
        )}
      </div>
    );
  })()}

  {/* input oculto */}
  <input
    ref={mainPhotoInputRef}
    type="file"
    accept="image/*"
    className="hidden"
    onChange={handleMainPhotoSelect}
    />
  </div>
  </div>
</div>

      {/* Precio sugerido */}
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-center sm:text-left" style={{ color: effectivePrimaryColor }}>
            {suggestedPriceTitle}
          </h3>
          <span className="text-xl sm:text-2xl font-bold text-center sm:text-right">{money(suggestedPrice)}</span>
        </div>
        <p className="mt-2 text-xs sm:text-sm text-amber-700 text-center sm:text-left">
          Calculado como promedio del precio/m² ajustado de comparables × m² a valuar de la propiedad principal.
        </p>
      </div>

     {/* Propiedades comparadas en la zona */}
<div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
  <div className="border-b border-gray-200 p-4 sm:p-6">
    <h2
      className="text-base sm:text-lg font-semibold text-center sm:text-left"
      style={{ color: effectivePrimaryColor }}
    >
      Propiedades comparadas en la zona
    </h2>
  </div>

  <div className="p-4 sm:p-6 space-y-6">
    {formData.comparables.map((c, i) => {
      const built = Number(c.builtArea) || 0;
      const price = Number(c.price) || 0;
      const ppm2Base = built > 0 ? price / built : 0;
      const ppm2Adj = ppm2Base * (Number(c.coefficient) || 1);

      return (
        <div
          key={i}
          className="rounded-lg border border-gray-200 p-4 sm:p-5 bg-white"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-gray-800">
              Propiedad N°{i + 1}
            </h3>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => removeComparable(i)}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs sm:text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                disabled={formData.comparables.length <= 1}
              >
                Eliminar
              </button>
            </div>
          </div>

          {/* Cuerpo */}
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-7 gap-4">
            {/* Foto (MODIFICADO) */}
            <div className="lg:col-span-2">
              <h4 className="mb-1 text-xs sm:text-sm font-medium text-gray-600">
                Foto
              </h4>

              {(() => {
                const mainSrc = c.photoBase64 || (c as any).photoUrl || "";
                if (mainSrc) {
                  return (
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                      <img
                        src={mainSrc}
                        alt={`Foto comparable ${i + 1}`}
                        className="h-40 sm:h-48 w-full object-cover"
                      />
                      <div className="p-2 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => {
                              const arr = prev.comparables.slice();
                              arr[i] = {
                                ...arr[i],
                                photoBase64: undefined,
                                photoUrl: "" as any,
                              };
                              return { ...prev, comparables: arr };
                            })
                          }
                          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Quitar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!compPhotoInputsRef.current[i]) return;
                            compPhotoInputsRef.current[i]!.click();
                          }}
                          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Cambiar foto
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="rounded-lg border border-dashed border-gray-300 p-3 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (!compPhotoInputsRef.current[i]) return;
                        compPhotoInputsRef.current[i]!.click();
                      }}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Subir foto
                    </button>
                    {!informeId && (
                      <p className="mt-2 text-[11px] text-gray-500">
                        Consejo: guardá el informe para subir esta foto al Storage.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* input oculto por-comparable */}
              <input
                ref={(el) => (compPhotoInputsRef.current[i] = el)}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleComparablePhotoSelect(i, e)}
              />
            </div>

                  {/* Datos */}
                  <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Link + autocompletar */}
                    <div className="space-y-1 sm:col-span-2 md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Link de la publicación</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          value={c.listingUrl || ""}
                          onChange={(e) => updateComparable(i, "listingUrl", e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                          placeholder="https://..."
                        />
                        <button
                          type="button"
                          onClick={() => importComparableFromUrl(i)}
                          disabled={!!comparableImportStatus[i]?.loading || !String(c.listingUrl || "").trim()}
                          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {comparableImportStatus[i]?.loading ? "Importando..." : "Autocompletar datos"}
                        </button>
                      </div>
                      {comparableImportStatus[i]?.text && (
                        <p
                          className={
                            comparableImportStatus[i]?.type === "success"
                              ? "text-xs text-green-600"
                              : "text-xs text-amber-700"
                          }
                        >
                          {comparableImportStatus[i]?.text}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Completa datos públicos disponibles. Revisá y corregí manualmente antes de guardar.
                      </p>
                    </div>

                    {/* Dirección */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Dirección</label>
                      <input
                        value={c.address}
                        onChange={(e) => updateComparable(i, "address", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                        placeholder="Calle y número"
                      />
                    </div>

                    {/* Barrio */}
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">Barrio</label>
                      <input
                        value={c.neighborhood}
                        onChange={(e) => updateComparable(i, "neighborhood", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                        placeholder="Barrio"
                      />
                    </div>

                    {/* m² Cubiertos */}
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">m² a Valuar</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={c.builtArea ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const value = raw === "" ? 0 : parseFloat(raw);
                          updateComparable(i, "builtArea", value);
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                        placeholder="Ej: 120"
                      />
                    </div>

                    {/* Precio */}
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">{comparablePriceLabel}</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={
                          c.price !== undefined && c.price !== null
                            ? new Intl.NumberFormat("es-AR").format(Number(c.price))
                            : ""
                        }
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\./g, "");
                          const numericValue = raw === "" ? 0 : parseInt(raw, 10);
                          updateComparable(i, "price", numericValue);
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-offset-1"
                        placeholder={currency === "USD" ? "Ej: 120.000" : "Ej: 1.200.000"}
                      />
                    </div>

                    {/* Días publicada */}
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">Días publicada</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={c.daysPublished ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const value = raw === "" ? 0 : parseInt(raw, 10);
                          updateComparable(i, "daysPublished", value);
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                        placeholder="Ej: 45"
                      />
                    </div>

                    {/* Coeficiente */}
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">Coeficiente de competitividad</label>
                      <select
                        value={String(c.coefficient ?? 1.0)}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          updateComparable(i, "coefficient", isNaN(value) ? 1.0 : value);
                        }}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                      >
                        {Array.from({ length: 15 }, (_, idx) => (1.5 - idx * 0.1).toFixed(1)).map((val) => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Precio/m² */}
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">Precio por m² (ajustado por coeficiente)</label>
                      <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                        {money(ppm2Adj)}
                      </div>
                    </div>

                    {/* Descripción */}
                    <div className="space-y-1 sm:col-span-2 md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Descripción</label>
                      <textarea
                        value={c.description}
                        onChange={(e) => updateComparable(i, "description", e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                        placeholder="Descripción breve de la propiedad comparable"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex justify-center sm:justify-end">
            <button
              type="button"
              onClick={addComparable}
              disabled={formData.comparables.length >= MAX_COMPARABLES}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Agregar comparable
            </button>
          </div>
        </div>
      </div>


      {/* PER opcional */}
      {operationType === "venta" && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-center sm:text-left" style={{ color: effectivePrimaryColor }}>
              PER (Price Earnings Ratio)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 p-4 sm:p-6">
            <label className="md:col-span-1 flex items-center gap-3 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={Boolean((formData as any).includePER)}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    includePER: e.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
              Incluir cálculo PER
            </label>

            {Boolean((formData as any).includePER) && (
              <>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Alquiler estimativo mensual (USD)
                  </label>
                  <input
                    name="estimatedMonthlyRentUSD"
                    type="number"
                    inputMode="decimal"
                    value={(formData as any).estimatedMonthlyRentUSD ?? ""}
                    onChange={(e) => {
                      const value = e.target.value === "" ? "" : parseFloat(e.target.value);
                      handleFieldChange({
                        target: { name: "estimatedMonthlyRentUSD", value },
                      } as any);
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                    placeholder="Ej: 700"
                  />
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">Resultado PER</p>
                  {canCalculatePER ? (
                    <>
                      <p className="text-lg font-bold text-gray-900">
                        {numero(perValue || 0, 1)} años para recuperar la inversión
                      </p>
                      <p className={`text-sm font-semibold ${perInfo.className}`}>
                        {perInfo.label}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600">
                      {currency !== "USD"
                        ? "Para calcular PER, seleccioná USD como moneda de venta."
                        : "Completá el alquiler mensual estimativo en USD."}
                    </p>
                  )}
                </div>

                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-700">
                    Menor a 15 = Buena Oportunidad
                  </div>
                  <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-yellow-700">
                    Entre 15 y 20 = Rentabilidad Aceptable
                  </div>
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                    Más de 20 = Inversión Riesgosa
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Conclusión */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-center sm:text-left" style={{ color: effectivePrimaryColor }}>
            Conclusión
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-5 p-4 sm:p-6">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Observaciones</label>
            <textarea
              name="observations"
              value={formData.observations}
              onChange={handleFieldChange}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              placeholder="Observaciones generales"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Fortalezas</label>
            <textarea
              name="strengths"
              value={formData.strengths}
              onChange={handleFieldChange}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              placeholder="Puntos fuertes de la propiedad"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Debilidades</label>
            <textarea
              name="weaknesses"
              value={formData.weaknesses}
              onChange={handleFieldChange}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              placeholder="Puntos a mejorar o debilidades"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">A considerar</label>
            <textarea
              name="considerations"
              value={formData.considerations}
              onChange={handleFieldChange}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              placeholder="Aspectos a considerar en la decisión"
            />
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="mt-6">
        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={saveInforme}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white w-full sm:w-auto text-center disabled:opacity-60"
              style={{ backgroundColor: effectivePrimaryColor }}
            >
              {isSubmitting ? "Guardando..." : "Guardar Informe"}
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white w-full sm:w-auto text-center"
              style={{ backgroundColor: effectivePrimaryColor }}
            >
              Descargar PDF
            </button>
          </div>
        </div>

        {/* Mensajes inline debajo de la botonera */}
        <div className="mt-3 space-y-1">
          {saveMsg && (
            <p className={saveMsg.type === "success" ? "text-green-600" : "text-red-600"}>{saveMsg.text}</p>
          )}
          {informeId && <p className="text-xs text-gray-500">ID actual del informe: {informeId}</p>}
        </div>
      </div>
    </div>

  </>
);
}
