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

const coefOpts = Array.from({ length: 10 }).map((_, i) => {
  const v = (i + 1) / 10; // 0.1 .. 1.0
  return { label: v.toFixed(1), value: v };
});

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
  builtArea: 0,
  price: 0,
  listingUrl: '',
  description: '',
  daysPublished: 0,
  pricePerM2: 0,
  coefficient: 1,
  // nuevos campos
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
  landArea: 0,
  builtArea: 0,
  hasPlans: false,
  titleType: TitleType.ESCRITURA,
  age: 0,
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
 *  Componente
 *  ========================= */
export default function ACMForm() {
  const { user } = useAuth();
  const [primaryColor, setPrimaryColor] = useState<string>('#0ea5e9'); // azul tailwind 500-ish
  const [logoBase64, setLogoBase64] = useState<string | undefined>(undefined);

  const [formData, setFormData] = useState<ACMFormData>(() => makeInitialData());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const mainPhotoInputRef = useRef<HTMLInputElement | null>(null);

  /** ========= Fecha auto ========= */
  useEffect(() => {
    // “refresca” la fecha al montar, solo si está vacía
    if (!formData.date) {
      setFormData((prev) => ({ ...prev, date: new Date().toISOString() }));
    }
  }, []);

  /** ========= Handlers de cambio ========= */
  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const { name } = target;

    const booleanFields = new Set([
      'hasPlans',
      'isRented',
      'services.luz',
      'services.agua',
      'services.gas',
      'services.cloacas',
      'services.pavimento',
    ]);

    const numberFields = new Set([
      'landArea',
      'builtArea',
      'age',
    ]);

    const valueRaw = target.value;

    // Servicios (anidados)
    if (name.startsWith('services.')) {
      const key = name.split('.')[1] as keyof Services;
      setFormData((prev) => ({
        ...prev,
        services: {
          ...prev.services,
          [key]: valueRaw === 'true',
        },
      }));
      return;
    }

    if (booleanFields.has(name)) {
      setFormData((prev) => ({ ...prev, [name]: valueRaw === 'true' }));
      return;
    }

    if (numberFields.has(name)) {
      const n = Number(valueRaw);
      setFormData((prev) => ({ ...prev, [name]: isNaN(n) ? 0 : n }));
      return;
    }

    if (name === 'propertyType') setFormData((p) => ({ ...p, propertyType: valueRaw as PropertyType }));
    else if (name === 'titleType') setFormData((p) => ({ ...p, titleType: valueRaw as TitleType }));
    else if (name === 'condition') setFormData((p) => ({ ...p, condition: valueRaw as PropertyCondition }));
    else if (name === 'locationQuality') setFormData((p) => ({ ...p, locationQuality: valueRaw as LocationQuality }));
    else if (name === 'orientation') setFormData((p) => ({ ...p, orientation: valueRaw as Orientation }));
    else {
      setFormData((prev) => ({ ...prev, [name]: valueRaw }));
    }
  };

  /** ========= Comparables ========= */
  const updateComparable = <K extends keyof ComparableProperty>(
    index: number,
    field: K,
    rawValue: string
  ) => {
    setFormData((prev) => {
      const copy = { ...prev };
      const arr = copy.comparables.slice();

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

      const b = arr[index].builtArea;
      const p = arr[index].price;
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
  const adjustedPricePerM2List = useMemo(() => {
    return formData.comparables
      .filter((c) => c.builtArea > 0 && c.price > 0)
      .map((c) => {
        const base = c.pricePerM2 || (c.builtArea > 0 ? c.price / c.builtArea : 0);
        return base * (c.coefficient || 1);
      });
  }, [formData.comparables]);

  const averageAdjustedPricePerM2 = useMemo(() => {
    if (adjustedPricePerM2List.length === 0) return 0;
    const sum = adjustedPricePerM2List.reduce((a, b) => a + b, 0);
    return sum / adjustedPricePerM2List.length;
  }, [adjustedPricePerM2List]);

  const suggestedPrice = useMemo(() => {
    return Math.round(averageAdjustedPricePerM2 * (formData.builtArea || 0));
  }, [averageAdjustedPricePerM2, formData.builtArea]);

  /** ========= Guardar (stub) ========= */
  const handleSaveToDB = async () => {
    try {
      const res = await fetch("/api/acm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "TU-USER-ID", // más adelante lo tomamos del login/auth
          formData,
        }),
      });

      const result = await res.json();
      if (result.error) {
        alert("Error guardando en la base: " + result.error);
      } else {
        alert("✅ Análisis guardado en la base con éxito");
      }
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

  // Logo del usuario (si existe)
  const userLogo = logoBase64 || null; // 👈 si tienes guardado el logo en Supabase o metadata

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

  // === Encabezado en 2 columnas + logo centrado ===
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

  /** 👇 desde aquí sigue exactamente tu código original */
  // === Datos de la propiedad ===
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(pc.r, pc.g, pc.b);
  doc.text("Datos de la Propiedad", pageW / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 20;

  // ... [resto de tu código PDF idéntico]

  block("Observaciones", formData.observations);
  block("Fortalezas", formData.strengths);
  block("Debilidades", formData.weaknesses);
  block("A considerar", formData.considerations);

  /** === Imagen final (fija) === */
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

    y += 40; // espacio antes de la imagen
    const imgW = pageW * 0.7; // 70% del ancho
    const imgH = imgW * 0.5; // mantén proporción
    const imgX = (pageW - imgW) / 2;

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

  doc.save("VAI.pdf");
};

  /** ========= Render ========= */
  const propertyTypeOptions = useMemo(() => enumToOptions(PropertyType), []);
  const titleOptions = useMemo(() => enumToOptions(TitleType), []);
  const conditionOptions = useMemo(() => enumToOptions(PropertyCondition), []);
  const locationOptions = useMemo(() => enumToOptions(LocationQuality), []);
  const orientationOptions = useMemo(() => enumToOptions(Orientation), []);

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
           {/* Header */}
<div className="flex items-center justify-between mb-4">
  {/* Logo + Nombre inmobiliaria */}
  <div className="flex items-center gap-4">
    <div className="w-28 h-14 bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
      {logoBase64 ? (
        <div className="flex flex-col items-center w-full h-full">
          <img
            src={logoBase64}
            alt="Logo"
            className="object-contain w-full h-full"
          />
          <button
            type="button"
            onClick={() => {
              setLogoBase64(undefined);
              localStorage.removeItem("logoBase64");
              if (logoInputRef.current) logoInputRef.current.value = "";
            }}
            className="mt-1 inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <label className="text-xs text-gray-500 px-2 text-center">
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
                localStorage.setItem("logoBase64", b64); // 🔑 persistencia
              };
              reader.readAsDataURL(f);
              if (logoInputRef.current) logoInputRef.current.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="mt-1 inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Subir
          </button>
        </label>
      )}
    </div>
          {/* Nombre de la inmobiliaria */}
          <div>
         <p className="text-base font-bold text-gray-800">
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
        <div className="border-b border-gray-200 p-6">
          <h2 className="text-lg font-semibold" style={{ color: primaryColor }}>
            Datos del Cliente / Propiedad
          </h2>
        </div>

        {/* Grid: datos a la izquierda / foto a la derecha */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          {/* Columna izquierda: datos */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
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
                value={formData.landArea}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="0"
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
                value={formData.builtArea}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="0"
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
                value={formData.age}
                onChange={handleFieldChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="0"
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
              <h3 className="text-sm font-semibold text-gray-800">
                Servicios
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {(
                  ["luz", "agua", "gas", "cloacas", "pavimento"] as Array<
                    keyof Services
                  >
                ).map((k) => (
                  <div key={k} className="space-y-1">
                    <label className="block text-xs font-medium text-gray-600 capitalize">
                      {k}
                    </label>
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
            <h3 className="mb-2 text-sm font-semibold text-gray-800">
              Foto de la propiedad
            </h3>

            {formData.mainPhotoBase64 ? (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <img
                  src={formData.mainPhotoBase64}
                  alt="Foto principal"
                  className="h-64 w-full object-cover"
                />
                <div className="p-2 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((p) => ({
                        ...p,
                        mainPhotoBase64: undefined,
                        mainPhotoUrl: "",
                      }))
                    }
                    className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
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
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold" style={{ color: primaryColor }}>
            Precio sugerido de venta
          </h3>
          <span className="text-2xl font-bold">{peso(suggestedPrice)}</span>
        </div>
        <p className="mt-1 text-xs text-amber-700">
          Calculado como promedio del precio/m² ajustado de comparables × m² cubiertos de la propiedad principal.
        </p>
      </div>
{/* =========================
    Propiedades comparadas en la zona
   ========================= */}
<div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
  <div className="border-b border-gray-200 p-6">
    <h2 className="text-lg font-semibold" style={{ color: primaryColor }}>
      Propiedades comparadas en la zona
    </h2>
  </div>

  <div className="p-6 space-y-6">
    {formData.comparables.map((c, i) => {
      const ppm2Base = c.builtArea > 0 ? c.price / c.builtArea : 0;
      const ppm2Adj = ppm2Base * (c.coefficient || 1);

      return (
        <div key={i} className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">
              Propiedad N°{i + 1}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => removeComparable(i)}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                disabled={formData.comparables.length <= 1}
              >
                Eliminar
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-7 gap-4">
            {/* Foto */}
            <div className="lg:col-span-2">
              <h4 className="mb-1 text-xs font-medium text-gray-600">Foto</h4>
              {c.photoBase64 ? (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <img
                    src={c.photoBase64}
                    alt={`Foto comparable ${i + 1}`}
                    className="h-40 w-full object-cover"
                  />
                  <div className="p-2 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => {
                          const arr = prev.comparables.slice();
                          arr[i] = { ...arr[i], photoBase64: undefined };
                          return { ...prev, comparables: arr };
                        })
                      }
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
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
                    className="block w-full text-sm"
                  />
                </div>
              )}
            </div>

            {/* Datos */}
            <div className="lg:col-span-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Dirección */}
              <div className="space-y-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Dirección</label>
                <input
                  value={c.address}
                  onChange={(e) => updateComparable(i, 'address', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  placeholder="Calle y número"
                />
              </div>

              {/* Barrio */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Barrio</label>
                <input
                  value={c.neighborhood}
                  onChange={(e) => updateComparable(i, 'neighborhood', e.target.value)}
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
                  value={c.builtArea}
                  onChange={(e) => updateComparable(i, 'builtArea', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  placeholder="0"
                />
              </div>

              {/* Precio */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Precio ($)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={c.price}
                  onChange={(e) => updateComparable(i, 'price', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  placeholder="0"
                />
              </div>

              {/* Días publicada */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Días publicada</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={c.daysPublished}
                  onChange={(e) => updateComparable(i, 'daysPublished', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  placeholder="0"
                />
              </div>

              {/* Link */}
              <div className="space-y-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Link de publicación</label>
                <input
                  value={c.listingUrl || ''}
                  onChange={(e) => updateComparable(i, 'listingUrl', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  placeholder="https://..."
                />
              </div>

              {/* Coeficiente */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Coeficiente</label>
                <select
                  value={c.coefficient}
                  onChange={(e) => updateComparable(i, 'coefficient', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                >
                  {coefOpts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Precio/m² (solo lectura) */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Precio por m² (ajustado)</label>
                <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  {peso(ppm2Adj)}
                </div>
              </div>

              {/* Descripción */}
              <div className="space-y-1 md:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Descripción</label>
                <textarea
                  value={c.description}
                  onChange={(e) => updateComparable(i, 'description', e.target.value)}
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

    <div className="flex justify-end">
      <button
        type="button"
        onClick={addComparable}
        disabled={formData.comparables.length >= 4}
        className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        Agregar comparable
      </button>
    </div>
  </div>
</div>

      {/* Conclusión */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-6">
          <h2 className="text-lg font-semibold" style={{ color: primaryColor }}>
            Conclusión
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 p-6">
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
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleDownloadPDF}
          className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: primaryColor }}
        >
          Descargar PDF
        </button>
      </div>
    </div>
  );
}
