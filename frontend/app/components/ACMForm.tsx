'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ACMFormData,
  ComparableProperty,
  LocationQuality,
  Orientation,
  PropertyCondition,
  PropertyType,
  Services,
  TitleType,
} from '@/types/acm.types';
import { createACMAnalysis } from '../lib/api';
import { useAuth } from "@/context/AuthContext";

/** =========================
 *  Helpers / Utils
 *  ========================= */
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

/** =========================
 *  Componente principal
 *  ========================= */
export default function ACMForm() {
  const { user } = useAuth();
  const [primaryColor, setPrimaryColor] = useState<string>('#0ea5e9');
  const [logoBase64, setLogoBase64] = useState<string | undefined>(undefined);

  const [formData, setFormData] = useState<ACMFormData>(() => makeInitialData());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const mainPhotoInputRef = useRef<HTMLInputElement | null>(null);

  /** ========= Fecha auto ========= */
  useEffect(() => {
    if (!formData.date) {
      setFormData((prev) => ({ ...prev, date: new Date().toISOString() }));
    }
  }, [formData.date]);

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
    rawValue: string
  ) => {
    setFormData((prev) => {
      const copy = { ...prev };
      const arr = [...copy.comparables];

      const numericFields: Array<keyof ComparableProperty> = [
        'builtArea',
        'price',
        'daysPublished',
        'pricePerM2',
        'coefficient',
      ];
      let value: any = rawValue;
      if (numericFields.includes(field)) {
        const n = Number(rawValue);
        value = isNaN(n) ? 0 : n;
      }

     arr[index] = { ...arr[index], [field]: value };

const b = parseFloat(arr[index].builtArea as string) || 0;
const p = parseFloat(arr[index].price as string) || 0;

arr[index].pricePerM2 = b > 0 ? p / b : 0;


      copy.comparables = arr;
      return copy;
    });
  };

  const addComparable = () => {
    setFormData((prev) => {
      if (prev.comparables.length >= 4) return prev;
      return { ...prev, comparables: [...prev.comparables, { ...emptyComparable }] };
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

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const b64 = await readFileAsBase64(f);
    setLogoBase64(b64);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

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
        const base = c.pricePerM2 || (built > 0 ? price / built : 0);
        return (Number(base) || 0) * (Number(coef) || 1);
      }),
  [formData.comparables]
);

const averageAdjustedPricePerM2 = useMemo(() => {
  if (adjustedPricePerM2List.length === 0) return 0;
  return (
    adjustedPricePerM2List.reduce((a, b) => a + b, 0) /
    adjustedPricePerM2List.length
  );
}, [adjustedPricePerM2List]);

const suggestedPrice = useMemo(() => {
  const built = parseFloat(formData.builtArea as string) || 0;
  return Math.round(averageAdjustedPricePerM2 * built);
}, 
    [averageAdjustedPricePerM2, formData.builtArea]
);


  /** ========= Guardar ========= */
  const handleSaveToDB = async () => {
    try {
      const res = await fetch("/api/acm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "TU-USER-ID", formData }),
      });
      const result = await res.json();
      if (result.error) alert("Error guardando en la base: " + result.error);
      else alert("✅ Análisis guardado con éxito");
    } catch (err: any) {
      alert("Error inesperado: " + err.message);
    }
  };

/** ========= PDF ========= */
const handleDownloadPDF = async () => {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF("p", "pt", "a4");
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  // Datos de usuario (desde AuthContext)
  const matriculado = user?.matriculado_nombre || "—";
  const cpi = user?.cpi || "—";
  const inmobiliaria = user?.inmobiliaria || "—";
  const asesorNombre =
    user?.nombre && user?.apellido ? `${user.nombre} ${user.apellido}` : "—";

  // Logo del usuario (desde la app)
  const userLogo = logoBase64 || null;

  // Color primario
  const hexToRgb = (hex: string) => {
    const m = hex.replace("#", "");
    const int = parseInt(
      m.length === 3 ? m.split("").map((c) => c + c).join("") : m,
      16
    );
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
  };
  const pc = hexToRgb(primaryColor);

  // === Título centrado ===
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(pc.r, pc.g, pc.b);
  doc.text("VAI - Valuador de Activos Inmobiliarios", pageW / 2, y, {
    align: "center",
  });
  doc.setTextColor(0, 0, 0);
  y += 30;

 // === Encabezado con logo ===
  const colLeftX = margin;
  const colRightX = pageW - margin - 200;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  // Columna izquierda
  doc.text(`Inmobiliaria: ${inmobiliaria}`, colLeftX, y);
  doc.text(`Asesor: ${asesorNombre}`, colLeftX, y + 15);
  doc.text(
    `Fecha: ${new Date(formData.date).toLocaleDateString("es-AR")}`,
    colLeftX,
    y + 30
  );

  // Columna derecha
  doc.text(`Matriculado: ${matriculado}`, colRightX, y);
  doc.text(`CPI: ${cpi}`, colRightX, y + 15);

  // Logo centrado (si existe)
  if (userLogo) {
    try {
      const img = await fetch(userLogo);
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
      console.warn("⚠️ No se pudo cargar el logo del usuario en el PDF", err);
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
    doc.text(line, colLeftX, yDatos);
    yDatos += lh;
  });

  if (formData.mainPhotoBase64) {
    try {
      doc.addImage(
        formData.mainPhotoBase64,
        "JPEG",
        colRightX,
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
    `Antigüedad: ${numero(formData.age)} años`,
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
    doc.text(line, colLeftX, yCol);
    yCol += lh;
  });

  let yCol2 = y;
  servicios.forEach((line) => {
    doc.text(line, colRightX, yCol2);
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
    cursorY += dirLines.length * 12;

    let barrioLines = doc.splitTextToSize(`Barrio: ${c.neighborhood || "-"}`, cardW - innerPad * 2);
    doc.text(barrioLines, x + innerPad, cursorY);
    cursorY += barrioLines.length * 12;

    const ppm2Base = c.builtArea > 0 ? c.price / c.builtArea : 0;
    const ppm2Adj = ppm2Base * (c.coefficient || 1);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    let precioLines = doc.splitTextToSize(`Precio: ${peso(c.price)}`, cardW - innerPad * 2);
    doc.text(precioLines, x + innerPad, cursorY);
    cursorY += precioLines.length * 12;

    doc.text(`m² Cubiertos: ${numero(c.builtArea)}`, x + innerPad, cursorY);
    cursorY += 14;

    doc.text(`Precio/m²: ${peso(ppm2Adj)}`, x + innerPad, cursorY);
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
    y += (Array.isArray(lines) ? lines.length : 1) * 14 + 8;
    if (y > pageH - 80) {
      doc.addPage();
      y = margin;
    }
  };

  block("Observaciones", formData.observations);
  block("Fortalezas", formData.strengths);
  block("Debilidades", formData.weaknesses);
  block("A considerar", formData.considerations);
    
// === Imagen final (fija, sin deformar) ===
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

  /** ========= Render ========= */
  const propertyTypeOptions = useMemo(() => enumToOptions(PropertyType), []);
  const titleOptions = useMemo(() => enumToOptions(TitleType), []);
  const conditionOptions = useMemo(() => enumToOptions(PropertyCondition), []);
  const locationOptions = useMemo(() => enumToOptions(LocationQuality), []);
  const orientationOptions = useMemo(() => enumToOptions(Orientation), []);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        {/* Logo + Nombre inmobiliaria */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <div className="w-28 sm:w-32 bg-white rounded-lg border border-gray-200 flex flex-col items-center justify-center overflow-hidden p-1">
  {logoBase64 ? (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="w-full flex justify-center">
        <img
          src={logoBase64}
          alt="Logo"
          className="object-contain max-h-16 sm:max-h-20 w-auto"
        />
      </div>

      {/* ✅ input oculto para reemplazar el logo directamente */}
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onloadend = () => {
            const b64 = reader.result as string;
            setLogoBase64(b64);
            localStorage.setItem("logoBase64", b64);
          };
          reader.readAsDataURL(f);
          if (logoInputRef.current) logoInputRef.current.value = "";
        }}
      />

      {/* 🔘 Botón visible debajo del logo */}
      <button
        type="button"
        onClick={() => logoInputRef.current?.click()}
        className="mt-1 inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-[10px] sm:text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        Cambiar logo
      </button>
    </div>
  ) : (
    <label className="flex flex-col items-center justify-center text-xs text-gray-500 px-2 py-2 text-center">
      Logo
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onloadend = () => {
            const b64 = reader.result as string;
            setLogoBase64(b64);
            localStorage.setItem("logoBase64", b64);
          };
          reader.readAsDataURL(f);
          if (logoInputRef.current) logoInputRef.current.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => logoInputRef.current?.click()}
        className="mt-1 inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-[10px] sm:text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        Subir
      </button>
    </label>
  )}
</div>


          {/* Nombre de la inmobiliaria */}
          <div className="text-center sm:text-left">
            <p className="text-sm sm:text-base font-bold text-gray-800">
              {user?.inmobiliaria || "Inmobiliaria sin nombre"}
            </p>
          </div>
        </div>

        {/* Color primario */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Color</label>
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-gray-200 bg-white p-0"
            aria-label="Color primario"
          />
        </div>
      </div>

      {/* Card principal */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: primaryColor }}>
            Datos del Cliente / Propiedad
          </h2>
        </div>
        {/* Grid principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 sm:p-6">
          {/* Columna izquierda */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* Cliente */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Cliente
              </label>
              <input
                name="clientName"
                value={formData.clientName}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                style={{ outlineColor: primaryColor }}
                placeholder="Nombre del cliente"
              />
            </div>

            {/* Teléfono */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Teléfono
              </label>
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
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
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
              <label className="block text-sm font-medium text-gray-700">
                Dirección
              </label>
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
              <label className="block text-sm font-medium text-gray-700">
                Barrio
              </label>
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
              <label className="block text-sm font-medium text-gray-700">
                Localidad
              </label>
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
              <label className="block text-sm font-medium text-gray-700">
                Tipología
              </label>
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
  <label className="block text-sm font-medium text-gray-700">
    m² Terreno
  </label>
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
  <label className="block text-sm font-medium text-gray-700">
    m² Cubiertos
  </label>
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
              <label className="block text-sm font-medium text-gray-700">
                Planos
              </label>
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
              <label className="block text-sm font-medium text-gray-700">
                Título
              </label>
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
  <label className="block text-sm font-medium text-gray-700">
    Antigüedad (años)
  </label>
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
              <label className="block text-sm font-medium text-gray-700">
                Estado de conservación
              </label>
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
              <label className="block text-sm font-medium text-gray-700">
                Ubicación
              </label>
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
              <label className="block text-sm font-medium text-gray-700">
                Orientación
              </label>
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
              <label className="block text-sm font-medium text-gray-700">
                Posee renta actualmente
              </label>
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

            {formData.mainPhotoBase64 ? (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <img
                  src={formData.mainPhotoBase64}
                  alt="Foto principal"
                  className="h-48 sm:h-64 w-full object-cover"
                />
                <div className="p-2 text-center sm:text-right">
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
                    Cambiar foto
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center">
                <p className="mb-2 text-xs text-gray-500">
                  Subir imagen (JPG/PNG)
                </p>
                <input
                  ref={mainPhotoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleMainPhotoSelect}
                  className="block w-full text-sm"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Precio sugerido */}
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3
            className="text-base sm:text-lg font-semibold text-center sm:text-left"
            style={{ color: primaryColor }}
          >
            Precio sugerido de venta
          </h3>
          <span className="text-xl sm:text-2xl font-bold text-center sm:text-right">
            {peso(suggestedPrice)}
          </span>
        </div>
        <p className="mt-2 text-xs sm:text-sm text-amber-700 text-center sm:text-left">
          Calculado como promedio del precio/m² ajustado de comparables × m²
          cubiertos de la propiedad principal.
        </p>
      </div>

      {/* Propiedades comparadas en la zona */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4 sm:p-6">
          <h2
            className="text-base sm:text-lg font-semibold text-center sm:text-left"
            style={{ color: primaryColor }}
          >
            Propiedades comparadas en la zona
          </h2>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {formData.comparables.map((c, i) => {
            const ppm2Base = c.builtArea > 0 ? c.price / c.builtArea : 0;
            const ppm2Adj = ppm2Base * (c.coefficient || 1);

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
                  {/* Foto */}
                  <div className="lg:col-span-2">
                    <h4 className="mb-1 text-xs sm:text-sm font-medium text-gray-600">
                      Foto
                    </h4>
                    {c.photoBase64 ? (
                      <div className="overflow-hidden rounded-lg border border-gray-200">
                        <img
                          src={c.photoBase64}
                          alt={`Foto comparable ${i + 1}`}
                          className="h-40 sm:h-48 w-full object-cover"
                        />
                        <div className="p-2 text-center sm:text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => {
                                const arr = prev.comparables.slice();
                                arr[i] = { ...arr[i], photoBase64: undefined };
                                return { ...prev, comparables: arr };
                              })
                            }
                            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Cambiar foto
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-gray-300 p-3 text-center">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleComparablePhotoSelect(i, e)}
                          className="block w-full text-xs sm:text-sm"
                        />
                      </div>
                    )}
                  </div>

                  {/* Datos */}
                  <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Dirección */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Dirección
                      </label>
                      <input
                        value={c.address}
                        onChange={(e) =>
                          updateComparable(i, "address", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                        placeholder="Calle y número"
                      />
                    </div>

                    {/* Barrio */}
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Barrio
                      </label>
                      <input
                        value={c.neighborhood}
                        onChange={(e) =>
                          updateComparable(i, "neighborhood", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                        placeholder="Barrio"
                      />
                    </div>

                   {/* m² Cubiertos */}
<div className="space-y-1">
  <label className="block text-sm font-medium text-gray-700">
    m² Cubiertos
  </label>
  <input
    type="number"
    inputMode="decimal"
    value={c.builtArea ?? ""}
    onChange={(e) => {
      const value = e.target.value === "" ? null : parseFloat(e.target.value);
      updateComparable(i, "builtArea", value);
    }}
    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
    placeholder="Ej: 120"
  />
</div>

{/* Precio */}
<div className="space-y-1">
  <label className="block text-sm font-medium text-gray-700">
    Precio ($)
  </label>
  <input
    type="text"
    inputMode="numeric"
    value={
      c.price !== undefined && c.price !== null
        ? new Intl.NumberFormat("es-AR").format(c.price)
        : ""
    }
    onChange={(e) => {
      const raw = e.target.value.replace(/\./g, ""); // quita puntos de miles
      const numericValue = raw === "" ? null : parseInt(raw, 10);
      updateComparable(i, "price", numericValue);
    }}
    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-offset-1"
    placeholder="Ej: 1.200.000"
  />
</div>

{/* Días publicada */}
<div className="space-y-1">
  <label className="block text-sm font-medium text-gray-700">
    Días publicada
  </label>
  <input
    type="number"
    inputMode="numeric"
    value={c.daysPublished ?? ""}
    onChange={(e) => {
      const value = e.target.value === "" ? null : parseInt(e.target.value, 10);
      updateComparable(i, "daysPublished", value);
    }}
    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
    placeholder="Ej: 45"
  />
</div>

                    {/* Link */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Link de publicación
                      </label>
                      <input
                        value={c.listingUrl || ""}
                        onChange={(e) =>
                          updateComparable(i, "listingUrl", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                        placeholder="https://..."
                      />
                    </div>

                   {/* Coeficiente */}
<div className="space-y-1">
  <label className="block text-sm font-medium text-gray-700">
    Coeficiente
  </label>
  <select
    value={c.coefficient ?? "1.0"}
    onChange={(e) =>
      updateComparable(i, "coefficient", parseFloat(e.target.value))
    }
    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
  >
    {Array.from({ length: 15 }, (_, idx) => ((idx + 1) / 10).toFixed(1)).map(
      (val) => (
        <option key={val} value={val}>
          {val}
        </option>
      )
    )}
  </select>
</div>

                    {/* Precio/m² */}
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Precio por m² (ajustado)
                      </label>
                      <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                        {peso(ppm2Adj)}
                      </div>
                    </div>

                    {/* Descripción */}
                    <div className="space-y-1 sm:col-span-2 md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Descripción
                      </label>
                      <textarea
                        value={c.description}
                        onChange={(e) =>
                          updateComparable(i, "description", e.target.value)
                        }
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
          <h2
            className="text-base sm:text-lg font-semibold text-center sm:text-left"
            style={{ color: primaryColor }}
          >
            Conclusión
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-5 p-4 sm:p-6">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Observaciones
            </label>
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
            <label className="block text-sm font-medium text-gray-700">
              Fortalezas
            </label>
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
            <label className="block text-sm font-medium text-gray-700">
              Debilidades
            </label>
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
            <label className="block text-sm font-medium text-gray-700">
              A considerar
            </label>
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
<div className="mt-6 flex flex-col sm:flex-row flex-wrap items-center justify-center sm:justify-end gap-3">
  <button
    type="button"
    onClick={handleDownloadPDF}
    className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white w-full sm:w-auto text-center"
    style={{ backgroundColor: primaryColor }}
  >
    Descargar PDF
  </button>

  {/* 🔒 Botón temporalmente oculto — volver a activar en producción */}
  {false && (
    <button
      type="button"
      onClick={handleSaveToDB}
      className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white w-full sm:w-auto text-center"
      style={{ backgroundColor: primaryColor }}
    >
      Guardar en Base
    </button>
  )}
</div>
</div>
);
}
