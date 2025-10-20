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

const peso = (n: number) =>
  isNaN(n) ? '-' : n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

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

const makeInitialData = (): ACMFormData => ({
  date: new Date().toISOString(),
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
  const [formData, setFormData] = useState<ACMFormData>(() => makeInitialData());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Mensajes inline y manejo de carga/ID ---
  type InlineMsg = { type: "success" | "error"; text: string } | null;
  const [saveMsg, setSaveMsg] = useState<InlineMsg>(null);
  const [loadMsg, setLoadMsg] = useState<InlineMsg>(null);
  const [informeId, setInformeId] = useState<string | null>(null);
  const [loadOpen, setLoadOpen] = useState(false);
  const [loadIdInput, setLoadIdInput] = useState("");

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
        const compUrls: string[] = [
          inf?.comp1_url || "",
          inf?.comp2_url || "",
          inf?.comp3_url || "",
          inf?.comp4_url || "",
        ];

        const comparablesCargados = Array.isArray(payload?.comparables)
          ? payload.comparables.map((c: any, idx: number) => ({
              ...c,
              // usamos photoBase64 como src (acepta base64 o URL indistintamente)
              photoBase64: compUrls[idx] || c?.photoBase64 || "",
            }))
          : formData.comparables;

        setFormData((prev) => ({
          ...prev,
          ...payload,
          mainPhotoUrl: principalUrl || prev.mainPhotoUrl || "",
          mainPhotoBase64: principalUrl || prev.mainPhotoBase64 || "",
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
      'services.luz',
      'services.agua',
      'services.gas',
      'services.cloacas',
      'services.pavimento',
    ]);
    const numberFields = new Set(['landArea', 'builtArea', 'age']);

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

      if (numericFields.includes(field)) {
        const n =
          rawValue === null || rawValue === ""
            ? 0
            : typeof rawValue === "string"
            ? parseFloat(rawValue)
            : Number(rawValue);
        value = isNaN(n) ? 0 : n;
      }

      arr[index] = { ...arr[index], [field]: value };

      const b = Number(arr[index].builtArea) || 0;
      const p = Number(arr[index].price) || 0;
      arr[index].pricePerM2 = b > 0 ? p / b : 0;

      copy.comparables = arr;
      return copy;
    });
  };

  const addComparable = () => {
    setFormData((prev) => {
      if (prev.comparables.length >= 4) return prev;
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
  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleMainPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const b64 = await readFileAsBase64(f);
    setFormData((prev) => ({ ...prev, mainPhotoBase64: b64, mainPhotoUrl: '' }));
    if (mainPhotoInputRef.current) mainPhotoInputRef.current.value = '';
  };

  const handleComparablePhotoSelect = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const b64 = await readFileAsBase64(f);
    setFormData((prev) => {
      const arr = prev.comparables.slice();
      arr[index] = { ...arr[index], photoBase64: b64 };
      return { ...prev, comparables: arr };
    });
    e.target.value = '';
  };

  /** ========= Guardar / Cargar Informe (API) ========= */
  const saveInforme = async () => {
    try {
      setIsSubmitting(true);
      setSaveMsg(null);

      // 1) Clonar y limpiar base64 para no guardar blobs enormes en datos_json
      const datosLimpios = structuredClone(formData) as ACMFormData;
      const mainB64 = datosLimpios.mainPhotoBase64; // guardo copia temporal
      datosLimpios.mainPhotoBase64 = undefined;

      const compsB64 = formData.comparables.map(c => c.photoBase64 || undefined);
      datosLimpios.comparables = datosLimpios.comparables.map(c => ({ ...c, photoBase64: undefined }));

      // 2) Crear informe (solo datos)
      const payload = { datos: datosLimpios, titulo: (formData as any)?.titulo || "Informe VAI" };
      const res = await fetch("/api/informes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errTxt = await res.text().catch(() => "");
        throw new Error(`Error al guardar el informe. ${errTxt}`);
      }
      const data = await res.json();
      const id = data?.informe?.id as string | undefined;
      if (!id) throw new Error("No se recibió ID de informe.");

      setInformeId(id);

      // 3) Subir imágenes (si había base64) al bucket y actualizar columnas URL
      // Principal
      if (mainB64) {
        const file = dataUrlToFile(mainB64, "principal.jpg");
        const fd = new FormData();
        fd.append("file", file);
        fd.append("informeId", id);
        fd.append("slot", "principal");
        const up = await fetch("/api/informes/upload", { method: "POST", body: fd });
        const upData = await up.json();
        if (up.ok && upData?.url) {
          // Refresco formData en memoria
          setFormData(prev => ({ ...prev, mainPhotoUrl: upData.url, mainPhotoBase64: undefined }));
        } else {
          console.warn("Upload principal falló:", upData?.error || up.statusText);
        }
      }

      // Comparables 1..4
      for (let i = 0; i < Math.min(formData.comparables.length, 4); i++) {
        const b64 = compsB64[i];
        if (!b64) continue;
        const slot = `comp${i + 1}` as "comp1" | "comp2" | "comp3" | "comp4";
        const file = dataUrlToFile(b64, `${slot}.jpg`);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("informeId", id);
        fd.append("slot", slot);
        const up = await fetch("/api/informes/upload", { method: "POST", body: fd });
        const upData = await up.json();
        if (up.ok && upData?.url) {
          setFormData(prev => {
            const arr = prev.comparables.slice();
            arr[i] = { ...arr[i], photoUrl: upData.url, photoBase64: undefined };
            return { ...prev, comparables: arr };
          });
        } else {
          console.warn(`Upload ${slot} falló:`, upData?.error || up.statusText);
        }
      }

      // 4) Persistir en datos_json las URLs ya subidas (update)
      const datosConUrls = structuredClone(formData) as ACMFormData;
      datosConUrls.mainPhotoBase64 = undefined;
      datosConUrls.comparables = datosConUrls.comparables.map(c => ({ ...c, photoBase64: undefined }));
      const upd = await fetch("/api/informes/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, datos: datosConUrls }),
      });
      if (!upd.ok) {
        const t = await upd.text().catch(() => "");
        console.warn("Update datos_json con URLs falló:", t);
      }

      setSaveMsg({ type: "success", text: `Informe guardado con éxito. ID: ${id}` });
    } catch (err: any) {
      console.error("Guardar Informe", err);
      setSaveMsg({ type: "error", text: err?.message || "No se pudo guardar el informe" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // === Abrir modal de carga (reemplaza el prompt) ===
  const loadInforme = () => {
    setLoadMsg(null);
    setLoadIdInput("");
    setLoadOpen(true);
  };

  // === Confirmar carga desde el modal ===
  const handleConfirmLoad = async () => {
    if (!loadIdInput) {
      setLoadMsg({ type: "error", text: "Por favor, ingresá un ID válido." });
      return;
    }
    try {
      setLoadMsg(null);

      const res = await fetch(`/api/informes/get?id=${encodeURIComponent(loadIdInput)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo obtener el informe");
      }

      // La API devuelve { ok: true, informe: {...} }
      const inf = data?.informe ?? data;
      const payload = inf?.datos_json;
      if (!payload) {
        throw new Error("El informe no contiene datos_json");
      }

      // URLs guardadas en storage (si existen)
      const principalUrl: string = inf?.imagen_principal_url || "";
      const compUrls: string[] = [
        inf?.comp1_url || "",
        inf?.comp2_url || "",
        inf?.comp3_url || "",
        inf?.comp4_url || "",
      ];

      // Ajustar comparables: si hay URLs en BD, colocarlas en photoBase64 (se usa como src)
      const comparablesCargados = Array.isArray(payload?.comparables)
        ? payload.comparables.map((c: any, idx: number) => ({
            ...c,
            photoBase64: compUrls[idx] || c?.photoBase64 || "",
          }))
        : formData.comparables;

      setFormData((prev) => ({
        ...prev,
        ...payload,
        mainPhotoUrl: principalUrl || prev.mainPhotoUrl || "",
        // usamos photoBase64 como src (acepta base64 o URL indistintamente)
        mainPhotoBase64: principalUrl || prev.mainPhotoBase64 || "",
        comparables: comparablesCargados,
      }));

      const loadedId = inf?.id || loadIdInput;
      setInformeId(loadedId);

      setLoadMsg({ type: "success", text: `Informe cargado correctamente (ID: ${loadedId}).` });
      setLoadOpen(false);
    } catch (err: any) {
      console.error("Cargar Informe", err);
      setLoadMsg({ type: "error", text: `Error al cargar: ${err?.message || "desconocido"}` });
    }
  };

  /** ========= Cálculos ========= */
  const adjustedPricePerM2List = useMemo(
    () =>
      formData.comparables
        .filter((c) => {
          const built = parseFloat(c.builtArea as string) || 0;
          const price = parseFloat(c.price as string) || 0;
          return built > 0 && price > 0;
        })
        .map((c) => {
          const built = parseFloat(c.builtArea as string) || 0;
          const price = parseFloat(c.price as string) || 0;
          const coef = parseFloat(c.coefficient as string) || 1;
          const base = (c.pricePerM2 as number) || (built > 0 ? price / built : 0);
          return (Number(base) || 0) * (Number(coef) || 1);
        }),
    [formData.comparables]
  );

  const averageAdjustedPricePerM2 = useMemo(() => {
    if (adjustedPricePerM2List.length === 0) return 0;
    return adjustedPricePerM2List.reduce((a, b) => a + b, 0) / adjustedPricePerM2List.length;
  }, [adjustedPricePerM2List]);

  const suggestedPrice = useMemo(() => {
    const built = parseFloat(formData.builtArea as string) || 0;
    return Math.round(averageAdjustedPricePerM2 * built);
  }, [averageAdjustedPricePerM2, formData.builtArea]);

  /** ========= PDF ========= */
  const handleDownloadPDF = async () => {
    const { jsPDF } = await import("jspdf");

    const doc = new jsPDF("p", "pt", "a4");
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 40;
    let y = margin;

    // Datos (desde AuthContext / Theme)
    const matriculado = user?.matriculado_nombre || "—";
    const cpi = user?.cpi || "—";
    const inmobiliaria = themeCompanyName || user?.inmobiliaria || "—";
    const asesorNombre =
      user?.nombre && user?.apellido ? `${user.nombre} ${user.apellido}` : "—";

    // Logo desde Theme si existe
    const themeLogo = themeLogoUrl || null;

    // Color primario
    const hexToRgb = (hex: string) => {
      const m = hex.replace("#", "");
      const int = parseInt(
        m.length === 3 ? m.split("").map((c) => c + c).join("") : m,
        16
      );
      return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
    };
    const pc = hexToRgb(effectivePrimaryColor);

    // === Título centrado ===
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(pc.r, pc.g, pc.b);
    doc.text("VAI - Valuador de Activos Inmobiliarios", pageW / 2, y, {
      align: "center",
    });
    doc.setTextColor(0, 0, 0);
    y += 30;

    // === Encabezado ===
    const colLeftX = margin;
    const colRightX = pageW - margin - 200;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    // Columna izquierda
    doc.text(`Inmobiliaria: ${inmobiliaria}`, colLeftX, y);
    // “Asesor” solo si corresponde (si el rol es asesor)
    const isAsesor = (user?.role || "").toLowerCase() === "asesor";
    if (isAsesor) {
      doc.text(`Asesor: ${asesorNombre}`, colLeftX, y + 15);
    } else {
      doc.text(`Asesor: —`, colLeftX, y + 15);
    }

    // Columna derecha
    doc.text(`Matriculado: ${matriculado}`, colRightX, y);
    doc.text(`CPI: ${cpi}`, colRightX, y + 15);
    // Fecha (derecha debajo de CPI)
    doc.text(
      `Fecha: ${new Date(formData.date).toLocaleDateString("es-AR")}`,
      colRightX,
      y + 30
    );

    // Logo centrado (si existe)
    if (themeLogo) {
      try {
        const img = await fetch(themeLogo);
        const blob = await img.blob();
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
        });
        reader.readAsDataURL(blob);
        const base64Img = await base64Promise;

        const logoW = 70;
        const logoH = 70;
        const centerX = pageW / 2 - logoW / 2;
        doc.addImage(base64Img, "PNG", centerX, y - 10, logoW, logoH, undefined, "FAST");
      } catch (err) {
        console.warn("⚠️ No se pudo cargar el logo del tema en el PDF", err);
      }
    }

    y += 60;

    // === Línea separadora ===
    doc.setDrawColor(pc.r, pc.g, pc.b);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageW - margin, y);
    y += 20;

    // === Datos de la propiedad ===
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(pc.r, pc.g, pc.b);
    doc.text("Datos de la Propiedad", pageW / 2, y, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 20;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lh = 15;

    const datosIzq = [
      `Cliente: ${formData.clientName || "-"}`,
      `Teléfono: ${formData.phone || "-"}`,
      `Email: ${formData.email || "-"}`,
      `Dirección: ${formData.address || "-"}`,
      `Barrio: ${formData.neighborhood || "-"}`,
      `Localidad: ${formData.locality || "-"}`,
      `Tipología: ${formData.propertyType}`,
      `m² Terreno: ${numero(Number(formData.landArea) || 0)}`,
      `m² Cubiertos: ${numero(Number(formData.builtArea) || 0)}`,
      `Planos: ${formData.hasPlans ? "Sí" : "No"}`,
      `Título: ${formData.titleType}`,
    ];

    let yDatos = y;
    datosIzq.forEach((line) => {
      doc.text(line, margin, yDatos);
      yDatos += lh;
    });

    if (formData.mainPhotoBase64) {
      try {
        doc.addImage(
          formData.mainPhotoBase64,
          "JPEG",
          pageW - margin - 180,
          y,
          180,
          135,
          undefined,
          "FAST"
        );
      } catch {}
    }
    y = Math.max(yDatos, y + 135) + 20;

    // Parte inferior: dos columnas
    const datosIzq2 = [
      `Antigüedad: ${numero(Number(formData.age) || 0)} años`,
      `Estado: ${formData.condition}`,
      `Ubicación: ${formData.locationQuality}`,
      `Orientación: ${formData.orientation}`,
      `Posee renta: ${formData.isRented ? "Sí" : "No"}`,
    ];

    const servicios = [
      `Luz: ${formData.services.luz ? "Sí" : "No"}`,
      `Agua: ${formData.services.agua ? "Sí" : "No"}`,
      `Gas: ${formData.services.gas ? "Sí" : "No"}`,
      `Cloacas: ${formData.services.cloacas ? "Sí" : "No"}`,
      `Pavimento: ${formData.services.pavimento ? "Sí" : "No"}`,
    ];

    let yCol = y;
    datosIzq2.forEach((line) => {
      doc.text(line, margin, yCol);
      yCol += lh;
    });

    let yCol2 = y;
    servicios.forEach((line) => {
      doc.text(line, pageW - margin - 200, yCol2);
      yCol2 += lh;
    });

    y = Math.max(yCol, yCol2) + 30;

    // === Comparables ===
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(pc.r, pc.g, pc.b);
    doc.text("Propiedades Comparadas en la Zona", pageW / 2, y, {
      align: "center",
    });
    doc.setTextColor(0, 0, 0);
    y += 16;

    const cols = 4;
    const gap = 10;
    const cardW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
    const cardH = 250;
    let cx = margin;
    let cy = y;

    const drawComparableCard = (
      c: ComparableProperty,
      x: number,
      yCard: number,
      index: number
    ) => {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.8);
      doc.rect(x, yCard, cardW, cardH);

      const innerPad = 8;
      let cursorY = yCard + innerPad;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`Propiedad Nº ${index + 1}`, x + innerPad, cursorY);
      cursorY += 18;

      if (c.photoBase64) {
        try {
          doc.addImage(
            c.photoBase64,
            "JPEG",
            x + innerPad,
            cursorY,
            cardW - innerPad * 2,
            80,
            undefined,
            "FAST"
          );
          cursorY += 95;
        } catch {}
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);

      let dirLines = doc.splitTextToSize(`Dirección: ${c.address || "-"}`, cardW - innerPad * 2);
      doc.text(dirLines, x + innerPad, cursorY);
      cursorY += (dirLines as string[]).length * 12;

      let barrioLines = doc.splitTextToSize(`Barrio: ${c.neighborhood || "-"}`, cardW - innerPad * 2);
      doc.text(barrioLines, x + innerPad, cursorY);
      cursorY += (barrioLines as string[]).length * 12;

      const builtAreaNum = Number(c.builtArea) || 0;
      const priceNum = Number(c.price) || 0;
      const coefNum = Number(c.coefficient) || 1;

      const ppm2Base = builtAreaNum > 0 ? priceNum / builtAreaNum : 0;
      const ppm2Adj = ppm2Base * coefNum;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      let precioLines = doc.splitTextToSize(`Precio: ${peso(Number(c.price) || 0)}`, cardW - innerPad * 2);
      doc.text(precioLines, x + innerPad, cursorY);
      cursorY += (precioLines as string[]).length * 12;

      doc.text(`m² Cubiertos: ${numero(Number(c.builtArea) || 0)}`, x + innerPad, cursorY);
      cursorY += 14;

      doc.text(`Precio/m²: ${peso(Number(ppm2Adj) || 0)}`, x + innerPad, cursorY);
      cursorY += 14;

      if (c.listingUrl) {
        doc.setTextColor(33, 150, 243);
        doc.textWithLink("Ver Propiedad", x + innerPad, cursorY, { url: c.listingUrl });
        doc.setTextColor(0, 0, 0);
        cursorY += 14;
      }

      const desc = c.description || "";
      const textLines = doc.splitTextToSize(desc, cardW - innerPad * 2);
      const maxLines = 5;
      const clipped = (textLines as string[]).slice(0, maxLines);
      doc.text(clipped as any, x + innerPad, cursorY);
    };

    formData.comparables.forEach((c, i) => {
      if (i > 0 && i % cols === 0) {
        cy += cardH + gap;
        cx = margin;
      }
      drawComparableCard(c, cx, cy, i);
      cx += cardW + gap;
    });

    y = cy + cardH + 16;
    if (y > pageH - 200) {
      doc.addPage();
      y = margin;
    }

    doc.setDrawColor(pc.r, pc.g, pc.b);
    doc.line(margin, y, pageW - margin, y);
    y += 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(pc.r, pc.g, pc.b);
    doc.text("Precio sugerido de venta", margin, y);
    doc.setTextColor(0, 0, 0);
    y += 16;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(peso(suggestedPrice), pageW / 2, y, { align: "center" });
    y += 30;

    doc.setDrawColor(pc.r, pc.g, pc.b);
    doc.line(margin, y, pageW - margin, y);
    y += 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(pc.r, pc.g, pc.b);
    doc.text("Conclusión", margin, y);
    doc.setTextColor(0, 0, 0);
    y += 16;

    const block = (title: string, text: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(title, margin, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(text || "-", pageW - margin * 2);
      doc.text(lines as any, margin, y);
      y += (Array.isArray(lines) ? (lines as string[]).length : 1) * 14 + 8;
      if (y > pageH - 80) {
        doc.addPage();
        y = margin;
      }
    };

    block("Observaciones", formData.observations);
    block("Fortalezas", formData.strengths);
    block("Debilidades", formData.weaknesses);
    block("A considerar", formData.considerations);

    // === Imagen final opcional ===
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

      const tempImg = new Image();
      tempImg.src = base64Img;
      await new Promise((res) => (tempImg.onload = res));
      const ratio = tempImg.height / tempImg.width;

      const imgW = pageW * 0.7;
      const imgH = imgW * ratio;
      const imgX = (pageW - imgW) / 2;

      y += 40;
      if (y + imgH > pageH - 60) {
        doc.addPage();
        y = margin;
      }

      doc.addImage(base64Img, "PNG", imgX, y, imgW, imgH, undefined, "FAST");
      y += imgH + 20;
    } catch (err) {
      console.warn("⚠️ No se pudo agregar la imagen final al PDF", err);
    }

    // === Footer ===
    const footerText = `${matriculado}  |  CPI: ${cpi}`;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(footerText, pageW / 2, pageH - 30, { align: "center" });

    doc.save("VMI.pdf");
  };

/** ========= Opciones ========= */
const propertyTypeOptions = useMemo(() => enumToOptions(PropertyType), []);
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
              <label className="block text-sm font-medium text-gray-700">m² Terreno</label>
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
              <label className="block text-sm font-medium text-gray-700">m² Cubiertos</label>
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
                {(["luz", "agua", "gas", "cloacas", "pavimento"] as Array<keyof Services>).map((k) => (
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
            Precio sugerido de venta
          </h3>
          <span className="text-xl sm:text-2xl font-bold text-center sm:text-right">{peso(suggestedPrice)}</span>
        </div>
        <p className="mt-2 text-xs sm:text-sm text-amber-700 text-center sm:text-left">
          Calculado como promedio del precio/m² ajustado de comparables × m² cubiertos de la propiedad principal.
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
                      <label className="block text-sm font-medium text-gray-700">m² Cubiertos</label>
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
                      <label className="block text-sm font-medium text-gray-700">Precio ($)</label>
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
                        placeholder="Ej: 1.200.000"
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

                    {/* Link */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Link de publicación</label>
                      <input
                        value={c.listingUrl || ""}
                        onChange={(e) => updateComparable(i, "listingUrl", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                        placeholder="https://..."
                      />
                    </div>

                    {/* Coeficiente */}
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">Coeficiente</label>
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
                      <label className="block text-sm font-medium text-gray-700">Precio por m² (ajustado)</label>
                      <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                        {peso(ppm2Adj)}
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
              disabled={formData.comparables.length >= 4}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Agregar comparable
            </button>
          </div>
        </div>
      </div>

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

            <button
              type="button"
              onClick={loadInforme}
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold w-full sm:w-auto text-center border"
            >
              Cargar Informe
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
          {loadMsg && (
            <p className={loadMsg.type === "success" ? "text-green-600" : "text-red-600"}>{loadMsg.text}</p>
          )}
          {informeId && <p className="text-xs text-gray-500">ID actual del informe: {informeId}</p>}
        </div>
      </div>
    </div>

    {/* === Modal de Carga de Informe === */}
    {loadOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Valuador de Activos Inmobiliarios</h3>
          <p className="text-sm text-gray-600 mb-4">Ingrese el ID del informe que desea cargar</p>

          <input
            type="text"
            value={loadIdInput}
            onChange={(e) => setLoadIdInput(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="Ej: 4b3a6d1e-...."
          />

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setLoadOpen(false)}
              className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmLoad}
              className="px-4 py-2 rounded-lg text-white"
              style={{ backgroundColor: effectivePrimaryColor }}
            >
              Cargar
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);
}
